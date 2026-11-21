package com.visitaloja.app

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.Timestamp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

internal data class AdminRewardResult(val id: String, val raw: Map<String, Any?>)
internal object AdminRewardResultPolicy {
    val statuses = linkedMapOf("pending" to "Pendiente", "delivered" to "Entregado", "cancelled" to "Anulado")
    fun collection(kind: String): String = when (kind) { "classic" -> "missionRewardClaims"; "passport" -> "passportCompletions"; else -> error("Tipo de informe no válido.") }
    fun validCampaign(value: String) = value.matches(Regex("[A-Za-z0-9_-]{1,60}"))
    fun allowed(kind: String, before: String, after: String): Boolean = when (kind) {
        "classic" -> before in statuses && after in setOf("delivered", "cancelled") && before != after
        "passport" -> before in setOf("pending", "delivered") && after in setOf("pending", "delivered") && before != after
        else -> false
    }
    fun millis(value: Any?) = if (value is Timestamp) value.toDate().time else timeMillis(value)
    fun date(value: Any?): String = millis(value)?.let { DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(ZoneId.of("America/Guayaquil")).format(Instant.ofEpochMilli(it)) }.orEmpty()
    fun reward(row: Map<String, Any?>) = row.map("rewardSnapshot").text("title").ifBlank { row.text("rewardTitle") }
    fun filtered(rows: List<AdminRewardResult>, query: String, status: String, mode: String): List<AdminRewardResult> {
        val key = PlacePolicy.normalize(query.trim())
        return rows.filter { (status.isBlank() || it.raw.text("status") == status) && (mode.isBlank() || it.raw.text("mode") == mode) &&
            (key.isBlank() || PlacePolicy.normalize(listOf(it.id, it.raw.text("claimCode"), it.raw.text("userName"), it.raw.text("userEmail"), it.raw.text("userWhatsapp"), reward(it.raw)).joinToString(" ")).contains(key))
        }.sortedByDescending { millis(it.raw["createdAt"] ?: it.raw["completedAt"]) ?: Long.MIN_VALUE }
    }
    private fun cell(value: String): String {
        val normalized = value.replace('\u0000', ' ')
        val safe = if (normalized.trimStart().firstOrNull() in setOf('=', '+', '-', '@')) "'$normalized" else normalized
        return "\"${safe.replace("\"", "\"\"")}\""
    }
    fun csv(kind: String, campaign: String, rows: List<AdminRewardResult>): String {
        val columns = listOf("Tipo", "Campaña", "ID", "Código", "Estado", "Modalidad", "Visitante", "Correo", "WhatsApp", "Premio", "Negocio de entrega UID", "Patrocinador", "Registro (Loja)", "Procesado (Loja)", "Procesado por")
        val values = rows.map { item -> val r = item.raw; val passport = kind == "passport"
            listOf(if (passport) "Pasaporte" else "Chabaquito clásico", campaign, item.id, r.text("claimCode"), statuses[r.text("status")] ?: r.text("status"), r.text("mode"), r.text("userName"), r.text("userEmail"), r.text("userWhatsapp"), reward(r), r.text("merchantUid"), r.text("sponsorName"), date(r["createdAt"] ?: r["completedAt"]), date(r[if (passport) "deliveredAt" else "processedAt"]), r.text(if (passport) "deliveredBy" else "processedBy"))
        }
        return "\uFEFF" + (listOf(columns) + values).joinToString("\r\n") { it.joinToString(",", transform = ::cell) }
    }
}
private class RewardResultsDenied : IllegalStateException("Necesitas una sesión con administración general.")
internal data class AdminRewardResultsState(val uid: String? = null, val kind: String = "classic", val campaign: String = "", val ready: Boolean = false, val busy: Boolean = false,
    val rows: List<AdminRewardResult> = emptyList(), val complete: Boolean = false, val message: String? = null)
