package com.visitaloja.app

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
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

internal data class ArchiveRow(val id: String, val raw: Map<String, Any?>)
internal object ArchivePolicy {
    val history = linkedMapOf("title" to ("Nombre ES" to 140), "titleEn" to ("Nombre EN" to 140),
        "labelPast" to ("Etiqueta del pasado" to 70), "labelPresent" to ("Etiqueta actual" to 70),
        "imgPast" to ("Imagen antigua" to 4096), "imgPresent" to ("Imagen actual" to 4096),
        "desc" to ("Descripción ES" to 900), "descEn" to ("Descripción EN" to 900),
        "audioUrl" to ("Narración ES" to 4096), "audioUrlEn" to ("Narración EN" to 4096),
        "lat" to ("Latitud" to 40), "lng" to ("Longitud" to 40))
    val podcast = linkedMapOf("label" to ("Etiqueta" to 60), "title" to ("Título" to 120),
        "duration" to ("Duración indicada" to 20), "description" to ("Descripción administrativa" to 500),
        "audioUrl" to ("Enlace o archivo de audio publicado" to 4096), "coverUrl" to ("Enlace o archivo de portada" to 4096))
    fun fields(kind: String) = if (kind == "history") history else podcast
    fun draft(kind: String, id: String, base: Map<String, Any?>?): EditorialDraft {
        val raw = base.orEmpty()
        val text = fields(kind).keys.associateWith { key ->
            val value = raw[key]
            if (key in setOf("lat", "lng")) { require(value == null || value is Number) { "Coordenadas incompatibles. Usa la web." }; value?.toString().orEmpty() }
            else { require(value == null || value is String) { "Campo incompatible: $key" }; value as? String ?: "" }
        }.toMutableMap()
        if (kind == "podcast") {
            require(raw["visible"] == null || raw["visible"] is Boolean)
            text["visible"] = (raw["visible"] != false).toString()
            if (base == null) { text["title"] = "Visita Loja — El Podcast de Loja"; text["audioUrl"] = "cancion-muestra-vive-loja.mp3" }
        }
        return EditorialDraft(id, base, text)
    }
    fun patch(kind: String, draft: EditorialDraft): Map<String, Any?> {
        val before = this.draft(kind, draft.id, draft.original).text
        val result = draft.original.orEmpty().toMutableMap()
        fields(kind).forEach { (key, info) ->
            val value = draft.text[key].orEmpty().trim()
            if (draft.original != null && draft.text[key] == before[key]) return@forEach
            require(value.length <= info.second) { "Revisa " + info.first }
            when (key) {
                "lat", "lng" -> result[key] = value.toDoubleOrNull()?.takeIf { it.isFinite() && kotlin.math.abs(it) <= if (key == "lat") 90 else 180 } ?: error("Completa coordenadas válidas.")
                "imgPast", "imgPresent", "coverUrl" -> { require(value.isBlank() || DiscoveryPolicy.media(value) != null) { "Usa un enlace HTTPS o un archivo válido del sitio." }; result[key] = value }
                "audioUrl", "audioUrlEn" -> {
                    require(value.isBlank() || PlaceMediaPolicy.audio(value) != null) { "Revisa el enlace de audio." }
                    result[key] = if (kind == "podcast" && value.isBlank()) "cancion-muestra-vive-loja.mp3" else value
                }
                else -> result[key] = value
            }
        }
        require(result.text("title").isNotBlank()) { "Completa el título." }
        if (kind == "history") {
            require(listOf("labelPast", "labelPresent", "imgPast", "imgPresent", "desc").all { result.text(it).isNotBlank() }) { "Completa etiquetas, fotografías y descripción en español." }
            require(PlacePolicy.safeCoordinate((result["lat"] as? Number)?.toDouble(), true) != null && PlacePolicy.safeCoordinate((result["lng"] as? Number)?.toDouble(), false) != null) { "Completa latitud y longitud." }
        } else {
            require(draft.text["visible"] in setOf("true", "false"))
            result["visible"] = draft.text["visible"] == "true"
        }
        return result
    }
}
internal data class ArchiveState(val uid: String? = null, val kind: String = "history", val busy: Boolean = false, val ready: Boolean = false,
    val rows: List<ArchiveRow> = emptyList(), val more: Boolean = false, val draft: EditorialDraft? = null,
    val localDrafts: List<LocalAdminDraft> = emptyList(), val message: String? = null)
