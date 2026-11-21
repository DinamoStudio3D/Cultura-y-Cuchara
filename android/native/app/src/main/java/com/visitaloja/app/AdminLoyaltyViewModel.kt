package com.visitaloja.app

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

internal data class AdminLoyaltyState(
    val uid: String? = null, val place: String = "", val name: String = "", val ready: Boolean = false,
    val busy: Boolean = false, val seasonalService: Boolean = false, val exists: Boolean = false,
    val base: Map<String, Any?>? = null, val draft: AdminLoyaltyDraft = AdminLoyaltyDraft(),
    val message: String? = null, val revision: Int = 0
)
internal class AdminLoyaltyViewModel : ViewModel() {
    private val auth = FirebaseAuth.getInstance()
    private val db = FirebaseFirestore.getInstance()
    private val mutable = MutableStateFlow(AdminLoyaltyState())
    val state = mutable.asStateFlow()
    private var epoch = 0
    private fun same(uid: String, version: Int) =
        epoch == version && auth.currentUser?.uid == uid && mutable.value.uid == uid
    private suspend fun authorize(uid: String) {
        val user = auth.currentUser?.takeIf { it.uid == uid } ?: error("La sesión cambió.")
        val token = user.getIdToken(true).await()
        val allowed = AdminPlacePolicy.allowed(user.email, token.claims, emptyMap()) ||
            AdminPlacePolicy.allowed(user.email, token.claims, db.collection("adminUsers").document(uid).get(Source.SERVER).await().data.orEmpty())
        check(allowed) { "Necesitas administración general para configurar programas." }
    }
    private suspend fun seasonalService(): Boolean = withContext(Dispatchers.IO) {
        val connection = URL("https://visitaloja-chabaquito.sukogames1996.workers.dev/health").openConnection() as HttpURLConnection
        try {
            connection.connectTimeout = 8000
            connection.readTimeout = 8000
            connection.instanceFollowRedirects = false
            connection.setRequestProperty("Accept", "application/json")
            if (connection.responseCode != 200) return@withContext false
            val bytes = connection.inputStream.use { it.readBytesBounded() }
            val result = JSONObject(String(bytes, Charsets.UTF_8))
            result.optString("project") == "cultura-y-cuchara" && result.optInt("loyaltySeasonPolicyVersion") == 1
        } catch (e: CancellationException) { throw e }
        catch (_: Exception) { false }
        finally { connection.disconnect() }
    }
    private fun java.io.InputStream.readBytesBounded(): ByteArray {
        val output = java.io.ByteArrayOutputStream()
        val buffer = ByteArray(2048)
        while (true) {
            val read = read(buffer)
            if (read < 0) break
            check(output.size() + read <= 16384) { "Respuesta de estado demasiado grande." }
            output.write(buffer, 0, read)
        }
        return output.toByteArray()
    }
    fun bind(uid: String?, place: String) {
        val version = ++epoch
        mutable.value = AdminLoyaltyState(uid = uid, place = place, busy = uid != null)
        if (uid == null) return
        if (!MerchantScanPolicy.placeId(place)) {
            mutable.value = mutable.value.copy(busy = false, message = "Esta parada necesita revisión de su identificador en el panel web.")
            return
        }
        viewModelScope.launch {
            try {
                authorize(uid)
                if (!same(uid, version)) return@launch
                val locale = db.collection("locales").document(place).get(Source.SERVER).await()
                check(locale.exists()) { "La parada ya no está disponible." }
                val program = db.collection("loyaltyPrograms").document(place).get(Source.SERVER).await()
                val base = program.data
                val draft = AdminLoyaltyPolicy.read(base.orEmpty())
                AdminLoyaltyPolicy.issued(base.orEmpty())
                draft.seasons.forEach { AdminLoyaltyPolicy.issued(base.orEmpty(), it.id) }
                val capability = seasonalService()
                if (same(uid, version)) mutable.value = AdminLoyaltyState(uid = uid, place = place,
                    name = locale.getString("title") ?: place, ready = true, exists = program.exists(),
                    base = base, draft = draft, seasonalService = capability,
                    message = if (capability) null else "No se pudo confirmar el soporte de temporadas. Puedes editar la tarjeta habitual; las temporadas se conservan sin cambios.")
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) {
                if (same(uid, version)) mutable.value = AdminLoyaltyState(uid = uid, place = place,
                    message = if (e is IllegalArgumentException || e is IllegalStateException) e.message else "No se pudo consultar el programa y los permisos. Actualiza para continuar.")
            }
        }
    }
    fun edit(draft: AdminLoyaltyDraft) {
        val old = mutable.value
        if (old.ready && !old.busy && (old.seasonalService || old.draft.seasons == draft.seasons))
            mutable.value = old.copy(draft = draft, message = null)
    }
    fun save() {
        val old = mutable.value
        val uid = old.uid ?: return
        if (!old.ready || old.busy) return
        val patch = try { AdminLoyaltyPolicy.patch(old.base.orEmpty(), old.draft, old.seasonalService) }
        catch (e: Exception) { mutable.value = old.copy(message = e.message ?: "Revisa el programa."); return }
        val version = epoch
        mutable.value = old.copy(busy = true, message = null)
        viewModelScope.launch {
            try {
                authorize(uid)
                if ("seasons" in patch) check(seasonalService()) { "El servicio de temporadas no está confirmado. Actualiza antes de guardar." }
                if (!same(uid, version)) return@launch
                val ref = db.collection("loyaltyPrograms").document(old.place)
                val locale = db.collection("locales").document(old.place)
                val audit = db.collection("adminAudit").document()
                db.runTransaction { tx ->
                    check(same(uid, version)) { "La sesión cambió." }
                    val current = tx.get(ref)
                    val place = tx.get(locale)
                    check(place.exists()) { "La parada ya no está disponible." }
                    check(current.data == old.base) { "El programa o sus premios cambiaron. Actualiza antes de guardar." }
                    // Only configuration is merged. Issued rewards, usage flags and counters stay intact.
                    val validated = AdminLoyaltyPolicy.patch(current.data.orEmpty(), old.draft, old.seasonalService)
                    tx.set(ref, validated + mapOf("placeId" to old.place, "placeName" to (place.getString("title") ?: old.place),
                        "updatedAt" to FieldValue.serverTimestamp(), "updatedBy" to (auth.currentUser?.email ?: "")), SetOptions.merge())
                    tx.set(audit, mapOf("action" to "loyalty.program_saved", "module" to "fidelity",
                        "summary" to "Configuró fidelidad desde Android",
                        "details" to mapOf("placeId" to old.place, "active" to old.draft.active,
                            "seasonIds" to old.draft.seasons.map { it.id }),
                        "actorUid" to uid, "actorEmail" to (auth.currentUser?.email ?: ""),
                        "createdAt" to FieldValue.serverTimestamp()))
                    Unit
                }.await()
                if (same(uid, version)) mutable.value = old.copy(ready = false, busy = false, revision = old.revision + 1,
                    message = "Programa guardado. Actualiza para consultar su estado actual. Los sellos y premios existentes se conservan.")
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) {
                if (same(uid, version)) mutable.value = old.copy(ready = false, busy = false,
                    message = if (e is IllegalStateException) e.message else
                        "No se pudo confirmar el guardado. Consulta el programa desde el servidor antes de repetir.")
            }
        }
    }
}
