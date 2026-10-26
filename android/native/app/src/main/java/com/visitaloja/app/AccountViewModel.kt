package com.visitaloja.app

import android.app.Application
import android.content.Context
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseNetworkException
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseAuthException
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FirebaseFirestoreSettings
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.MemoryCacheSettings
import com.google.firebase.firestore.MetadataChanges
import com.google.firebase.firestore.FirebaseFirestoreException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

data class AccountState(
    val uid: String? = null, val name: String = "", val email: String = "", val city: String = "", val visitorType: String = "",
    val busy: Boolean = false, val message: String? = null, val profileError: String? = null,
    val favourites: Set<String> = emptySet(), val favouritesReady: Boolean = false, val favouritesError: String? = null,
    val fromCache: Boolean = false, val profile: ProfileDraft? = null, val profileComplete: Boolean = false, val profileReady: Boolean = false, val profileRevision: Int = 0
)

class AccountViewModel(application: Application) : AndroidViewModel(application) {
    private val mutable = MutableStateFlow(AccountState())
    val state = mutable.asStateFlow()
    private val app = FirebaseApp.getInstance().also { require(it.options.projectId == "cultura-y-cuchara") }
    private val auth = FirebaseAuth.getInstance(app)
    private val db = FirebaseFirestore.getInstance(app).apply {
        firestoreSettings = FirebaseFirestoreSettings.Builder().setLocalCacheSettings(MemoryCacheSettings.newBuilder().build()).build()
    }
    private var profileListener: ListenerRegistration? = null
    private var progressListener: ListenerRegistration? = null
    @Volatile private var generation = 0
    private val authListener = FirebaseAuth.AuthStateListener { changed ->
        val user = changed.currentUser
        if (user?.uid != mutable.value.uid || generation == 0) {
            generation++
            profileListener?.remove(); progressListener?.remove()
            mutable.value = AccountState(uid = user?.uid, name = user?.displayName.orEmpty(), email = user?.email.orEmpty())
            if (user != null) observe(user.uid, generation)
        }
    }
    init { auth.addAuthStateListener(authListener) }

    private fun same(uid: String, epoch: Int) = epoch == generation && auth.currentUser?.uid == uid
    private fun observe(uid: String, epoch: Int) {
        profileListener = db.collection("userProfiles").document(uid).addSnapshotListener(MetadataChanges.INCLUDE) { doc, error ->
            if (!same(uid, epoch)) return@addSnapshotListener
            mutable.update { it.copy(
                name = doc?.getString("fullName")?.takeIf(String::isNotBlank) ?: auth.currentUser?.displayName.orEmpty(),
                city = doc?.getString("city").orEmpty(), visitorType = doc?.getString("visitorType").orEmpty(),
                profile = if (error == null) ProfilePolicy.draft(doc?.data, auth.currentUser?.displayName.orEmpty()) else null,
                profileComplete = error == null && doc?.getBoolean("profileComplete") == true, profileReady = error == null && doc != null && !doc.metadata.isFromCache,
                profileError = if (error != null) "No pudimos consultar tu perfil. Vuelve a intentar." else null
            ) }
        }
        progressListener = db.collection("userProgress").document(uid).addSnapshotListener(MetadataChanges.INCLUDE) { doc, error ->
            if (!same(uid, epoch)) return@addSnapshotListener
            mutable.update { it.copy(favourites = if (error == null && doc != null) AccountPolicy.favourites(doc.data) else it.favourites,
                favouritesReady = error == null && doc != null,
                fromCache = doc?.metadata?.isFromCache ?: false,
                favouritesError = if (error != null) "No pudimos sincronizar tus favoritos. Comprueba la conexión y reintenta desde Mi cuenta." else null) }
        }
    }

    fun retry() {
        val uid = auth.currentUser?.uid ?: return
        generation++; profileListener?.remove(); progressListener?.remove()
        mutable.update { it.copy(favouritesReady = false, favouritesError = null, profileError = null) }
        observe(uid, generation)
    }

    fun saveProfile(draft: ProfileDraft) = operation {
        val user = auth.currentUser ?: return@operation
        val uid = user.uid; val epoch = generation
        val today = java.time.Instant.now().atZone(AgendaPolicy.zone).toLocalDate()
        val fields = ProfilePolicy.fields(draft, uid, user.email.orEmpty(), user.photoUrl?.toString().orEmpty(), today)
        val ref = db.collection("userProfiles").document(uid)
        db.runTransaction { tx ->
            check(same(uid, epoch)) { "La sesión cambió. Vuelve a ingresar." }
            val old = tx.get(ref)
            val payload = fields.toMutableMap()
            if (old.exists()) {
                check(old.get("createdAt") != null && old.get("consentAt") != null) { "Tu perfil necesita revisión de administración antes de actualizarse." }
                payload["photoURL"] = old.getString("photoURL") ?: fields.getValue("photoURL")
                payload["updatedAt"] = FieldValue.serverTimestamp()
                tx.update(ref, payload)
            } else {
                payload["createdAt"] = FieldValue.serverTimestamp(); payload["consentAt"] = FieldValue.serverTimestamp(); payload["updatedAt"] = FieldValue.serverTimestamp()
                tx.set(ref, payload)
            }
        }.await()
        if (same(uid, epoch)) mutable.update { it.copy(message = "Tu perfil quedó guardado en tu cuenta.", profileRevision = it.profileRevision + 1) }
    }

