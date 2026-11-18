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
import kotlinx.coroutines.withContext
import org.json.JSONObject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId

internal data class EditorialDraft(val id: String, val original: Map<String, Any?>?, val text: Map<String, String>)
internal object EditorialPolicy {
    val storyFields = linkedMapOf("title" to ("Título en español" to 140), "titleEn" to ("Título en inglés" to 140),
        "intro" to ("Introducción en español" to 450), "introEn" to ("Introducción en inglés" to 450),
        "body" to ("Relato en español" to 8000), "bodyEn" to ("Relato en inglés" to 8000),
        "category" to ("Categoría" to 100), "publishAt" to ("Publicar desde · hora de Ecuador" to 40),
        "cover" to ("Enlace de portada" to 4096), "gallery" to ("Galería · un enlace por línea" to 85000),
        "audioUrl" to ("Enlace de audio en español" to 4096), "audioUrlEn" to ("Enlace de audio en inglés" to 4096),
        "videoUrl" to ("Enlace de video" to 2000), "source" to ("Autor o fuente" to 180), "era" to ("Fecha o época" to 100),
        "lat" to ("Latitud opcional" to 40), "lng" to ("Longitud opcional" to 40))
    val enterpriseFields = linkedMapOf("name" to ("Nombre" to 140), "category" to ("Categoría" to 100),
        "phone" to ("WhatsApp con código de país" to 40), "img" to ("Enlace de imagen" to 4096), "desc" to ("Descripción" to 700))
    private val zone = ZoneId.of("America/Guayaquil")
    fun fields(kind: String) = if (kind == "stories") storyFields else enterpriseFields
    fun rows(raw: Map<String, Any?>): List<Map<String, Any?>> {
        val value = raw["items"] ?: return emptyList()
        require(value is List<*> && value.size <= 300) { "El catálogo tiene un formato o tamaño incompatible. Usa la web." }
        val rows = value.map { row ->
            require(row is Map<*, *> && row.keys.all { it is String }) { "Hay un registro incompatible. Usa la web." }
            row.entries.associate { it.key as String to it.value }
        }
        require(rows.all { it.text("id").isNotBlank() } && rows.map { it.text("id") }.distinct().size == rows.size) { "Hay identificadores vacíos o repetidos. Revísalos en la web." }
        return rows
    }
    fun draft(kind: String, id: String, raw: Map<String, Any?>?): EditorialDraft {
        val base = raw.orEmpty()
        val text = fields(kind).keys.associateWith { key ->
            val value = base[key]
            when (key) {
                "gallery" -> {
                    require(value == null || value is List<*> && value.all { it is String }) { "Galería incompatible. Usa la web." }
                    (value as? List<*>)?.joinToString("\n").orEmpty()
                }
                "lat", "lng" -> { require(value == null || value is Number); value?.toString().orEmpty() }
                "publishAt" -> when (value) {
                    null, "" -> ""
                    is Timestamp -> LocalDateTime.ofInstant(value.toDate().toInstant(), zone).toString()
                    is String -> runCatching { LocalDateTime.ofInstant(Instant.parse(value), zone).toString() }.getOrDefault(value)
                    else -> error("Fecha incompatible. Usa la web.")
                }
                else -> { require(value == null || value is String) { "Campo incompatible: $key" }; value as? String ?: "" }
            }
        }.toMutableMap()
        if (kind == "stories") {
            text["status"] = base.text("status").ifBlank { "draft" }
            if (raw == null) text["category"] = "historia"
            val related = base["relatedPlaceIds"]
            require(related == null || related is List<*> && related.all { it is String }) { "Paradas relacionadas incompatibles." }
            text["relatedPlaceIds"] = (related as? List<*>)?.joinToString("\n").orEmpty()
        }
        return EditorialDraft(id, raw, text)
    }
    fun patch(kind: String, draft: EditorialDraft): Map<String, Any?> {
        val before = this.draft(kind, draft.id, draft.original).text
        val result = draft.original.orEmpty().toMutableMap()
        val text = draft.text
        fields(kind).forEach { (key, info) ->
            val value = text[key].orEmpty()
            if (draft.original != null && value == before[key]) return@forEach
            require(value.length <= info.second) { "Revisa " + info.first }
            when (key) {
                "lat", "lng" -> result[key] = if (value.isBlank()) null else value.toDoubleOrNull()?.takeIf { it.isFinite() && kotlin.math.abs(it) <= if (key == "lat") 90 else 180 } ?: error("Coordenadas no válidas.")
                "publishAt" -> result[key] = if (value.isBlank()) "" else runCatching {
                    LocalDateTime.parse(value.trim()).atZone(zone).toInstant().toString()
                }.getOrElse { runCatching { LocalDate.parse(value.trim()).atStartOfDay(zone).toInstant().toString() }.getOrElse { error("Fecha: usa AAAA-MM-DDTHH:MM, hora de Ecuador.") } }
                "gallery" -> {
                    val urls = value.lines().map(String::trim).filter(String::isNotEmpty)
                    require(urls.size <= 20 && urls.all { DiscoveryPolicy.media(it) != null }) { "La galería admite hasta 20 imágenes válidas." }
                    result[key] = urls
                }
                "cover", "img" -> { require(value.isBlank() || DiscoveryPolicy.media(value.trim()) != null) { "Usa un enlace válido de imagen HTTPS o un archivo del sitio." }; result[key] = value.trim() }
                "audioUrl", "audioUrlEn" -> { require(value.isBlank() || PlaceMediaPolicy.audio(value.trim()) != null) { "Revisa el enlace de audio." }; result[key] = value.trim() }
                "videoUrl" -> { require(value.isBlank() || VideoPolicy.source(value.trim()) != null) { "Revisa el enlace de video compatible." }; result[key] = value.trim() }
                "phone" -> { val phone = value.filter(Char::isDigit); require(phone.length in 10..15 && !phone.startsWith("0")) { "WhatsApp: incluye el código de país, por ejemplo 593." }; result[key] = phone }
                else -> result[key] = value.trim()
            }
        }
        result["id"] = draft.id
        if (kind == "stories") {
            require(text["status"] in setOf("draft", "published", "hidden")) { "Revisa el estado de la historia." }
            result["status"] = text.getValue("status")
            // Explicit publication must also clear legacy visibility flags; hiding/drafts preserve them.
            if (text["status"] == "published" && (draft.original == null || text["status"] != before["status"] || text["_publishIntent"] == "true")) {
                result["active"] = true; result["hidden"] = false; result["publicationStatus"] = "published"
            }
            if (draft.original == null || text["relatedPlaceIds"] != before["relatedPlaceIds"]) {
                val ids = text["relatedPlaceIds"].orEmpty().lines().filter(String::isNotBlank)
                require(ids.size <= 50 && ids.distinct().size == ids.size && ids.all { it.length <= 128 && '/' !in it }) { "Revisa las paradas relacionadas." }
                result["relatedPlaceIds"] = ids
            }
            require(result.text("title").isNotBlank() && result.text("intro").isNotBlank() && result.text("body").isNotBlank()) { "Completa título, introducción y relato en español." }
            require(result.text("cover").isNotBlank()) { "Añade una portada." }
            require((result["lat"] == null) == (result["lng"] == null)) { "Completa ambas coordenadas o deja ambas vacías." }
        } else require(listOf("name", "category", "phone", "img", "desc").all { result.text(it).isNotBlank() }) { "Completa todos los campos del emprendimiento." }
        return result
    }
}
internal data class EditorialState(val uid: String? = null, val kind: String = "stories", val busy: Boolean = false, val ready: Boolean = false,
    val base: Map<String, Any?>? = null, val rows: List<Map<String, Any?>> = emptyList(), val draft: EditorialDraft? = null,
    val places: List<Pair<String, String>> = emptyList(), val message: String? = null, val localDrafts: List<LocalAdminDraft> = emptyList())
