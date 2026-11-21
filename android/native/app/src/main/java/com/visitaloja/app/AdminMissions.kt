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
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.util.UUID

internal data class MissionEdit(val id: String, val original: Map<String, Any?>?, val text: Map<String, String>)
internal data class AdminMissionRow(val id: String, val data: Map<String, Any?>)
internal object AdminMissionPolicy {
    val statuses = linkedMapOf("draft" to "Borrador", "active" to "Activa", "paused" to "Pausada", "archived" to "Archivada")
    val types = linkedMapOf("unique_places" to "Lugares diferentes", "total_visits" to "Total de visitas validadas", "place_visits" to "Paradas específicas", "category_visits" to "Categorías", "canton_visits" to "Cantones diferentes")
    val rarities = linkedMapOf("common" to "Común", "uncommon" to "Poco común", "rare" to "Rara", "epic" to "Épica", "legendary" to "Legendaria")
    val fields = linkedMapOf("title" to ("Título" to 100), "description" to ("Descripción" to 500), "targetCount" to ("Meta · 1 a 500" to 3),
        "scope" to ("IDs o categorías · uno por línea" to 13000), "badge.title" to ("Nombre de insignia" to 80), "badge.description" to ("Descripción de insignia" to 240), "badge.icon" to ("Icono de insignia" to 16), "badge.imageUrl" to ("Imagen de insignia · enlace opcional" to 1000),
        "startsAt" to ("Inicio opcional · AAAA-MM-DDTHH:MM · hora de Loja" to 40), "endsAt" to ("Fin opcional · AAAA-MM-DDTHH:MM · hora de Loja" to 40))
    private val zone = ZoneId.of("America/Guayaquil")
    fun dateInput(value: Any?, end: Boolean = false): String = when (value) {
        null, "" -> ""
        is Timestamp -> LocalDateTime.ofInstant(value.toDate().toInstant(), zone).toString()
        is Number -> LocalDateTime.ofInstant(Instant.ofEpochMilli(value.toLong()), zone).toString()
        is String -> if (Regex("\\d{4}-\\d{2}-\\d{2}").matches(value)) value + if (end) "T23:59" else "T00:00" else runCatching { LocalDateTime.ofInstant(Instant.parse(value), zone).toString() }.getOrElse { LocalDateTime.parse(value).toString() }
        else -> error("Fecha incompatible. Revísala en la web.")
    }
    fun date(value: String): String? = if (value.isBlank()) null else runCatching { LocalDateTime.parse(value.trim()).atZone(zone).toInstant().toString() }.getOrElse {
        runCatching { LocalDate.parse(value.trim()).atStartOfDay(zone).toInstant().toString() }.getOrElse { error("Fecha: usa AAAA-MM-DDTHH:MM en hora de Loja.") }
    }
    fun draft(id: String, base: Map<String, Any?>?): MissionEdit {
        val row = base.orEmpty()
        require(row["id"] == null || row["id"] == id) { "El ID guardado no coincide con la misión. Revísalo en la web." }
        val count = row["targetCount"]
        require(count == null || count is Number && count.toDouble().isFinite() && count.toDouble() % 1.0 == 0.0 && count.toDouble() in 1.0..500.0) { "Meta incompatible. Revísala en la web." }
        val badge = AdminPlatformPolicy.map(row["badge"])
        require(listOf("title", "description", "icon", "imageUrl", "rarity").all { badge[it] == null || badge[it] is String }) { "Insignia incompatible. Revísala en la web." }
        val type = row.text("type").ifBlank { "unique_places" }
        val key = when (type) { "place_visits" -> "placeIds"; "category_visits" -> "categoryIds"; "canton_visits" -> "cantonIds"; else -> "" }
        val scope = row[key]
        require(scope == null || scope is List<*> && scope.all { it is String }) { "Alcance incompatible. Revísalo en la web." }
        val text = fields.keys.associateWith { field -> when {
            field == "scope" -> (scope as? List<*>)?.joinToString("\n").orEmpty()
            field == "targetCount" -> (row[field] as? Number)?.toInt()?.toString() ?: "1"
            field == "startsAt" || field == "endsAt" -> dateInput(row[field], field == "endsAt")
            field.startsWith("badge.") -> badge.text(field.substringAfter('.'))
            else -> row.text(field)
        } }.toMutableMap()
        text["status"] = row.text("status").ifBlank { "draft" }; text["type"] = type
        text["badge.rarity"] = badge.text("rarity").ifBlank { "common" }; if (text["badge.icon"].isNullOrBlank()) text["badge.icon"] = "🏅"
        return MissionEdit(id, base, text)
    }
    fun patch(draft: MissionEdit): Map<String, Any?> {
        require(draft.id.matches(Regex("[A-Za-z0-9_-]{6,64}"))) { "ID: usa 6 a 64 letras, números, guiones o guion bajo." }
        val text = draft.text; val type = text["type"].orEmpty(); val status = text["status"].orEmpty()
        require(type in types && status in statuses && text["badge.rarity"].orEmpty() in rarities) { "Revisa tipo, estado y rareza." }
        require(fields.all { (key, info) -> text[key].orEmpty().length <= info.second }) { "Uno de los campos supera su longitud permitida." }
        require(listOf("title", "description", "badge.title", "badge.description").all { text[it].orEmpty().isNotBlank() }) { "Completa título, descripción y datos de la insignia." }
        val target = text["targetCount"]?.toIntOrNull()?.takeIf { it in 1..500 } ?: error("La meta debe ser un entero entre 1 y 500.")
        val scope = text["scope"].orEmpty().split(Regex("[,\\r\\n]+" )).map(String::trim).filter(String::isNotEmpty).distinctBy { it.lowercase(java.util.Locale.ROOT) }
        val max = when (type) { "place_visits" -> 100; "category_visits" -> 50; "canton_visits" -> 32; else -> 100 }
        require(scope.size <= max && scope.all { it.length <= 120 && !it.any(Char::isISOControl) }) { "Revisa el alcance: máximo $max valores de hasta 120 caracteres." }
        require(type in setOf("total_visits", "unique_places") || scope.isNotEmpty()) { "Añade al menos un valor al alcance." }
        require(type !in setOf("place_visits", "canton_visits") || target <= scope.size) { "La meta no puede superar la cantidad de paradas o cantones únicos indicados." }
        val initial = draft.original?.let { AdminMissionPolicy.draft(draft.id, it).text }.orEmpty()
        val badge = AdminPlatformPolicy.map(draft.original?.get("badge")).toMutableMap()
        listOf("title", "description", "icon", "imageUrl", "rarity").forEach { key -> badge[key] = text["badge.$key"].orEmpty().trim().let { if (key == "icon" && it.isEmpty()) "🏅" else it } }
        require(badge.text("imageUrl").isBlank() || DiscoveryPolicy.media(badge.text("imageUrl")) != null) { "Revisa el enlace de imagen de insignia." }
        val result = mutableMapOf<String, Any?>("id" to draft.id, "title" to text.getValue("title").trim(), "description" to text.getValue("description").trim(), "targetCount" to target, "type" to type, "status" to status, "badge" to badge)
        // Preserve campaign links and unedited scheduling/scope fields on existing definitions.
        if (draft.original == null) { result["rewardType"] = "digital"; result["physicalCampaignId"] = null; result["version"] = 1 }
        if (draft.original == null || type != initial["type"] || text["scope"] != initial["scope"]) {
            result["placeIds"] = if (type == "place_visits") scope else emptyList<String>()
            result["categoryIds"] = if (type == "category_visits") scope else emptyList<String>()
            result["cantonIds"] = if (type == "canton_visits") scope else emptyList<String>()
        }
        listOf("startsAt", "endsAt").forEach { key -> if (draft.original == null || text[key] != initial[key]) result[key] = date(text[key].orEmpty()) }
        val start = date(text["startsAt"].orEmpty()); val end = date(text["endsAt"].orEmpty())
        require(start == null || end == null || Instant.parse(end).isAfter(Instant.parse(start))) { "El fin debe ser posterior al inicio." }
        if (status == "active" && (draft.original == null || initial["status"] != "active" || text["_activate"] == "true")) { result["active"] = true; result["hidden"] = false }
        return result
    }
}
internal data class AdminMissionState(val uid: String? = null, val busy: Boolean = false, val ready: Boolean = false,
    val rows: List<AdminMissionRow> = emptyList(), val templates: List<Map<String, Any?>> = emptyList(), val draft: MissionEdit? = null,
    val localDrafts: List<LocalAdminDraft> = emptyList(), val message: String? = null)
