package com.visitaloja.app

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.Timestamp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.MetadataChanges
import com.google.firebase.firestore.Source
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.time.Instant

data class VisitState(val uid: String? = null, val place: Place? = null, val busy: Boolean = false, val ready: Boolean = false,
    val blocked: Boolean = false, val id: String = "", val code: String = "", val expires: Long = 0, val status: String = "", val cached: Boolean = true, val message: String? = null)
class VisitViewModel(application: Application) : AndroidViewModel(application) {
    private val auth = FirebaseAuth.getInstance()
    private val db = FirebaseFirestore.getInstance()
    private val preferences = application.getSharedPreferences("vl_visit_requests", Context.MODE_PRIVATE)
    private val mutable = MutableStateFlow(VisitState())
    val state = mutable.asStateFlow()
    private var listener: ListenerRegistration? = null
    private var generation = 0
    fun bind(uid: String?) { generation++; listener?.remove(); listener = null; mutable.value = VisitState(uid = uid) }
    private fun current(uid: String, epoch: Int) = generation == epoch && auth.currentUser?.uid == uid
    fun open(place: Place) {
        val uid = auth.currentUser?.uid ?: return
        generation++; listener?.remove(); listener = null
        mutable.value = VisitState(uid = uid, place = place)
        run { user, epoch -> refresh(user, place, epoch) }
    }
    private fun key(uid: String, place: String) = "$uid:$place"
    private fun candidate(uid: String, place: Place): VisitCandidate? = try {
        val value = JSONObject(preferences.getString(key(uid, place.id), "") ?: "")
        VisitCandidate(value.getString("id"), value.getString("code"), value.getLong("expires")).takeIf { it.code.matches(Regex("[0-9]{6}")) && it.expires > System.currentTimeMillis() }
    } catch (_: Exception) { null }
    private suspend fun refresh(uid: String, place: Place, epoch: Int): Boolean = coroutineScope {
        val counters = async { db.collection("loyaltyCounters").whereEqualTo("userId", uid).get(Source.SERVER).await() }
        val codes = async { db.collection("visitCodes").whereEqualTo("userId", uid).get(Source.SERVER).await() }
        val counter = counters.await().documents.firstOrNull { it.getString("placeId") == place.id }?.data
        val stored = candidate(uid, place)
        val documents = codes.await().documents.filter { it.getString("placeId") == place.id }
        if (!current(uid, epoch)) return@coroutineScope false
        val day = Instant.ofEpochMilli(System.currentTimeMillis()).atZone(AgendaPolicy.zone).toLocalDate().toString()
        val blocked = VisitPolicy.blocked(counter, day)
        val previous = documents.find { it.id == stored?.id && it.getString("status") == "confirmed" }
        val pending = if (blocked) null else documents.filter { it.getString("status") == "pending" && (it.getTimestamp("expiresAt")?.toDate()?.time ?: 0) > System.currentTimeMillis() }.maxByOrNull { it.getTimestamp("expiresAt")?.toDate()?.time ?: 0 }
        mutable.update { it.copy(ready = true, blocked = blocked, message = null) }
        val active = previous ?: pending
        if (active != null) { watch(uid, active.id, epoch); return@coroutineScope false }
        mutable.update { it.copy(id = "", code = "", expires = 0, status = "", cached = false) }
        !blocked
    }
    fun generate() {
        val place = mutable.value.place ?: return
        run { uid, epoch ->
            if (!refresh(uid, place, epoch)) return@run
            val user = auth.currentUser ?: return@run
            val day = Instant.ofEpochMilli(System.currentTimeMillis()).atZone(AgendaPolicy.zone).toLocalDate().toString()
            val next = candidate(uid, place) ?: VisitPolicy.candidate(place.id, day, System.currentTimeMillis())
            check(preferences.edit().putString(key(uid, place.id), JSONObject().put("id", next.id).put("code", next.code).put("expires", next.expires).toString()).commit()) { "No pudimos guardar la referencia del código en este teléfono." }
            val token = user.getIdToken(false).await().token ?: error("Inicia sesión nuevamente.")
            if (!current(uid, epoch)) return@run
            try {
                withContext(Dispatchers.IO) { NativeApi.post("https://firestore.googleapis.com/v1/projects/cultura-y-cuchara/databases/(default)/documents:commit", token, VisitPolicy.commit(uid, user.displayName.orEmpty(), user.email.orEmpty(), place, next)) }
            } catch (error: NativeHttpError) {
                if (error.status == 409) {
                    // Recover an ambiguous previous request first. Never overwrite an existing code.
                    if (!refresh(uid, place, epoch)) return@run
                    preferences.edit().remove(key(uid, place.id)).apply()
                    throw IllegalStateException("Ese código ya existe. Vuelve a generar uno; tus visitas no se modificaron.")
                }
                throw error
            }
            if (current(uid, epoch)) watch(uid, next.id, epoch)
        }
    }
    private fun watch(uid: String, id: String, epoch: Int) {
        listener?.remove()
        listener = db.collection("visitCodes").document(id).addSnapshotListener(MetadataChanges.INCLUDE) { doc, error ->
            if (!current(uid, epoch)) return@addSnapshotListener
            if (error != null || doc?.getString("userId") != uid) { mutable.update { it.copy(cached = true, message = "No pudimos confirmar el estado del código. Reintenta para recuperarlo.") }; return@addSnapshotListener }
            val status = doc.getString("status").orEmpty()
            val valid = status != "confirmed" || doc.getTimestamp("confirmedAt") != null
            mutable.update { it.copy(id = id, code = doc.getString("code").orEmpty(), expires = doc.getTimestamp("expiresAt")?.toDate()?.time ?: 0,
                status = if (valid) status else "", cached = doc.metadata.isFromCache || doc.metadata.hasPendingWrites(), message = null) }
        }
    }
    fun retry() { val place = mutable.value.place ?: return; run { uid, epoch -> refresh(uid, place, epoch) } }
    fun close() { bind(auth.currentUser?.uid) }
    private fun run(work: suspend (String, Int) -> Unit) {
        val uid = auth.currentUser?.uid ?: return
        if (mutable.value.busy) return
        val epoch = generation
        mutable.update { it.copy(busy = true, message = null) }
        viewModelScope.launch {
            try { work(uid, epoch) }
            catch (error: kotlinx.coroutines.CancellationException) { throw error }
            catch (error: Exception) { if (current(uid, epoch)) mutable.update { it.copy(message = if (error is IllegalStateException || error is IllegalArgumentException) error.message else "No pudimos confirmar la solicitud. Comprueba conexión y hora automática del teléfono. Reintenta para recuperar cualquier código creado.") } }
            finally { if (current(uid, epoch)) mutable.update { it.copy(busy = false) } }
        }
    }
    override fun onCleared() { generation++; listener?.remove(); super.onCleared() }
}