internal class AdminEditorialViewModel(app: Application) : AndroidViewModel(app) {
    private val auth = FirebaseAuth.getInstance(); private val db = FirebaseFirestore.getInstance()
    private val mutable = MutableStateFlow(EditorialState()); val state = mutable.asStateFlow(); private var epoch = 0
    private fun same(uid: String, version: Int) = epoch == version && mutable.value.uid == uid && auth.currentUser?.uid == uid
    private suspend fun authorize(uid: String) {
        val user = auth.currentUser?.takeIf { it.uid == uid } ?: error("La sesión cambió.")
        val claims = user.getIdToken(true).await().claims
        check(AdminPlacePolicy.allowed(user.email, claims, emptyMap()) || AdminPlacePolicy.allowed(user.email, claims,
            db.collection("adminUsers").document(uid).get(Source.SERVER).await().data.orEmpty())) { "Necesitas administración general." }
    }
    fun bind(uid: String?, kind: String, notice: String? = null) {
        val version = ++epoch; mutable.value = EditorialState(uid, kind, busy = uid != null)
        if (uid == null) return
        viewModelScope.launch {
            try {
                require(kind in setOf("stories", "entrepreneurs")); authorize(uid)
                val doc = db.collection("siteContent").document(kind).get(Source.SERVER).await()
                val rows = EditorialPolicy.rows(doc.data.orEmpty())
                require(kind != "stories" || doc.get("settings") == null || doc.get("settings") is Map<*, *>) { "Presentación incompatible. Usa la web." }
                val places = mutableListOf<Pair<String, String>>()
                if (kind == "stories") {
                    var cursor: DocumentSnapshot? = null; var more: Boolean; var scanned = 0
                    do {
                        var query: Query = db.collection("locales").orderBy(FieldPath.documentId()).limit(100)
                        cursor?.let { query = query.startAfter(it) }
                        val page = query.get(Source.SERVER).await()
                        if (!same(uid, version)) return@launch
                        scanned += page.size(); check(scanned <= 5000) { "Directorio demasiado grande. Usa la web." }
                        places += page.documents.filter { it.getBoolean("active") != false && it.getString("publicationStatus").let { s -> s.isNullOrBlank() || s == "published" } }.map { it.id to it.getString("title").orEmpty().ifBlank { it.id } }
                        check(places.size <= 5000) { "Directorio demasiado grande. Usa la web." }
                        cursor = page.documents.lastOrNull(); more = page.size() == 100
                    } while (more)
                }
                if (same(uid, version)) mutable.value = EditorialState(uid, kind, ready = true, base = doc.data, rows = rows, places = places, message = notice)
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { if (same(uid, version)) mutable.value = mutable.value.copy(busy = false, message = e.message ?: "No se pudo cargar el contenido.") }
        }
    }
    fun select(id: String?) {
        val old = mutable.value; if (!old.ready || old.busy) return
        try { mutable.value = old.copy(draft = EditorialPolicy.draft(old.kind, id ?: (if (old.kind == "stories") "story_" else "emp_") + java.util.UUID.randomUUID(), old.rows.firstOrNull { it.text("id") == id }), message = null) }
        catch (e: Exception) { mutable.value = old.copy(message = e.message) }
    }
    fun edit(draft: EditorialDraft) { val old = mutable.value; if (old.ready && !old.busy && draft.id == old.draft?.id) mutable.value = old.copy(draft = draft, message = null) }
    fun dismiss() { if (!mutable.value.busy) mutable.value = mutable.value.copy(draft = null) }
    fun local(action: String, id: String? = null) {
        val old = mutable.value; val uid = old.uid ?: return
        if (!old.ready || old.busy || auth.currentUser?.uid != uid) return
        val version = epoch; mutable.value = old.copy(busy = true, message = null)
        viewModelScope.launch {
            try {
                val context: Application = getApplication()
                var recovered: LocalAdminDraft? = null
                val rows = withContext(Dispatchers.IO) {
                    when (action) {
                        "save" -> {
                            val draft = old.draft ?: error("Abre un contenido antes de guardar un borrador.")
                            val text = draft.text - "_publishIntent"
                            AdminLocalDrafts.save(context, uid, old.kind, draft.id, text[if (old.kind == "stories") "title" else "name"].orEmpty().ifBlank { "Sin título" }, old.base, JSONObject(text))
                        }
                        "restore" -> recovered = AdminLocalDrafts.load(context, uid, old.kind, requireNotNull(id))
                        "delete" -> AdminLocalDrafts.remove(context, uid, old.kind, requireNotNull(id))
                        "list" -> Unit
                        else -> error("Acción no compatible.")
                    }
                    AdminLocalDrafts.list(context, uid, old.kind)
                }
                if (!same(uid, version)) return@launch
                val saved = recovered
                if (saved != null) {
                    val text = AdminLocalDrafts.strings(saved.data) - "_publishIntent"
                    require(text.keys.all { it in EditorialPolicy.fields(old.kind) || it in setOf("status", "relatedPlaceIds") }) { "Borrador incompatible." }
                    val original = old.rows.firstOrNull { it.text("id") == saved.id }
                    val draft = EditorialPolicy.draft(old.kind, saved.id, original)
                    mutable.value = old.copy(draft = draft.copy(text = draft.text + text), localDrafts = rows,
                        message = if (saved.fingerprint != AdminLocalDrafts.fingerprint(old.base)) "Borrador recuperado. El catálogo publicado cambió: revisa todo antes de guardar." else "Borrador recuperado sin publicar. Revisa y confirma el guardado cuando esté listo.")
                } else mutable.value = old.copy(localDrafts = rows, message = when (action) { "save" -> "Borrador guardado en este teléfono para tu cuenta. No se publicó."; "delete" -> "Borrador local eliminado."; else -> null })
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { if (same(uid, version)) mutable.value = old.copy(message = e.message ?: "No se pudo gestionar el borrador local.") }
        }
    }
    fun upload(uri: Uri, field: String) {
        val old = mutable.value; val uid = old.uid ?: return; val draft = old.draft ?: return
        val allowed = if (old.kind == "stories") setOf("cover", "gallery", "audioUrl", "audioUrlEn") else setOf("img")
        if (!old.ready || old.busy || field !in allowed) return
        if (field == "gallery" && draft.text[field].orEmpty().lines().filter(String::isNotBlank).size >= 20) {
            mutable.value = old.copy(message = "La galería ya tiene 20 imágenes. Retira una antes de añadir otra."); return
        }
        val version = epoch; mutable.value = old.copy(busy = true, message = "Subiendo archivo…")
        viewModelScope.launch {
            try {
                authorize(uid)
                if (!same(uid, version)) return@launch
                val context: Application = getApplication()
                val url = if (field.startsWith("audio")) AdminAudioUpload.upload(context, uri, uid)
                    else MerchantImageUpload.upload(context, uri, old.kind, if (old.kind == "stories") "story" else "entrepreneur", uid, admin = true)
                if (!same(uid, version)) return@launch
                val value = if (field == "gallery") listOf(draft.text[field].orEmpty().trim(), url).filter(String::isNotBlank).joinToString("\n") else url
                mutable.value = old.copy(draft = draft.copy(text = draft.text + (field to value)), message = "Archivo subido al formulario. Guarda un borrador local o confirma el guardado para conservar el enlace.")
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { if (same(uid, version)) mutable.value = old.copy(message = if (e is IllegalStateException || e is IllegalArgumentException) e.message else "No se pudo subir. Se conserva el formulario. La autorización de este módulo debe estar publicada en la web.") }
        }
    }
    fun saveRow() {
        val old = mutable.value; val draft = old.draft ?: return
        try {
            val row = EditorialPolicy.patch(old.kind, draft)
            require(draft.original != null || old.rows.size < 300) { "Máximo 300 registros en este editor." }
            val rows = if (draft.original == null) old.rows + row else old.rows.map { if (it.text("id") == draft.id) row else it }
            commit(rows, null, "Guardó un contenido editorial")
        } catch (e: Exception) { mutable.value = old.copy(message = e.message) }
    }
    fun move(id: String, step: Int) {
        val old = mutable.value; val index = old.rows.indexOfFirst { it.text("id") == id }; val target = index + step
        if (index < 0 || target !in old.rows.indices || step !in setOf(-1, 1)) return
        val rows = old.rows.toMutableList(); rows.add(target, rows.removeAt(index)); commit(rows, null, "Cambió el orden editorial")
    }
    fun remove(id: String) { val old = mutable.value; if (old.rows.any { it.text("id") == id }) commit(old.rows.filter { it.text("id") != id }, null, "Retiró un contenido editorial") }
    fun settings(values: Map<String, Any?>) {
        val old = mutable.value
        if (old.kind != "stories") return
        try {
            require(values["active"] is Boolean)
            for (key in listOf("title", "titleEn", "intro", "introEn")) require(values[key] is String && (values[key] as String).length <= if (key.startsWith("title")) 120 else 300)
            commit(old.rows, values, "Actualizó la presentación de Historias")
        } catch (e: Exception) { mutable.value = old.copy(message = e.message ?: "Revisa la presentación.") }
    }
    private fun commit(rows: List<Map<String, Any?>>, settings: Map<String, Any?>?, summary: String) {
        val old = mutable.value; val uid = old.uid ?: return; if (!old.ready || old.busy) return
        val version = epoch; mutable.value = old.copy(busy = true, message = null)
        viewModelScope.launch {
            try {
                authorize(uid)
                val ref = db.collection("siteContent").document(old.kind); val audit = db.collection("adminAudit").document()
                db.runTransaction { tx ->
                    check(same(uid, version)) { "La sesión cambió." }
                    val current = tx.get(ref)
                    check(current.data == old.base) { "El contenido cambió en otro dispositivo. Conserva tus textos y actualiza antes de guardar." }
                    val patch = mutableMapOf<String, Any?>("items" to rows, "updatedBy" to (auth.currentUser?.email ?: ""), "updatedAt" to FieldValue.serverTimestamp())
                    if (settings != null) patch["settings"] = ((current.get("settings") as? Map<*, *>)?.entries?.associate { it.key.toString() to it.value }.orEmpty()) + settings
                    tx.set(ref, patch, SetOptions.merge())
                    tx.set(audit, mapOf("action" to "editorial.updated", "module" to old.kind, "summary" to summary,
                        "details" to mapOf("itemCount" to rows.size, "itemId" to (old.draft?.id ?: "")), "actorUid" to uid,
                        "actorEmail" to (auth.currentUser?.email ?: ""), "createdAt" to FieldValue.serverTimestamp()))
                    Unit
                }.await()
                if (same(uid, version)) bind(uid, old.kind, "Contenido guardado en VisitaLoja.")
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { if (same(uid, version)) mutable.value = old.copy(message = if (e is IllegalStateException || e is IllegalArgumentException) e.message else "No se pudo confirmar el guardado. El formulario se conserva; actualiza antes de repetir.") }
        }
    }
}
