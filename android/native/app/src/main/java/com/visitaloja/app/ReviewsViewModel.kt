package com.visitaloja.app

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Source
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext

internal data class ReviewsState(val place: String? = null, val uid: String? = null, val items: List<VerifiedReview> = emptyList(), val loading: Boolean = false, val publicLoaded: Boolean = false, val failed: Boolean = false, val more: Boolean = false, val ownLoading: Boolean = false, val ownReady: Boolean = false, val eligible: Boolean = false, val ownExists: Boolean = false, val own: VerifiedReview? = null, val defaultName: String = "", val busy: Boolean = false, val message: String? = null, val saved: Int = 0)
internal class ReviewsViewModel : ViewModel() {
    private val auth = FirebaseAuth.getInstance()
    private val db = FirebaseFirestore.getInstance()
    private val mutable = MutableStateFlow(ReviewsState())
    val state = mutable.asStateFlow()
    private var epoch = 0
    private var cursor: DocumentSnapshot? = null
    private var ownEpoch = 0
    private var session = 0
    private val authListener = FirebaseAuth.AuthStateListener { changed ->
        val uid = changed.currentUser?.uid
        if (mutable.value.uid != uid) {
            ownEpoch++;session++
            mutable.value = mutable.value.copy(uid = uid, own = null, ownReady = false, ownLoading = false, ownExists = false, eligible = false, busy = false, message = null, defaultName = changed.currentUser?.displayName.orEmpty().take(100))
            refreshOwn()
        }
    }
    init { auth.addAuthStateListener(authListener) }
    fun bind(place: String?) {
        if (mutable.value.place == place) return
        epoch++;ownEpoch++;session++;cursor = null
        mutable.value = ReviewsState(place = place, uid = auth.currentUser?.uid, defaultName = auth.currentUser?.displayName.orEmpty().take(100))
        if (place != null) { load();refreshOwn() }
    }
    private fun current(generation: Int, place: String) = epoch == generation && mutable.value.place == place
    fun load(reset: Boolean = false) {
        val place = mutable.value.place ?: return
        if (mutable.value.loading) return
        if (reset) { cursor = null;mutable.value = mutable.value.copy(items = emptyList(), publicLoaded = false) }
        val generation = epoch
        mutable.value = mutable.value.copy(loading = true, failed = false)
        viewModelScope.launch {
            try {
                var query = db.collection("verifiedReviews").whereEqualTo("placeId", place).whereEqualTo("status", "published").limit(30)
                cursor?.let { query = query.startAfter(it) }
                val snapshot = query.get(Source.SERVER).await()
                if (!current(generation, place)) return@launch
                val items = snapshot.documents.mapNotNull { ReviewsPolicy.read(it.id, it.data.orEmpty(), place) }
                cursor = snapshot.documents.lastOrNull()
                mutable.value = mutable.value.copy(items = (mutable.value.items + items).distinctBy { it.id }, publicLoaded = true, more = snapshot.size() == 30)
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (_: Exception) { if (current(generation, place)) mutable.value = mutable.value.copy(failed = true) }
            finally { if (current(generation, place)) mutable.value = mutable.value.copy(loading = false) }
        }
    }
    fun refreshOwn() {
        val place = mutable.value.place ?: return
        val uid = auth.currentUser?.uid ?: return
        if (mutable.value.uid != uid) return
        val generation = epoch;val ownerGeneration = ++ownEpoch
        mutable.value = mutable.value.copy(ownLoading = true, ownReady = false)
        viewModelScope.launch {
            try {
                // Querying owned records also works when the review/counter does not exist;
                // a direct get of a missing owner-only document is denied by existing rules.
                val own = db.collection("verifiedReviews").whereEqualTo("userId", uid).whereEqualTo("placeId", place).get(Source.SERVER).await().documents.firstOrNull { it.id == ReviewsPolicy.id(uid, place) }
                val counters = db.collection("loyaltyCounters").whereEqualTo("userId", uid).whereEqualTo("placeId", place).get(Source.SERVER).await()
                if (!current(generation, place) || ownEpoch != ownerGeneration || auth.currentUser?.uid != uid) return@launch
                mutable.value = mutable.value.copy(ownReady = true, ownExists = own != null, own = own?.let { ReviewsPolicy.read(it.id, it.data.orEmpty(), place, false) }, eligible = counters.documents.any { ReviewsPolicy.eligible(uid, place, it.id, it.data.orEmpty()) })
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (_: Exception) { if (current(generation, place) && ownEpoch == ownerGeneration) mutable.value = mutable.value.copy(message = "No pudimos comprobar tu visita. Conéctate y vuelve a consultar.") }
            finally { if (current(generation, place) && ownEpoch == ownerGeneration) mutable.value = mutable.value.copy(ownLoading = false) }
        }
    }
    fun save(placeName: String, name: String, rating: Int, comment: String) {
        val previous = mutable.value
        val place = previous.place ?: return
        val uid = auth.currentUser?.uid ?: return
        if (previous.uid != uid || previous.busy || !previous.ownReady || (!previous.eligible && !previous.ownExists)) return
        ReviewsPolicy.error(name, rating, comment)?.let { mutable.value = previous.copy(message = it);return }
        val generation = epoch;val ownerGeneration = ownEpoch;val sessionGeneration = session
        mutable.value = previous.copy(busy = true, message = null)
        viewModelScope.launch {
            try {
                val freshPlace = db.collection("locales").document(place).get(Source.SERVER).await()
                check(ReviewsPolicy.placePublished(freshPlace.data.orEmpty())) { "La parada ya no está publicada." }
                val own = db.collection("verifiedReviews").whereEqualTo("userId", uid).whereEqualTo("placeId", place).get(Source.SERVER).await().documents.firstOrNull { it.id == ReviewsPolicy.id(uid, place) }
                check((own != null) == previous.ownExists && own?.let { ReviewsPolicy.read(it.id, it.data.orEmpty(), place, false) } == previous.own) { "Tu opinión cambió. Actualiza para revisarla antes de publicar." }
                if (own == null) {
                    val counters = db.collection("loyaltyCounters").whereEqualTo("userId", uid).whereEqualTo("placeId", place).get(Source.SERVER).await()
                    check(counters.documents.any { ReviewsPolicy.eligible(uid, place, it.id, it.data.orEmpty()) }) { "Necesitas una visita registrada para opinar." }
                }
                val token = auth.currentUser?.getIdToken(false)?.await()?.token ?: error("Vuelve a iniciar sesión.")
                if (!current(generation, place) || ownerGeneration != ownEpoch || auth.currentUser?.uid != uid) return@launch
                val payload = ReviewsPolicy.commit(uid, place, freshPlace.getString("title").orEmpty().ifBlank { placeName }, name, rating, comment, own != null)
                val response = withContext(Dispatchers.IO) { NativeApi.post("https://firestore.googleapis.com/v1/projects/cultura-y-cuchara/databases/(default)/documents:commit", token, payload) }
                check(response.optJSONArray("writeResults")?.length() == 1 && response.optString("commitTime").isNotBlank()) { "No pudimos confirmar la publicación. Actualiza antes de volver a publicar." }
                if (!current(generation, place) || auth.currentUser?.uid != uid || ownEpoch != ownerGeneration) return@launch
                mutable.value = mutable.value.copy(saved = mutable.value.saved + 1, message = if (own == null || own.getString("status") == "published") "Opinión guardada. Tu nombre y comentario son públicos." else "Opinión guardada. Conserva su estado de moderación.")
                load(true);refreshOwn()
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (error: Exception) {
                if (current(generation, place) && ownEpoch == ownerGeneration && auth.currentUser?.uid == uid) {
                    mutable.value = mutable.value.copy(message = if (error is IllegalStateException) error.message else "No pudimos confirmar la publicación. Actualiza antes de volver a publicar.", ownReady = false)
                }
            } finally { if (current(generation, place) && auth.currentUser?.uid == uid && session == sessionGeneration) mutable.value = mutable.value.copy(busy = false) }
        }
    }
    override fun onCleared() { epoch++;ownEpoch++;session++;auth.removeAuthStateListener(authListener);super.onCleared() }
}