internal class AdminMissionsViewModel(app: Application) : AndroidViewModel(app) {
    private val auth = FirebaseAuth.getInstance(); private val db = FirebaseFirestore.getInstance()
    private val mutable = MutableStateFlow(AdminMissionState()); val state = mutable.asStateFlow(); private var epoch = 0
    private fun same(uid: String, version: Int) = epoch == version && auth.currentUser?.uid == uid && mutable.value.uid == uid
    private fun ref(id: String) = db.collection("chabaquitoMissions").document(id)
    private suspend fun authorize(uid: String) {
        val user = auth.currentUser?.takeIf { it.uid == uid } ?: error("La sesión cambió.")
        val claims = user.getIdToken(true).await().claims
        check(AdminPlacePolicy.allowed(user.email, claims, emptyMap()) || AdminPlacePolicy.allowed(user.email, claims, db.collection("adminUsers").document(uid).get(Source.SERVER).await().data.orEmpty())) { "Necesitas administración general." }
    }
    fun bind(uid: String?, notice: String? = null) {
        val version = ++epoch; mutable.value = AdminMissionState(uid, busy = uid != null); if (uid == null) return
        viewModelScope.launch {
            try {
                authorize(uid)
                val templates = withContext(Dispatchers.IO) { getApplication<Application>().assets.open("admin-mission-templates.json").bufferedReader().use { AdminPhotoPolicy.rows(AdminLocalDrafts.value(JSONArray(it.readText()))) } }
                val rows = mutableListOf<AdminMissionRow>(); var cursor: DocumentSnapshot? = null; var more: Boolean
                do {
                    var query: Query = db.collection("chabaquitoMissions").orderBy(FieldPath.documentId()).limit(100); cursor?.let { query = query.startAfter(it) }
                    val page = query.get(Source.SERVER).await(); if (!same(uid, version)) return@launch
                    rows += page.documents.map { AdminMissionRow(it.id, it.data.orEmpty()) }; check(rows.size <= 1000) { "Hay más de 1000 misiones. Usa la web." }
                    cursor = page.documents.lastOrNull(); more = page.size() == 100
                } while (more)
                if (same(uid, version)) mutable.value = AdminMissionState(uid, ready = true, rows = rows, templates = templates, message = notice)
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { if (same(uid, version)) mutable.value = mutable.value.copy(busy = false, message = e.message ?: "No se pudieron cargar las misiones.") }
        }
    }
    fun select(id: String? = null, template: String? = null) {
        val old = mutable.value; if (!old.ready || old.busy || old.draft != null || auth.currentUser?.uid != old.uid) return
        try {
            val base = old.rows.firstOrNull { it.id == id }?.data
            val sample = old.templates.firstOrNull { it.text("id") == template }
            val key = id ?: sample?.text("id") ?: ("mission-" + UUID.randomUUID())
            require(sample == null || old.rows.none { it.id == key }) { "Esa plantilla ya tiene una misión con el mismo ID. Ábrela desde el catálogo para editarla." }
            var draft = AdminMissionPolicy.draft(key, base ?: sample)
            if (sample != null) draft = draft.copy(original = null, text = draft.text + ("status" to "draft"))
            mutable.value = old.copy(draft = draft, message = null)
        } catch (e: Exception) { mutable.value = old.copy(message = e.message) }
    }
    fun edit(key: String, value: String) {
        val old = mutable.value; val draft = old.draft ?: return; if (old.busy || auth.currentUser?.uid != old.uid) return
        mutable.value = old.copy(draft = if (key == "id") { if (draft.original == null) draft.copy(id = value.take(64)) else draft } else draft.copy(text = draft.text + (key to value)), message = null)
    }
    fun dismiss() { if (!mutable.value.busy) mutable.value = mutable.value.copy(draft = null) }
    fun save() {
        val old = mutable.value; val uid = old.uid ?: return; val draft = old.draft ?: return; if (!old.ready || old.busy) return
        val patch = try { AdminMissionPolicy.patch(draft) } catch (e: Exception) { mutable.value = old.copy(message = e.message); return }
        val version = epoch; mutable.value = old.copy(busy = true, message = null)
        viewModelScope.launch {
            try {
                authorize(uid); val target = ref(draft.id); val audit = db.collection("adminAudit").document()
                db.runTransaction { tx ->
                    check(same(uid, version)) { "La sesión cambió." }; val current = tx.get(target)
                    check(current.data == draft.original) { "La misión cambió en otra sesión o ya existe ese ID. Guarda un borrador y actualiza antes de revisar." }
                    tx.set(target, patch + mapOf("updatedAt" to FieldValue.serverTimestamp(), "updatedBy" to (auth.currentUser?.email ?: "")), SetOptions.merge())
                    tx.set(audit, mapOf("action" to "missions.updated", "module" to "missions", "summary" to "Guardó definición de misión Chabaquito V2", "details" to mapOf("missionId" to draft.id, "status" to patch["status"]), "actorUid" to uid, "actorEmail" to (auth.currentUser?.email ?: ""), "createdAt" to FieldValue.serverTimestamp()))
                    Unit
                }.await()
                if (same(uid, version)) bind(uid, "Misión guardada. El progreso y las insignias existentes no se han modificado.")
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { if (same(uid, version)) mutable.value = old.copy(message = if (e is IllegalStateException || e is IllegalArgumentException) e.message else "No se pudo confirmar el guardado. Guarda un borrador y actualiza antes de repetir.") }
        }
    }
    fun local(action: String, id: String? = null) {
        val old = mutable.value; val uid = old.uid ?: return; if (!old.ready || old.busy || auth.currentUser?.uid != uid) return
        val version = epoch; mutable.value = old.copy(busy = true, message = null)
        viewModelScope.launch {
            try {
                var restored: LocalAdminDraft? = null
                val rows = withContext(Dispatchers.IO) {
                    val app: Application = getApplication()
                    when (action) {
                        "save" -> { val draft = old.draft ?: error("Abre una misión."); AdminLocalDrafts.save(app, uid, "missions", draft.id, draft.text["title"].orEmpty().ifBlank { draft.id }, draft.original, JSONObject(draft.text).put("_id", draft.id).put("_wasNew", (draft.original == null).toString())) }
                        "restore" -> restored = AdminLocalDrafts.load(app, uid, "missions", id ?: error("Elige un borrador."))
                        "delete" -> AdminLocalDrafts.remove(app, uid, "missions", id ?: error("Elige un borrador."))
                        "list" -> Unit
                        else -> error("Acción incompatible.")
                    }; AdminLocalDrafts.list(app, uid, "missions")
                }
                if (!same(uid, version)) return@launch
                val saved = restored
                if (saved == null) mutable.value = old.copy(localDrafts = rows, message = when (action) { "save" -> "Borrador guardado en este teléfono, sin publicar."; "delete" -> "Borrador local eliminado."; else -> null })
                else {
                    val text = AdminLocalDrafts.strings(saved.data); val key = text.getValue("_id"); require(key.length in 1..64)
                    val base = old.rows.firstOrNull { it.id == key }?.data
                    require(text["_wasNew"] != "true" || base == null) { "Ya existe una misión con el ID de este borrador nuevo. Ábrela desde el catálogo; el borrador local se conserva." }
                    val draft = AdminMissionPolicy.draft(key, base).copy(text = text - setOf("_id", "_wasNew"))
                    mutable.value = old.copy(draft = draft, localDrafts = rows, message = if (saved.fingerprint != AdminLocalDrafts.fingerprint(base)) "Borrador recuperado. La misión publicada cambió: revisa meta, alcance y estado antes de guardar." else "Borrador recuperado sin publicar.")
                }
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { if (same(uid, version)) mutable.value = old.copy(message = e.message ?: "No se pudo gestionar el borrador.") }
        }
    }
}
