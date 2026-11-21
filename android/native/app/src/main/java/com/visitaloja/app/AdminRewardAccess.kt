package com.visitaloja.app

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

internal object AdminRewardAccessPolicy {
    fun campaign(value: String) = value.trim().takeIf { it.matches(Regex("[A-Za-z0-9_-]{3,60}")) } ?: throw IllegalArgumentException("Usa un ID de campaña válido de 3 a 60 caracteres.")
    fun approve(uid: String, request: Map<String, Any?>, existing: Map<String, Any?>?, business: String, campaign: String): Map<String, Any?> {
        require(uid.length in 1..128 && '/' !in uid && request["uid"] == uid && request["status"] == "pending") { "La solicitud no está pendiente o su cuenta es incompatible." }
        require(business.trim().length in 1..120) { "Escribe un nombre de negocio de hasta 120 caracteres." }
        require(request["email"] is String && request.text("email").length in 1..254 && request["displayName"] is String && request.text("displayName").length <= 100) { "La identidad de la solicitud es incompatible. Revísala en la web." }
        require(existing?.get("uid") == null || existing?.get("uid") == uid) { "La identidad del negocio no coincide." }
        require(existing?.get("active") == null || existing?.get("active") is Boolean) { "Estado de negocio incompatible." }
        val raw = existing?.get("campaignIds")
        require(raw == null || raw is List<*> && raw.all { it is String } && raw.size <= 1000) { "La lista de permisos es incompatible." }
        val campaigns = ((raw as? List<*>)?.filterIsInstance<String>().orEmpty() + AdminRewardAccessPolicy.campaign(campaign)).distinct()
        require(campaigns.size <= 1000) { "La cuenta ya tiene demasiados permisos." }
        val result = mutableMapOf<String, Any?>("businessName" to business.trim(), "campaignIds" to campaigns, "active" to (if (existing == null) true else existing["active"] == true))
        if (existing == null) result.putAll(mapOf("uid" to uid, "email" to request.text("email"), "displayName" to request.text("displayName")))
        return result
    }
}
internal data class AdminRewardAccessState(val uid: String? = null, val busy: Boolean = false, val ready: Boolean = false, val campaign: String = "",
    val requests: Map<String, Map<String, Any?>> = emptyMap(), val merchants: Map<String, Map<String, Any?>> = emptyMap(), val message: String? = null)
