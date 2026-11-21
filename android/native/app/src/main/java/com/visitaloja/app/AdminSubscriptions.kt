package com.visitaloja.app

import android.app.Application
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
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId

internal data class SubscriptionEdit(val id: String, val base: Map<String, Any?>, val text: Map<String, String>)
internal object AdminSubscriptionPolicy {
    val statuses = linkedMapOf("active" to "Activo", "trial" to "Periodo de prueba", "pending" to "Pendiente de pago", "expired" to "Vencido", "paused" to "Suspendido")
    val filters = linkedMapOf("active" to "Activos", "expiring" to "Por vencer", "expired" to "Vencidos", "scheduled" to "Programados", "pending" to "Pago pendiente", "paused" to "Suspendidos", "review" to "Revisar datos")
    val methods = listOf("transfer", "cash", "card", "deposit", "other")
    val features = listOf("logoPin", "badge", "priority", "promo", "stats", "video", "menu")
    val zone: ZoneId = ZoneId.of("America/Guayaquil")
    fun moment(value: Any?, end: Boolean = false): Long? = when (value) {
        null, "" -> null
        is Timestamp -> value.toDate().time
        is Number -> value.toDouble().takeIf { it.isFinite() }?.toLong()
        is String -> runCatching { if (Regex("\\d{4}-\\d{2}-\\d{2}").matches(value)) LocalDate.parse(value).atTime(if (end) LocalTime.MAX else LocalTime.MIN).atZone(zone).toInstant().toEpochMilli() else runCatching { Instant.parse(value).toEpochMilli() }.getOrElse { LocalDateTime.parse(value).atZone(zone).toInstant().toEpochMilli() } }.getOrNull()
        else -> null
    }
    fun state(place: Map<String, Any?>, now: Long): String {
        if (place["subscription"] != null && place["subscription"] !is Map<*, *>) return "review"
        val s = place.map("subscription"); val status = s.text("status").ifBlank { "active" }
        if (status in setOf("paused", "suspended")) return "paused"
        if (status == "pending") return "pending"
        val startRaw = s["startAt"].takeUnless { it == "" } ?: s["startDate"]; val endRaw = s["endAt"].takeUnless { it == "" } ?: s["endDate"]
        val start = moment(startRaw); val end = moment(endRaw, true)
        if (startRaw != null && startRaw != "" && start == null || endRaw != null && endRaw != "" && end == null || start != null && end != null && start >= end) return "review"
        if (status == "expired" || end != null && end < now) return "expired"
        if (status !in setOf("active", "trial")) return "review"
        if (start != null && start > now) return "scheduled"
        if (end != null && end - now <= 7 * 86400000L) return "expiring"
        return "active"
    }
    fun paid(place: Map<String, Any?>): Boolean = AdminPlanPolicy.canonical(place.map("subscription").text("plan").ifBlank { "free" }) != "free"
    fun fields(): List<PlatformField> = listOf(
        PlatformField("status", "Estado administrativo", "active", "choice", options = statuses.keys.toList()),
        PlatformField("startAt", "Beneficios desde · AAAA-MM-DDTHH:MM · hora de Loja", max = 40), PlatformField("endAt", "Beneficios hasta · AAAA-MM-DDTHH:MM · hora de Loja", max = 40),
        PlatformField("contactName", "Contacto del negocio", max = 100), PlatformField("contactWhatsapp", "WhatsApp del contacto · opcional, código de país", max = 20),
        PlatformField("monthlyAmount", "Importe registrado USD · informativo", "0", "money", 20),
        PlatformField("paymentMethod", "Método del importe registrado", "transfer", "choice", options = methods), PlatformField("paymentNotes", "Referencia u observaciones", max = 240)) + features.map { PlatformField("b|$it", AdminPlanPolicy.services[it] ?: it, "false", "bool") }
    fun read(id: String, base: Map<String, Any?>): SubscriptionEdit {
        val s = AdminPlatformPolicy.map(base["subscription"]); require(s["plan"] == null || s["plan"] is String) { "Plan con formato incompatible. Revísalo en la web." }; val benefits = AdminPlatformPolicy.map(s["benefits"])
        val text = fields().associate { field -> val key = field.key
            val value = when {
                key.startsWith("b|") -> { val raw = benefits[key.substringAfter('|')]; require(raw == null || raw is Boolean); (raw == true).toString() }
                key == "startAt" || key == "endAt" -> {
                    val raw = s[key].takeUnless { it == "" } ?: s[if (key == "startAt") "startDate" else "endDate"]
                    require(raw !is Number || raw.toDouble().isFinite()) { "Fecha incompatible. Revísala en la web." }
                    AdminMissionPolicy.dateInput(raw, key == "endAt")
                }
                key == "monthlyAmount" -> { require(s[key] == null || s[key] is Number || s[key] is String); s[key]?.toString() ?: "0" }
                else -> { require(s[key] == null || s[key] is String); s[key] as? String ?: field.fallback }
            }; key to value
        } + ("plan" to s.text("plan").ifBlank { "free" })
        return SubscriptionEdit(id, base, text)
    }
    fun patch(draft: SubscriptionEdit, plans: List<Map<String, Any?>>): Map<String, Any?> {
        val initial = read(draft.id, draft.base).text; require(draft.text.keys == initial.keys)
        val old = AdminPlatformPolicy.map(draft.base["subscription"]); val result = old.toMutableMap(); val benefits = AdminPlatformPolicy.map(old["benefits"]).toMutableMap()
        val plan = draft.text.getValue("plan")
        if (plan != initial["plan"]) require(plans.any { it.text("id") == plan && it["active"] != false }) { "Elige un plan visible del catálogo actual." }
        result["plan"] = plan
        val start = AdminMissionPolicy.date(draft.text["startAt"].orEmpty()); val end = AdminMissionPolicy.date(draft.text["endAt"].orEmpty())
        require(start == null || end == null || Instant.parse(end).isAfter(Instant.parse(start))) { "El fin debe ser posterior al inicio." }
        fields().filter { draft.text[it.key] != initial[it.key] }.forEach { field ->
            val value = draft.text.getValue(field.key); require(value.length <= field.max) { "Revisa " + field.label }
            when {
                field.key.startsWith("b|") -> benefits[field.key.substringAfter('|')] = AdminPlatformPolicy.parse(field, value)
                field.key == "startAt" || field.key == "endAt" -> { result[field.key] = AdminMissionPolicy.date(value).orEmpty(); result.remove(if (field.key == "startAt") "startDate" else "endDate") }
                field.key == "contactWhatsapp" -> { val phone = value.filter(Char::isDigit); require(phone.isBlank() || phone.length in 10..15 && !phone.startsWith("0")) { "WhatsApp: incluye código de país." }; result[field.key] = phone }
                field.key == "monthlyAmount" -> result[field.key] = AdminPlanPolicy.money(value)
                else -> result[field.key] = AdminPlatformPolicy.parse(field, value)
            }
        }
        result["benefits"] = benefits
        return result
    }
    fun renew(text: Map<String, String>, months: Int, now: Long): Map<String, String> {
        require(months in setOf(1, 3, 6, 12))
        val current = moment(AdminMissionPolicy.date(text["endAt"].orEmpty())) ?: Long.MIN_VALUE
        val base = LocalDateTime.ofInstant(Instant.ofEpochMilli(maxOf(current, now)), zone)
        return text + mapOf("startAt" to text["startAt"].orEmpty().ifBlank { LocalDateTime.ofInstant(Instant.ofEpochMilli(now), zone).toString() }, "endAt" to base.plusMonths(months.toLong()).toString(), "status" to "active")
    }
}
internal data class AdminSubscriptionState(val uid: String? = null, val ready: Boolean = false, val busy: Boolean = false, val rows: List<AdminMissionRow> = emptyList(), val complete: Boolean = false,
    val plans: List<Map<String, Any?>> = emptyList(), val plansBase: Map<String, Any?>? = null, val draft: SubscriptionEdit? = null, val localDrafts: List<LocalAdminDraft> = emptyList(), val message: String? = null)