internal class AdminRewardResultsViewModel(app: Application) : AndroidViewModel(app) {
    private val auth = FirebaseAuth.getInstance(); private val db = FirebaseFirestore.getInstance()
    private val mutable = MutableStateFlow(AdminRewardResultsState()); val state = mutable.asStateFlow(); private var epoch = 0; private var cursor: DocumentSnapshot? = null; private var pendingExport: Pair<String, Set<String>>? = null
    private fun same(uid: String, version: Int) = epoch == version && auth.currentUser?.uid == uid && mutable.value.uid == uid
    private suspend fun authorize(uid: String) {
        val user = auth.currentUser?.takeIf { it.uid == uid } ?: throw RewardResultsDenied()
        val claims = user.getIdToken(true).await().claims
        if (!AdminPlacePolicy.allowed(user.email, claims, emptyMap()) && !AdminPlacePolicy.allowed(user.email, claims, db.collection("adminUsers").document(uid).get(Source.SERVER).await().data.orEmpty())) throw RewardResultsDenied()
    }
    fun bind(uid: String?, kind: String = "classic", campaign: String = "", notice: String? = null) {
        val version = ++epoch; cursor = null; pendingExport = null; mutable.value = AdminRewardResultsState(uid = uid, kind = kind, busy = uid != null); if (uid == null) return
        viewModelScope.launch {
            try {
                authorize(uid); AdminRewardResultPolicy.collection(kind)
                val id = campaign.trim().ifBlank {
                    val doc = db.collection("siteContent").document(if (kind == "passport") "passport" else "chabaquito").get(Source.SERVER).await()
                    if (kind == "passport") doc.data.orEmpty().text("campaignId") else doc.data.orEmpty().map("benefit").text("campaignId").ifBlank { "misiones-2026" }
                }
                require(AdminRewardResultPolicy.validCampaign(id)) { "Escribe un ID de campaña válido, de hasta 60 caracteres." }
                val page = db.collection(AdminRewardResultPolicy.collection(kind)).whereEqualTo("campaignId", id).orderBy(FieldPath.documentId()).limit(100).get(Source.SERVER).await()
                if (same(uid, version)) { cursor = page.documents.lastOrNull(); mutable.value = AdminRewardResultsState(uid, kind, id, ready = true, rows = page.documents.map { AdminRewardResult(it.id, it.data.orEmpty()) }, complete = page.size() < 100, message = notice) }
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { if (same(uid, version)) mutable.value = mutable.value.copy(busy = false, message = e.message ?: "No se pudo consultar la campaña.") }
        }
    }
    fun more() {
        val old = mutable.value; val uid = old.uid ?: return; val after = cursor ?: return
        if (!old.ready || old.busy || old.complete || old.rows.size >= 5000) return
        val version = epoch; mutable.value = old.copy(busy = true, message = null)
        viewModelScope.launch {
            try {
                authorize(uid)
                val page = db.collection(AdminRewardResultPolicy.collection(old.kind)).whereEqualTo("campaignId", old.campaign).orderBy(FieldPath.documentId()).startAfter(after).limit(100).get(Source.SERVER).await()
                if (same(uid, version)) { cursor = page.documents.lastOrNull(); mutable.value = old.copy(rows = old.rows + page.documents.map { AdminRewardResult(it.id, it.data.orEmpty()) }, complete = page.size() < 100) }
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { if (same(uid, version)) mutable.value = if (e is RewardResultsDenied) AdminRewardResultsState(uid = uid, kind = old.kind, message = e.message) else old.copy(message = "No se pudieron cargar más registros. Actualiza la campaña antes de repetir.") }
        }
    }
    fun change(item: AdminRewardResult, next: String) {
        val old = mutable.value; val uid = old.uid ?: return; if (!old.ready || old.busy || item !in old.rows) return
        if (!AdminRewardResultPolicy.allowed(old.kind, item.raw.text("status"), next)) return
        val version = epoch; mutable.value = old.copy(busy = true, message = null)
        viewModelScope.launch {
            try {
                authorize(uid); val target = db.collection(AdminRewardResultPolicy.collection(old.kind)).document(item.id); val audit = db.collection("adminAudit").document()
                db.runTransaction { tx ->
                    check(same(uid, version)) { "La sesión cambió." }; val current = tx.get(target)
                    check(current.data == item.raw && current.getString("campaignId") == old.campaign) { "El registro cambió en otra sesión. Actualiza antes de corregirlo." }
                    check(AdminRewardResultPolicy.allowed(old.kind, current.getString("status").orEmpty(), next))
                    val patch: Map<String, Any?> = if (old.kind == "passport") mapOf("status" to next, "deliveredAt" to if (next == "delivered") FieldValue.serverTimestamp() else FieldValue.delete(), "deliveredBy" to if (next == "delivered") (auth.currentUser?.email ?: "") else FieldValue.delete())
                        else mapOf("status" to next, "processedAt" to FieldValue.serverTimestamp(), "processedBy" to (auth.currentUser?.email ?: ""))
                    tx.update(target, patch)
                    tx.set(audit, mapOf("action" to "rewards.status.updated", "module" to old.kind, "summary" to "Cambió estado administrativo de un canje", "details" to mapOf("campaignId" to old.campaign, "recordId" to item.id, "before" to item.raw.text("status"), "after" to next), "actorUid" to uid, "actorEmail" to (auth.currentUser?.email ?: ""), "createdAt" to FieldValue.serverTimestamp()))
                    Unit
                }.await()
                if (same(uid, version)) bind(uid, old.kind, old.campaign, "Estado guardado. El cupo emitido y los sellos no se han modificado. Se actualizó la primera página del informe.")
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { if (same(uid, version)) mutable.value = if (e is RewardResultsDenied) AdminRewardResultsState(uid = uid, kind = old.kind, message = e.message) else old.copy(message = if (e is IllegalStateException) e.message else "No se pudo confirmar el cambio. Actualiza el informe antes de repetir.") }
        }
    }
    fun prepareExport(ids: Set<String>): Boolean {
        val old = mutable.value
        if (!old.ready || old.busy || ids.isEmpty() || auth.currentUser?.uid != old.uid || !old.rows.map { it.id }.toSet().containsAll(ids)) return false
        pendingExport = (old.kind + "|" + old.campaign) to ids.toSet(); return true
    }
    fun cancelExport() { pendingExport = null }
    fun export(uri: Uri) {
        val old = mutable.value; val uid = old.uid ?: return
        val pending = pendingExport; pendingExport = null
        if (!old.ready || old.busy || pending == null || pending.first != old.kind + "|" + old.campaign) {
            mutable.value = old.copy(message = "La selección de exportación ya no está disponible. Vuelve a generar el informe y elegir archivo."); return
        }
        val ids = pending.second
        val rows = AdminRewardResultPolicy.filtered(old.rows.filter { it.id in ids }, "", "", ""); if (rows.size != ids.size) return
        val version = epoch; mutable.value = old.copy(busy = true, message = null)
        viewModelScope.launch {
            try {
                authorize(uid); if (!same(uid, version)) return@launch
                withContext(Dispatchers.IO) {
                    check(same(uid, version)); val text = AdminRewardResultPolicy.csv(old.kind, old.campaign, rows)
                    getApplication<Application>().contentResolver.openOutputStream(uri, "wt")?.use { it.write(text.toByteArray(Charsets.UTF_8)) } ?: error("No se pudo abrir el archivo.")
                }
                if (same(uid, version)) mutable.value = old.copy(message = "CSV guardado con ${rows.size} registros filtrados y cargados. Contiene datos de participantes y códigos; compártelo solo con personas autorizadas.")
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { if (same(uid, version)) mutable.value = if (e is RewardResultsDenied) AdminRewardResultsState(uid = uid, kind = old.kind, message = e.message) else old.copy(message = "No se pudo guardar el CSV. Revisa el archivo antes de repetir: puede haber quedado incompleto.") }
        }
    }
}