internal class AdminRewardAccessViewModel : ViewModel() {
    private val auth = FirebaseAuth.getInstance(); private val db = FirebaseFirestore.getInstance()
    private val mutable = MutableStateFlow(AdminRewardAccessState()); val state = mutable.asStateFlow(); private var epoch = 0
    private fun same(uid: String, version: Int) = epoch == version && auth.currentUser?.uid == uid && mutable.value.uid == uid
    private suspend fun authorize(uid: String) {
        val user = auth.currentUser?.takeIf { it.uid == uid } ?: error("La sesión cambió.")
        val claims = user.getIdToken(true).await().claims
        check(AdminPlacePolicy.allowed(user.email, claims, emptyMap()) || AdminPlacePolicy.allowed(user.email, claims, db.collection("adminUsers").document(uid).get(Source.SERVER).await().data.orEmpty())) { "Necesitas administración general." }
    }
    private suspend fun rows(collection: String, uid: String, version: Int): Map<String, Map<String, Any?>> {
        val rows = linkedMapOf<String, Map<String, Any?>>(); var cursor: DocumentSnapshot? = null; var more: Boolean
        do {
            var query: Query = db.collection(collection).orderBy(FieldPath.documentId()).limit(100); cursor?.let { query = query.startAfter(it) }
            val page = query.get(Source.SERVER).await(); check(same(uid, version)) { "La sesión cambió." }
            page.documents.forEach { rows[it.id] = it.data.orEmpty() }; check(rows.size <= 2000) { "Más de 2000 registros en $collection. Usa la web." }
            cursor = page.documents.lastOrNull(); more = page.size() == 100
        } while (more)
        return rows
    }
    fun bind(uid: String?, notice: String? = null) {
        val version = ++epoch; mutable.value = AdminRewardAccessState(uid, busy = uid != null); if (uid == null) return
        viewModelScope.launch {
            try {
                authorize(uid)
                val config = db.collection("siteContent").document("chabaquito").get(Source.SERVER).await()
                val campaign = config.data.orEmpty().map("benefit").text("campaignId").ifBlank { "misiones-2026" }
                val requests = rows("missionRewardMerchantRequests", uid, version); val merchants = rows("missionRewardMerchants", uid, version)
                if (same(uid, version)) mutable.value = AdminRewardAccessState(uid, ready = true, campaign = campaign, requests = requests, merchants = merchants, message = notice)
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { if (same(uid, version)) mutable.value = mutable.value.copy(busy = false, message = e.message ?: "No se pudieron consultar los accesos.") }
        }
    }
    fun approve(target: String, business: String, campaignInput: String) {
        val old = mutable.value; val uid = old.uid ?: return; val request = old.requests[target] ?: return; if (!old.ready || old.busy) return
        val campaign = try { val id = AdminRewardAccessPolicy.campaign(campaignInput); AdminRewardAccessPolicy.approve(target, request, old.merchants[target], business, id); id }
            catch (e: Exception) { mutable.value = old.copy(message = e.message); return }
        val version = epoch; mutable.value = old.copy(busy = true, message = null)
        viewModelScope.launch {
            try {
                authorize(uid); val requestRef = db.collection("missionRewardMerchantRequests").document(target); val merchantRef = db.collection("missionRewardMerchants").document(target); val auditRef = db.collection("adminAudit").document()
                db.runTransaction { tx ->
                    check(same(uid, version)) { "La sesión cambió." }
                    val currentRequest = tx.get(requestRef); val merchant = tx.get(merchantRef); val currentCampaign = tx.get(db.collection("missionRewardCampaigns").document(campaign))
                    check(currentRequest.data == request && merchant.data == old.merchants[target]) { "La solicitud o los permisos cambiaron. Actualiza antes de aprobar." }
                    check(currentCampaign.exists() && (currentCampaign.get("campaignId") == null || currentCampaign.get("campaignId") == campaign)) { "La campaña no existe o es incompatible. Configúrala antes de autorizar entregas." }
                    val patch = AdminRewardAccessPolicy.approve(target, currentRequest.data.orEmpty(), merchant.data, business, campaign).toMutableMap()
                    patch["updatedAt"] = FieldValue.serverTimestamp(); patch["updatedBy"] = auth.currentUser?.email ?: ""
                    if (!merchant.exists()) patch["createdAt"] = FieldValue.serverTimestamp()
                    tx.set(merchantRef, patch, SetOptions.merge())
                    tx.update(requestRef, mapOf("status" to "approved", "approvedAt" to FieldValue.serverTimestamp(), "approvedBy" to (auth.currentUser?.email ?: "")))
                    tx.set(auditRef, audit(uid, "reward-access.approved", target, campaign))
                    Unit
                }.await()
                if (same(uid, version)) bind(uid, "Solicitud aprobada para $campaign. Se conservaron otros permisos y cualquier inactividad previa de la cuenta.")
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { if (same(uid, version)) mutable.value = old.copy(message = if (e is IllegalStateException || e is IllegalArgumentException) e.message else "No se pudo confirmar la aprobación. Actualiza antes de repetir.") }
        }
    }
    private fun audit(uid: String, action: String, target: String, campaign: String = "") = mapOf("action" to action, "module" to "reward-access", "summary" to "Actualizó acceso de negocio a recompensas", "details" to mapOf("merchantUid" to target, "campaignId" to campaign), "actorUid" to uid, "actorEmail" to (auth.currentUser?.email ?: ""), "createdAt" to FieldValue.serverTimestamp())
    fun toggle(target: String, active: Boolean) {
        val old = mutable.value; val uid = old.uid ?: return; val merchant = old.merchants[target] ?: return
        if (!old.ready || old.busy || merchant["active"] == active) return
        val version = epoch; mutable.value = old.copy(busy = true, message = null)
        viewModelScope.launch {
            try {
                authorize(uid); val targetRef = db.collection("missionRewardMerchants").document(target); val event = db.collection("adminAudit").document()
                db.runTransaction { tx ->
                    check(same(uid, version)) { "La sesión cambió." }; val current = tx.get(targetRef)
                    check(current.data == merchant) { "La cuenta o sus permisos cambiaron. Actualiza antes de continuar." }
                    tx.update(targetRef, mapOf("active" to active, "updatedAt" to FieldValue.serverTimestamp(), "updatedBy" to (auth.currentUser?.email ?: "")))
                    tx.set(event, audit(uid, if (active) "reward-access.activated" else "reward-access.suspended", target)); Unit
                }.await()
                if (same(uid, version)) bind(uid, if (active) "Estado compartido de la cuenta reactivado. Se conservan sus asignaciones." else "Estado compartido de la cuenta suspendido. No se borraron asignaciones ni canjes.")
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { if (same(uid, version)) mutable.value = old.copy(message = if (e is IllegalStateException) e.message else "No se pudo confirmar el cambio. Actualiza antes de repetir.") }
        }
    }
}
