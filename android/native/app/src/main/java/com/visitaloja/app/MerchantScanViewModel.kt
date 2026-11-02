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
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext

private data class MerchantPlace(val id: String, val name: String, val tourist: Boolean)
data class MerchantVisit(val id: String, val placeId: String, val placeName: String, val visitor: String, val status: String, val expires: Long, val tourist: Boolean)
data class MerchantScanState(val uid: String? = null, val busy: Boolean = false, val ready: Boolean = false,
    val places: List<Pair<String, String>> = emptyList(), val selected: String = "", val visit: MerchantVisit? = null, val message: String? = null)
class MerchantScanViewModel : ViewModel() {
    private val auth = FirebaseAuth.getInstance()
    private val db = FirebaseFirestore.getInstance()
    private val mutable = MutableStateFlow(MerchantScanState())
    val state = mutable.asStateFlow()
    private var generation = 0
    private var available = emptyList<MerchantPlace>()
    private fun current(uid: String, epoch: Int) = generation == epoch && auth.currentUser?.uid == uid
    fun bind(uid: String?) {
        generation++; available = emptyList(); mutable.value = MerchantScanState(uid = uid)
        if (uid != null) load(uid, generation)
    }
    private fun load(uid: String, epoch: Int) = viewModelScope.launch {
        mutable.update { it.copy(busy = true) }
        try {
            val access = db.collection("missionRewardMerchants").document(uid).get(Source.SERVER).await()
            check(current(uid, epoch))
            val ids = (access.get("placeIds") as? List<*>)?.filterIsInstance<String>()?.filter(MerchantScanPolicy::placeId)?.distinct().orEmpty()
            check(access.exists() && access.getBoolean("active") != false && ids.isNotEmpty()) { "Administración debe activar tu cuenta y asignarle una parada." }
            val rows = ids.mapNotNull { id ->
                val p = db.collection("locales").document(id).get(Source.SERVER).await()
                if (!p.exists()) null else MerchantPlace(id, p.getString("title") ?: id, p.getString("category") == "turismo")
            }
            if (!current(uid, epoch)) return@launch
            check(rows.isNotEmpty()) { "No hay paradas disponibles para esta cuenta." }
            available = rows
            mutable.update { it.copy(ready = true, places = rows.map { p -> p.id to p.name }, selected = rows.first().id, message = null) }
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (e: Exception) { if (current(uid, epoch)) mutable.update { it.copy(ready = false, message = if (e is IllegalStateException) e.message else "No pudimos verificar el acceso. Revisa tu conexión y vuelve a intentar.") } }
        finally { if (current(uid, epoch)) mutable.update { it.copy(busy = false) } }
    }
    fun select(id: String) { if (!mutable.value.busy && available.any { it.id == id }) mutable.update { it.copy(selected = id, visit = null, message = null) } }
    fun message(text: String) { mutable.update { it.copy(message = text) } }
    fun clearVisit() { if (!mutable.value.busy) mutable.update { it.copy(visit = null, message = null) } }
    fun lookup(raw: String) {
        val code = MerchantScanPolicy.code(raw) ?: run { clearVisit(); message("Este QR no es un código de visita de VisitaLoja. También puedes escribir sus seis números."); return }
        val snapshot = mutable.value
        val uid = snapshot.uid ?: return
        if (snapshot.busy || !snapshot.ready) return
        val place = available.find { it.id == snapshot.selected } ?: return
        val epoch = generation
        mutable.update { it.copy(busy = true, visit = null, message = null) }
        viewModelScope.launch {
            try {
                val access = db.collection("missionRewardMerchants").document(uid).get(Source.SERVER).await()
                check(access.exists() && access.getBoolean("active") != false && (access.get("placeIds") as? List<*>)?.contains(place.id) == true) { "Tu cuenta ya no tiene acceso a esta parada." }
                val direct = db.collection("visitCodes").document(MerchantScanPolicy.requestId(place.id, code, System.currentTimeMillis())).get(Source.SERVER).await()
                val doc: DocumentSnapshot? = if (direct.exists()) direct else db.collection("visitCodes").whereEqualTo("code", code).whereEqualTo("placeId", place.id).limit(25).get(Source.SERVER).await().documents
                    .filter { it.getString("status") == "pending" && (it.getTimestamp("expiresAt")?.toDate()?.time ?: 0) > System.currentTimeMillis() }.maxByOrNull { it.getTimestamp("createdAt")?.toDate()?.time ?: 0 }
                check(doc != null && doc.getString("code") == code && doc.getString("placeId") == place.id) { "No encontramos un código para la parada seleccionada." }
                if (!current(uid, epoch)) return@launch
                val visit = MerchantVisit(doc.id, place.id, place.name, doc.getString("userName")?.takeIf { it.isNotBlank() } ?: "Visitante", doc.getString("status").orEmpty(), doc.getTimestamp("expiresAt")?.toDate()?.time ?: 0, place.tourist)
                mutable.update { it.copy(visit = visit, message = null) }
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (e: Exception) { if (current(uid, epoch)) mutable.update { it.copy(message = if (e is IllegalStateException) e.message else "No pudimos consultar el código. Verifica la conexión y tus permisos; no se registró ningún sello desde esta consulta.") } }
            finally { if (current(uid, epoch)) mutable.update { it.copy(busy = false) } }
        }
    }
    fun confirm(kind: String, amount: String, reason: String, receipt: String) {
        val snapshot = mutable.value; val uid = snapshot.uid ?: return; val visit = snapshot.visit ?: return
        if (snapshot.busy || !snapshot.ready || !MerchantScanPolicy.confirmable(visit.status, visit.expires, visit.placeId == snapshot.selected && available.any { it.id == visit.placeId }, System.currentTimeMillis())) return
        val payload = try { MerchantScanPolicy.consumption(visit.tourist, kind, amount, reason, receipt).put("requestId", visit.id) } catch (e: IllegalArgumentException) { message(e.message ?: "Revisa el registro."); return }
        val epoch = generation
        mutable.update { it.copy(busy = true, message = null) }
        viewModelScope.launch {
            try {
                val user = auth.currentUser?.takeIf { it.uid == uid } ?: error("Sesión cambiada")
                val token = user.getIdToken(false).await().token ?: error("Sesión caducada")
                check(current(uid, epoch))
                val result = withContext(Dispatchers.IO) { NativeApi.post(MerchantScanPolicy.ENDPOINT, token, payload) }
                check(result.optBoolean("ok")) { result.optString("error") }
                if (current(uid, epoch)) mutable.update { it.copy(visit = visit.copy(status = "confirmed"), message = "Visita confirmada. Fidelidad: ${result.optInt("visitCount")} / ${result.optInt("target", 10)}. Los sellos de pasaporte que correspondan se procesan con las reglas actuales." + if (result.optBoolean("missionsPending")) " La actualización de Misiones quedó pendiente; no repitas el sello." else "") }
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (e: Exception) { if (current(uid, epoch)) mutable.update { it.copy(visit = visit.copy(status = "review"), message = MerchantScanPolicy.error(e.message.orEmpty())) } }
            finally { if (current(uid, epoch)) mutable.update { it.copy(busy = false) } }
        }
    }
}