internal class AdminSubscriptionsViewModel(app: Application) : AndroidViewModel(app) {
    private val auth = FirebaseAuth.getInstance(); private val db = FirebaseFirestore.getInstance(); private var epoch = 0; private var cursor: DocumentSnapshot? = null
    private val mutable = MutableStateFlow(AdminSubscriptionState()); val state = mutable.asStateFlow()
    private fun same(uid: String, version: Int) = epoch == version && auth.currentUser?.uid == uid && mutable.value.uid == uid
    private suspend fun authorize(uid: String) { val user = auth.currentUser?.takeIf { it.uid == uid } ?: error("La sesión cambió."); val claims = user.getIdToken(true).await().claims
        check(AdminPlacePolicy.allowed(user.email, claims, emptyMap()) || AdminPlacePolicy.allowed(user.email, claims, db.collection("adminUsers").document(uid).get(Source.SERVER).await().data.orEmpty())) { "Necesitas administración general." } }
    fun bind(uid: String?, notice: String? = null) {
        val version = ++epoch; cursor = null; mutable.value = AdminSubscriptionState(uid, busy = uid != null); if (uid == null) return
        viewModelScope.launch { try {
            authorize(uid); val catalog = withContext(Dispatchers.IO) { getApplication<Application>().assets.open("admin-plans-catalog.json").bufferedReader().use { JSONObject(it.readText()) } }
            val config = db.collection("settings").document("subscriptions").get(Source.SERVER).await(); val plans = AdminPlanPolicy.rows(config.data.orEmpty(), catalog)
            val page = db.collection("locales").orderBy(FieldPath.documentId()).limit(100).get(Source.SERVER).await()
            if (same(uid, version)) { cursor = page.documents.lastOrNull(); mutable.value = AdminSubscriptionState(uid, ready = true, rows = page.documents.map { AdminMissionRow(it.id, it.data.orEmpty()) }, complete = page.size() < 100, plans = plans, plansBase = config.data, message = notice) }
        } catch (e: CancellationException) { throw e } catch (e: Exception) { if (same(uid, version)) mutable.value = mutable.value.copy(busy = false, message = e.message ?: "No se pudieron consultar las suscripciones.") } }
    }
    fun more() {
        val old = mutable.value; val uid = old.uid ?: return; val after = cursor ?: return; if (!old.ready || old.busy || old.complete || old.rows.size >= 5000 || old.draft != null) return
        val version = epoch; mutable.value = old.copy(busy = true)
        viewModelScope.launch { try { authorize(uid); val page = db.collection("locales").orderBy(FieldPath.documentId()).startAfter(after).limit(100).get(Source.SERVER).await()
            if (same(uid, version)) { cursor = page.documents.lastOrNull(); mutable.value = old.copy(rows = old.rows + page.documents.map { AdminMissionRow(it.id, it.data.orEmpty()) }, complete = page.size() < 100) }
        } catch (e: CancellationException) { throw e } catch (_: Exception) { if (same(uid, version)) mutable.value = old.copy(message = "No se pudo cargar más. Actualiza el listado.") } }
    }
    fun select(id: String) { val old = mutable.value; if (!old.ready || old.busy || old.draft != null) return
        try { mutable.value = old.copy(draft = AdminSubscriptionPolicy.read(id, old.rows.first { it.id == id }.data), message = null) } catch (e: Exception) { mutable.value = old.copy(message = e.message) } }
    fun edit(key: String, value: String) { val old = mutable.value; val d = old.draft ?: return; if (!old.busy && key in d.text && auth.currentUser?.uid == old.uid) mutable.value = old.copy(draft = d.copy(text = d.text + (key to value)), message = null) }
    fun plan(id: String) { val old = mutable.value; val d = old.draft ?: return; if (old.busy) return; val plan = old.plans.firstOrNull { it.text("id") == id && it["active"] != false } ?: return
        val benefits = AdminPlatformPolicy.map(plan["features"]); mutable.value = old.copy(draft = d.copy(text = d.text + ("plan" to id) + AdminSubscriptionPolicy.features.associate { "b|$it" to (benefits[it] == true).toString() }), message = "Plan y servicios preparados. No se cambió el importe registrado ni se guardó una renovación.") }
    fun renew(months: Int) { val old = mutable.value; val d = old.draft ?: return; if (old.busy) return
        try { mutable.value = old.copy(draft = d.copy(text = AdminSubscriptionPolicy.renew(d.text, months, System.currentTimeMillis())), message = "Vigencia preparada y estado Activo seleccionado. Revisa y confirma; no se registró ningún pago.") } catch (e: Exception) { mutable.value = old.copy(message = e.message) } }
    fun dismiss() { if (!mutable.value.busy) mutable.value = mutable.value.copy(draft = null) }
    fun save() {
        val old = mutable.value; val uid = old.uid ?: return; val draft = old.draft ?: return; if (old.busy) return
        val patch = try { AdminSubscriptionPolicy.patch(draft, old.plans) } catch (e: Exception) { mutable.value = old.copy(message = e.message); return }
        val version = epoch; mutable.value = old.copy(busy = true, message = null)
        viewModelScope.launch { try { authorize(uid); val target = db.collection("locales").document(draft.id); val configRef = db.collection("settings").document("subscriptions"); val audit = db.collection("adminAudit").document()
            db.runTransaction { tx ->
                check(same(uid, version)); val current = tx.get(target); val config = tx.get(configRef)
                check(current.exists() && current.data == draft.base && config.data == old.plansBase) { "La parada o el catálogo cambiaron. Guarda un borrador y actualiza antes de revisar." }
                val data = mapOf("subscription" to patch, "updatedAt" to FieldValue.serverTimestamp(), "updatedBy" to (auth.currentUser?.email ?: ""))
                tx.set(target, data, SetOptions.mergeFields(data.keys.toList()))
                tx.set(audit, mapOf("action" to "subscription.updated", "module" to "subscriptions", "summary" to "Actualizó la suscripción de una parada", "details" to mapOf("placeId" to draft.id, "plan" to draft.text.getValue("plan")), "actorUid" to uid, "actorEmail" to (auth.currentUser?.email ?: ""), "createdAt" to FieldValue.serverTimestamp())); Unit
            }.await()
            if (same(uid, version)) bind(uid, "Suscripción guardada. No se cambiaron registros del historial de pagos, galería ni productos. Listado actualizado a su primera página.")
        } catch (e: CancellationException) { throw e } catch (e: Exception) { if (same(uid, version)) mutable.value = old.copy(message = if (e is IllegalStateException) e.message else "No se pudo confirmar el guardado. Actualiza antes de repetir.") } }
    }
    fun local(action: String, id: String? = null) {
        val old = mutable.value; val uid = old.uid ?: return; if (!old.ready || old.busy || auth.currentUser?.uid != uid) return; val version = epoch; mutable.value = old.copy(busy = true)
        viewModelScope.launch { try { var restored: LocalAdminDraft? = null
            val rows = withContext(Dispatchers.IO) { val app: Application = getApplication()
                when (action) {
                    "save" -> { val d = old.draft ?: error("Abre una suscripción."); AdminLocalDrafts.save(app, uid, "place-subscription", d.id, d.base.text("title"), d.base, JSONObject(d.text)) }
                    "restore" -> restored = AdminLocalDrafts.load(app, uid, "place-subscription", id ?: error("Elige un borrador."))
                    "delete" -> AdminLocalDrafts.remove(app, uid, "place-subscription", id ?: error("Elige un borrador."))
                    "list" -> Unit
                    else -> error("Acción incompatible.")
                }; AdminLocalDrafts.list(app, uid, "place-subscription") }
            if (!same(uid, version)) return@launch
            val saved = restored
            if (saved == null) mutable.value = old.copy(localDrafts = rows, message = if (action == "save") "Borrador local guardado sin publicar." else null)
            else {
                authorize(uid); val doc = db.collection("locales").document(saved.id).get(Source.SERVER).await(); check(doc.exists()) { "La parada ya no existe." }
                val d = AdminSubscriptionPolicy.read(saved.id, doc.data.orEmpty()); val text = AdminLocalDrafts.strings(saved.data); require(text.keys == d.text.keys) { "Borrador incompatible." }
                if (same(uid, version)) mutable.value = old.copy(draft = d.copy(text = text), localDrafts = rows, message = if (saved.fingerprint != AdminLocalDrafts.fingerprint(doc.data)) "Borrador recuperado. La parada cambió: revisa plan, estado y fechas antes de guardar." else "Borrador recuperado sin publicar.")
            }
        } catch (e: CancellationException) { throw e } catch (e: Exception) { if (same(uid, version)) mutable.value = old.copy(message = e.message ?: "No se pudo recuperar el borrador.") } }
    }
}