    fun emailLogin(email: String, password: String) = operation {
        require(email.trim().isNotBlank() && password.isNotBlank()) { "Escribe tu correo y contraseña." }
        auth.signInWithEmailAndPassword(email.trim(), password).await()
    }

    fun googleLogin(activity: Context) = operation {
        val manager = CredentialManager.create(activity)
        val option = GetSignInWithGoogleOption.Builder(activity.getString(R.string.default_web_client_id)).build()
        val result = manager.getCredential(activity, GetCredentialRequest.Builder().addCredentialOption(option).build())
        val credential = result.credential
        require(credential is CustomCredential && credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL)
        val token = GoogleIdTokenCredential.createFrom(credential.data).idToken
        auth.signInWithCredential(GoogleAuthProvider.getCredential(token, null)).await()
    }

    fun resetPassword(email: String) = operation {
        require(email.trim().isNotBlank()) { "Escribe primero el correo de tu cuenta." }
        auth.sendPasswordResetEmail(email.trim()).await()
        mutable.update { it.copy(message = "Si existe una cuenta compatible, recibirás un correo para recuperar el acceso. Si usas Google, entra con Google.") }
    }

    fun signOut(context: Context) {
        // Remove private UI immediately; stale callbacks are rejected by their generation.
        generation++; profileListener?.remove(); progressListener?.remove()
        auth.signOut(); mutable.value = AccountState()
        viewModelScope.launch { try { CredentialManager.create(context).clearCredentialState(ClearCredentialStateRequest()) } catch (_: Exception) { /* Firebase session is already closed. */ } }
    }

    fun toggleFavourite(id: String) = editFavourites { current -> if (id in current) current - id else current + id }
    fun importGuest(ids: Set<String>) = editFavourites { it + ids }
    private fun editFavourites(change: (Set<String>) -> Set<String>) {
        val uid = auth.currentUser?.uid ?: return
        val epoch = generation
        if (mutable.value.busy) return
        if (!mutable.value.favouritesReady || mutable.value.fromCache) {
            mutable.update { it.copy(message = "Conéctate y espera a que termine la consulta de tus favoritos antes de cambiarlos.") }
            return
        }
        operation {
            val ref = db.collection("userProgress").document(uid)
            db.runTransaction { transaction ->
                check(same(uid, epoch)) { "La sesión cambió. Vuelve a iniciar sesión." }
                val snapshot = transaction.get(ref)
                val current = AccountPolicy.favourites(snapshot.data)
                val next = change(current)
                val payload = AccountPolicy.update(uid, snapshot.data, next, FieldValue.serverTimestamp())
                // Update only owned fields on existing documents, preserving every web field.
                if (snapshot.exists()) transaction.update(ref, mapOf("favorites" to payload["favorites"], "updatedAt" to payload["updatedAt"]))
                else transaction.set(ref, payload)
                next
            }.await().also { next -> if (same(uid, epoch)) mutable.update { it.copy(favourites = next, message = "Favoritos guardados en tu cuenta.") } }
        }
    }

    private fun operation(work: suspend () -> Unit) {
        if (mutable.value.busy) return
        val epoch = generation
        mutable.update { it.copy(busy = true, message = null) }
        viewModelScope.launch {
            try { work() }
            catch (cancelled: CancellationException) { throw cancelled }
            catch (_: GetCredentialCancellationException) { /* User dismissed the account selector. */ }
            catch (error: Exception) { if (generation == epoch) mutable.update { it.copy(message = authError(error)) } }
            finally { if (generation == epoch) mutable.update { it.copy(busy = false) } }
        }
    }
    override fun onCleared() { auth.removeAuthStateListener(authListener); profileListener?.remove(); progressListener?.remove(); super.onCleared() }
}

private fun authError(error: Exception): String {
    if (error is FirebaseFirestoreException) return "No pudimos guardar los cambios. Comprueba la conexión y reintenta. Tus datos anteriores se conservan."
    if (error is FirebaseNetworkException) return "No pudimos conectar. Comprueba tu conexión e inténtalo de nuevo."
    if (error is IllegalArgumentException || error is IllegalStateException) return error.message ?: "No pudimos completar la solicitud."
    return when ((error as? FirebaseAuthException)?.errorCode) {
        "ERROR_INVALID_CREDENTIAL", "ERROR_WRONG_PASSWORD", "ERROR_USER_NOT_FOUND", "ERROR_INVALID_EMAIL" -> "No pudimos ingresar. Revisa el correo, la contraseña y el método que usas en la web."
        "ERROR_USER_DISABLED" -> "Esta cuenta está deshabilitada. Contacta con VisitaLoja."
        "ERROR_ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL", "ERROR_CREDENTIAL_ALREADY_IN_USE" -> "Este correo ya utiliza otro método de acceso. Ingresa como lo haces en la web para conservar tu información."
        "ERROR_TOO_MANY_REQUESTS" -> "Hay demasiados intentos. Espera unos minutos."
        else -> "No pudimos completar el acceso. Si usas Google, verifica que la versión de Android esté autorizada en Firebase. Puedes volver a intentarlo."
    }
}