internal class AdminArchiveViewModel(app: Application) : AndroidViewModel(app) {
    private val auth = FirebaseAuth.getInstance(); private val db = FirebaseFirestore.getInstance()
    private val mutable = MutableStateFlow(ArchiveState()); val state = mutable.asStateFlow(); private var epoch = 0
    private var cursor: DocumentSnapshot? = null
    private fun same(uid: String, version: Int) = epoch == version && auth.currentUser?.uid == uid && mutable.value.uid == uid
    private fun ref(kind: String, id: String): DocumentReference {
        require(kind in setOf("history", "podcast") && id.isNotBlank() && id.length <= 180 && '/' !in id)
        return if (kind == "history") db.collection("loja_tiempo").document(id) else db.collection("siteContent").document("podcast")
    }
    private suspend fun authorize(uid: String) {
        val user = auth.currentUser?.takeIf { it.uid == uid } ?: error("La sesión cambió.")
        val claims = user.getIdToken(true).await().claims
        check(AdminPlacePolicy.allowed(user.email, claims, emptyMap()) || AdminPlacePolicy.allowed(user.email, claims,
            db.collection("adminUsers").document(uid).get(Source.SERVER).await().data.orEmpty())) { "Necesitas administración general." }
    }
    fun bind(uid: String?, kind: String, notice: String? = null) {
        ++epoch; cursor = null; mutable.value = ArchiveState(uid, kind, message = notice)
        if (uid != null) load()
    }
    fun load() {
        val old = mutable.value; val uid = old.uid ?: return; if (old.busy || old.ready && !old.more) return
        val version = epoch; mutable.value = old.copy(busy = true)
        viewModelScope.launch {
            try {
                authorize(uid)
                val rows: List<ArchiveRow>; var next: DocumentSnapshot? = null; var more = false
                if (old.kind == "podcast") {
                    val doc = ref(old.kind, "podcast").get(Source.SERVER).await()
                    rows = if (doc.exists()) listOf(ArchiveRow(doc.id, doc.data.orEmpty())) else emptyList()
                } else {
                    require(old.kind == "history")
                    var query: Query = db.collection("loja_tiempo").orderBy(FieldPath.documentId()).limit(50)
                    cursor?.let { query = query.startAfter(it) }
                    val page = query.get(Source.SERVER).await(); next = page.documents.lastOrNull(); more = page.size() == 50
                    rows = page.documents.map { ArchiveRow(it.id, it.data.orEmpty()) }
                }
                if (same(uid, version)) { cursor = next; mutable.value = old.copy(ready = true, rows = (old.rows + rows).distinctBy { it.id }, more = more) }
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { if (same(uid, version)) mutable.value = old.copy(message = e.message ?: "No se pudo cargar el contenido.") }
        }
    }
    fun select(id: String?) {
        val old = mutable.value; if (!old.ready || old.busy) return
        try {
            val target = if (old.kind == "podcast") "podcast" else id ?: "time_" + java.util.UUID.randomUUID()
            val row = old.rows.firstOrNull { it.id == target }
            require(id == null || row != null) { "Actualiza el listado antes de editar." }
            mutable.value = old.copy(draft = ArchivePolicy.draft(old.kind, target, row?.raw), message = null)
        } catch (e: Exception) { mutable.value = old.copy(message = e.message) }
    }
    fun edit(draft: EditorialDraft) { val old = mutable.value; if (old.ready && !old.busy && old.draft?.id == draft.id) mutable.value = old.copy(draft = draft, message = null) }
    fun dismiss() { if (!mutable.value.busy) mutable.value = mutable.value.copy(draft = null) }
    fun save() {
        val old = mutable.value; val draft = old.draft ?: return
        try { commit(draft, ArchivePolicy.patch(old.kind, draft)) } catch (e: Exception) { mutable.value = old.copy(message = e.message) }
    }
    fun remove(id: String) { val old = mutable.value; if (old.kind == "history") old.rows.firstOrNull { it.id == id }?.let { commit(EditorialDraft(id, it.raw, emptyMap()), null) } }
    private fun commit(draft: EditorialDraft, patch: Map<String, Any?>?) {
        val old = mutable.value; val uid = old.uid ?: return; if (!old.ready || old.busy) return
        val version = epoch; mutable.value = old.copy(busy = true, message = null)
        viewModelScope.launch {
            try {
                authorize(uid)
                val target = ref(old.kind, draft.id); val audit = db.collection("adminAudit").document()
                db.runTransaction { tx ->
                    check(same(uid, version)) { "La sesión cambió." }
                    val current = tx.get(target)
                    check(current.data == draft.original) { "Cambió desde otro dispositivo. Guarda un borrador local, actualiza y recupera para revisar los cambios." }
                    if (patch == null) tx.delete(target) else tx.set(target, patch + mapOf("updatedAt" to FieldValue.serverTimestamp(), "updatedBy" to (auth.currentUser?.email ?: "")), SetOptions.merge())
                    tx.set(audit, mapOf("action" to if (patch == null) "archive.deleted" else "archive.saved", "module" to old.kind,
                        "summary" to if (patch == null) "Retiró un punto histórico" else "Guardó contenido de historia o podcast", "details" to mapOf("id" to draft.id),
                        "actorUid" to uid, "actorEmail" to (auth.currentUser?.email ?: ""), "createdAt" to FieldValue.serverTimestamp()))
                    Unit
                }.await()
                if (same(uid, version)) bind(uid, old.kind, if (patch == null) "Punto eliminado." else "Contenido guardado en VisitaLoja.")
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { if (same(uid, version)) mutable.value = old.copy(message = if (e is IllegalArgumentException || e is IllegalStateException) e.message else "No se pudo confirmar el guardado. Conserva un borrador local y actualiza antes de repetir.") }
        }
    }
    fun local(action: String, id: String? = null) {
        val old = mutable.value; val uid = old.uid ?: return
        if (!old.ready || old.busy || auth.currentUser?.uid != uid) return
        val version = epoch; mutable.value = old.copy(busy = true, message = null)
        viewModelScope.launch {
            try {
                val context: Application = getApplication(); var recovered: LocalAdminDraft? = null
                val rows = withContext(Dispatchers.IO) {
                    when (action) {
                        "save" -> {
                            val draft = old.draft ?: error("Abre un formulario.")
                            AdminLocalDrafts.save(context, uid, old.kind, draft.id, draft.text["title"].orEmpty().ifBlank { "Sin título" }, draft.original, JSONObject(draft.text))
                        }
                        "restore" -> recovered = AdminLocalDrafts.load(context, uid, old.kind, requireNotNull(id))
                        "delete" -> AdminLocalDrafts.remove(context, uid, old.kind, requireNotNull(id))
                        "list" -> Unit
                        else -> error("Acción no compatible.")
                    }
                    AdminLocalDrafts.list(context, uid, old.kind)
                }
                val saved = recovered
                if (saved != null) {
                    require(old.kind != "podcast" || saved.id == "podcast")
                    val doc = ref(old.kind, saved.id).get(Source.SERVER).await()
                    val text = AdminLocalDrafts.strings(saved.data)
                    require(text.keys.all { it in ArchivePolicy.fields(old.kind) || old.kind == "podcast" && it == "visible" }) { "Borrador incompatible." }
                    if (same(uid, version)) {
                        val draft = ArchivePolicy.draft(old.kind, saved.id, doc.data)
                        mutable.value = old.copy(draft = draft.copy(text = draft.text + text), localDrafts = rows, message = if (saved.fingerprint != AdminLocalDrafts.fingerprint(doc.data)) "Borrador recuperado. El contenido publicado cambió; revisa antes de guardar." else "Borrador recuperado sin publicar.")
                    }
                } else if (same(uid, version)) mutable.value = old.copy(localDrafts = rows, message = when (action) { "save" -> "Borrador guardado en este teléfono para tu cuenta, sin publicar."; "delete" -> "Borrador local eliminado."; else -> null })
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { if (same(uid, version)) mutable.value = old.copy(message = e.message ?: "No se pudo gestionar el borrador local.") }
        }
    }
    fun upload(uri: Uri, field: String) {
        val old = mutable.value; val uid = old.uid ?: return; val draft = old.draft ?: return
        if (!old.ready || old.busy || old.kind != "history" || field !in setOf("imgPast", "imgPresent", "audioUrl", "audioUrlEn")) return
        val version = epoch; mutable.value = old.copy(busy = true, message = "Subiendo archivo…")
        viewModelScope.launch {
            try {
                authorize(uid); if (!same(uid, version)) return@launch
                val context: Application = getApplication()
                val url = if (field.startsWith("audio")) AdminAudioUpload.upload(context, uri, uid, "time") else MerchantImageUpload.upload(context, uri, "history", "time", uid, admin = true)
                if (same(uid, version)) mutable.value = old.copy(draft = draft.copy(text = draft.text + (field to url)), message = "Archivo subido al formulario. Guarda un borrador o publica los cambios para conservar el enlace.")
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { if (same(uid, version)) mutable.value = old.copy(message = if (e is IllegalArgumentException || e is IllegalStateException) e.message else "No se pudo subir el archivo. Se conserva el formulario.") }
        }
    }
}
