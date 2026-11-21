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
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

internal data class PhotoLibraryDraft(val photos: List<Map<String, Any?>> = emptyList(), val authors: List<Map<String, Any?>> = emptyList())
internal object AdminPhotoPolicy {
    val sections = listOf("Portada principal", "Loja, en cada mirada", "Loja en imágenes")
    val fields = linkedMapOf("title" to ("Título" to 120), "url" to ("Enlace directo de imagen" to 4096), "credit" to ("Autor" to 100), "creditUrl" to ("Instagram o web del autor · HTTPS" to 2000), "alt" to ("Descripción accesible de la imagen" to 240), "description" to ("Texto breve bajo el título" to 240))
    private val keys = setOf("photoManagerItems", "photoManagerAuthors", "photoManagerInitialized")
    fun version(base: Map<String, Any?>) = keys.associateWith { base[it] }
    fun storable(row: Map<String, Any?>) = row.filterKeys { it in fields || it in setOf("id", "section", "active", "authorId", "desktopFocus", "mobileFocus") }
    fun rows(value: Any?, max: Int = 500): List<Map<String, Any?>> {
        require(value == null || value is List<*> && value.size <= max) { "Biblioteca incompatible o demasiado grande. Usa la web." }
        return (value as? List<*>).orEmpty().map { row ->
            require(row is Map<*, *> && row.keys.all { it is String }) { "Registro incompatible. Revísalo en la web para conservarlo." }
            row.entries.associate { it.key as String to it.value }
        }
    }
    fun read(base: Map<String, Any?>, defaults: List<Map<String, Any?>>): PhotoLibraryDraft {
        val saved = rows(base["photoManagerItems"])
        val photos = if (base["photoManagerInitialized"] == true || saved.isNotEmpty()) saved else defaults
        require(photos.all { it.text("id").length in 1..100 } && photos.map { it.text("id") }.distinct().size == photos.size) { "Hay fotos sin identificador o repetidas. Revísalas en la web." }
        val authors = linkedMapOf<String, Map<String, Any?>>()
        fun add(row: Map<String, Any?>) { val name = row.text("name").trim(); if (name.isNotEmpty()) authors[name.lowercase(java.util.Locale.ROOT)] = row }
        add(mapOf("id" to "geovanny", "name" to "Geovanny Muñoz", "url" to "https://www.instagram.com/geo_munoz/"))
        add(mapOf("id" to "suko", "name" to "Suko Samaniego", "url" to "https://www.instagram.com/suko_samaniego/"))
        photos.forEach { p -> if (p.text("credit").isNotBlank() && p.text("credit").trim().lowercase(java.util.Locale.ROOT) !in authors) add(mapOf("id" to p.text("authorId").ifBlank { "author-" + UUID.randomUUID() }, "name" to p.text("credit"), "url" to p.text("creditUrl"))) }
        // Existing author metadata is authoritative; unsupported records are never silently dropped.
        val savedAuthors = rows(base["photoManagerAuthors"])
        require(savedAuthors.map { it.text("name").trim().lowercase(java.util.Locale.ROOT) }.distinct().size == savedAuthors.size) { "Hay autores repetidos por nombre. Revísalos en la web." }
        savedAuthors.forEach { require(it.text("name").isNotBlank()) { "Autor sin nombre. Revísalo en la web." }; add(it) }
        return PhotoLibraryDraft(photos, authors.values.toList())
    }
    fun focus(row: Map<String, Any?>, key: String): Pair<Float, Float>? {
        val point = row[key] as? Map<*, *> ?: return null
        fun number(v: Any?) = (v as? Number)?.toFloat() ?: (v as? String)?.toFloatOrNull()
        val x = number(point["x"])?.takeIf { it.isFinite() } ?: return null
        val y = number(point["y"])?.takeIf { it.isFinite() } ?: return null
        return x.coerceIn(0f, 100f) to y.coerceIn(0f, 100f)
    }
    fun validatePhoto(row: Map<String, Any?>) {
        require(row.text("id").length in 1..100 && row.text("section") in sections) { "Elige una de las tres secciones." }
        require(fields.all { (key, info) -> row[key] == null || row[key] is String && row.text(key).length <= info.second }) { "Revisa la longitud de los datos de la foto." }
        require(row.text("title").isNotBlank() && row.text("credit").isNotBlank()) { "Escribe el título y el autor." }
        require(DiscoveryPolicy.photoUrl(row.text("url")) != null) { "Usa una foto de VisitaLoja, Cloudinary o i.imgur.com, igual que en la web." }
        require(row.text("creditUrl").isBlank() || row.text("creditUrl").startsWith("https://", true) && DiscoveryPolicy.media(row.text("creditUrl")) != null) { "El enlace del autor debe ser HTTPS." }
        require(row["active"] == null || row["active"] is Boolean)
        listOf("desktopFocus", "mobileFocus").forEach { key -> require(row[key] == null || focus(row, key) != null) { "Encuadre incompatible." } }
    }
    fun validate(draft: PhotoLibraryDraft, initial: PhotoLibraryDraft) {
        require(draft.photos.size <= maxOf(150, initial.photos.size) && draft.authors.size <= maxOf(150, initial.authors.size)) { "Se permiten hasta 150 fotos y 150 autores nuevos; conserva o reduce los anteriores." }
        require(draft.photos.map { it.text("id") }.distinct().size == draft.photos.size)
        draft.photos.forEach { row -> if (initial.photos.firstOrNull { it.text("id") == row.text("id") } != row) validatePhoto(row) }
        draft.authors.forEach { row -> if (row !in initial.authors) {
            require(row.text("id").length in 1..100 && row.text("name").trim().length in 1..100 && row.text("url").length <= 2000) { "Revisa el nombre del autor." }
            require(row.text("url").isBlank() || row.text("url").startsWith("https://", true) && DiscoveryPolicy.media(row.text("url")) != null) { "El enlace del autor debe ser HTTPS." }
        } }
    }
    fun move(rows: List<Map<String, Any?>>, id: String, delta: Int): List<Map<String, Any?>> {
        val index = rows.indexOfFirst { it.text("id") == id }; if (index < 0 || delta !in setOf(-1, 1)) return rows
        val indices = rows.indices.filter { rows[it]["section"] == rows[index]["section"] }; val target = indices.getOrNull(indices.indexOf(index) + delta) ?: return rows
        return rows.toMutableList().apply { val value = this[index]; this[index] = this[target]; this[target] = value }
    }
}
internal data class PhotoLibraryState(val uid: String? = null, val busy: Boolean = false, val ready: Boolean = false,
    val base: Map<String, Any?>? = null, val draft: PhotoLibraryDraft = PhotoLibraryDraft(), val initial: PhotoLibraryDraft = PhotoLibraryDraft(),
    val editing: Map<String, Any?>? = null, val original: Map<String, Any?>? = null,
    val localDrafts: List<LocalAdminDraft> = emptyList(), val message: String? = null) {
    val dirty: Boolean get() = draft != initial || editing != original
}
internal class AdminPhotosViewModel(app: Application) : AndroidViewModel(app) {
    private val auth = FirebaseAuth.getInstance(); private val db = FirebaseFirestore.getInstance()
    private val mutable = MutableStateFlow(PhotoLibraryState()); val state = mutable.asStateFlow(); private var epoch = 0
    private fun same(uid: String, version: Int) = epoch == version && auth.currentUser?.uid == uid && mutable.value.uid == uid
    private fun ref() = db.collection("settings").document("main")
    private suspend fun authorize(uid: String) {
        val user = auth.currentUser?.takeIf { it.uid == uid } ?: error("La sesión cambió.")
        val claims = user.getIdToken(true).await().claims
        check(AdminPlacePolicy.allowed(user.email, claims, emptyMap()) || AdminPlacePolicy.allowed(user.email, claims, db.collection("adminUsers").document(uid).get(Source.SERVER).await().data.orEmpty())) { "Necesitas administración general." }
    }
    fun bind(uid: String?, notice: String? = null) {
        val version = ++epoch; mutable.value = PhotoLibraryState(uid, busy = uid != null); if (uid == null) return
        viewModelScope.launch {
            try {
                authorize(uid)
                val defaults = withContext(Dispatchers.IO) { getApplication<Application>().assets.open("discovery-photo-defaults.json").bufferedReader().use { AdminPhotoPolicy.rows(AdminLocalDrafts.value(JSONArray(it.readText()))) } }
                val doc = ref().get(Source.SERVER).await(); val draft = AdminPhotoPolicy.read(doc.data.orEmpty(), defaults)
                if (same(uid, version)) mutable.value = PhotoLibraryState(uid, ready = true, base = doc.data, initial = draft, draft = draft, message = notice)
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { if (same(uid, version)) mutable.value = mutable.value.copy(busy = false, message = e.message ?: "No se pudo cargar la biblioteca.") }
        }
    }
    private fun change(action: (PhotoLibraryState) -> PhotoLibraryState) {
        val old = mutable.value; if (!old.ready || old.busy || auth.currentUser?.uid != old.uid) return
        try { mutable.value = action(old).copy(message = null) } catch (e: Exception) { mutable.value = old.copy(message = e.message) }
    }
    fun begin(id: String?, section: String) = change { old ->
        require(old.editing == null) { "Guarda o cancela la foto que estás editando." }
        val row = if (id == null) mapOf("id" to ("photo-" + UUID.randomUUID()), "section" to section, "active" to true) else old.draft.photos.first { it.text("id") == id }
        old.copy(editing = if (row["active"] == null) row + ("active" to true) else row, original = if (id == null) null else row)
    }
    fun edit(key: String, value: Any?) = change { old -> old.copy(editing = old.editing?.plus(key to value)) }
    fun frame(device: String, axis: String, value: Float) = change { old ->
        require(device in setOf("desktopFocus", "mobileFocus") && axis in setOf("x", "y"))
        val row = old.editing ?: return@change old
        val point = AdminPhotoPolicy.focus(row, device) ?: (50f to 50f)
        old.copy(editing = row + (device to mapOf("x" to (if (axis == "x") value.coerceIn(0f,100f) else point.first), "y" to (if (axis == "y") value.coerceIn(0f,100f) else point.second))))
    }
    fun customFrame(enabled: Boolean) = change { old -> val row = old.editing ?: return@change old
        old.copy(editing = row + listOf("desktopFocus", "mobileFocus").associateWith { if (enabled) mapOf("x" to 50, "y" to 50) else null })
    }
    fun stage() = change { old ->
        val row = old.editing ?: return@change old; AdminPhotoPolicy.validatePhoto(row)
        val existing = old.draft.photos.any { it["id"] == row["id"] }
        require(existing || old.draft.photos.size < maxOf(150, old.initial.photos.size)) { "Límite de fotos alcanzado." }
        val rows = if (existing) old.draft.photos.map { if (it["id"] == row["id"]) row else it } else old.draft.photos + listOf(row)
        old.copy(draft = old.draft.copy(photos = rows), editing = null, original = null)
    }
    fun cancel() = change { it.copy(editing = null, original = null) }
    fun action(id: String, action: String, target: String = "") = change { old ->
        require(old.editing == null) { "Guarda o cancela la foto antes de cambiar la biblioteca." }
        val row = old.draft.photos.first { it.text("id") == id }
        val rows = when (action) {
            "up", "down" -> AdminPhotoPolicy.move(old.draft.photos, id, if (action == "up") -1 else 1)
            "visibility" -> old.draft.photos.map { if (it.text("id") == id) it + ("active" to (it["active"] == false)) else it }
            "remove" -> old.draft.photos.filter { it.text("id") != id }
            "reuse" -> {
                require(target in AdminPhotoPolicy.sections && old.draft.photos.none { it["section"] == target && it["url"] == row["url"] }) { "La foto ya está en esa sección." }
                require(old.draft.photos.size < maxOf(150, old.initial.photos.size)) { "Límite de fotos alcanzado." }
                old.draft.photos + listOf(row + mapOf("id" to ("photo-" + UUID.randomUUID()), "section" to target))
            }
            else -> error("Acción incompatible.")
        }
        old.copy(draft = old.draft.copy(photos = rows))
    }
    fun chooseAuthor(index: Int) = change { old ->
        val author = old.draft.authors[index]; old.copy(editing = old.editing?.plus(mapOf("authorId" to author.text("id"), "credit" to author.text("name"), "creditUrl" to author.text("url"))))
    }
    fun saveAuthor() = change { old ->
        val photo = old.editing ?: return@change old; val name = photo.text("credit").trim(); val url = photo.text("creditUrl").trim()
        require(name.length in 1..100 && url.length <= 2000 && (url.isBlank() || url.startsWith("https://", true) && DiscoveryPolicy.media(url) != null)) { "Escribe el nombre y un enlace HTTPS válido del autor." }
        val previous = old.draft.authors.firstOrNull { photo.text("authorId").isNotBlank() && it.text("id") == photo.text("authorId") } ?: old.draft.authors.firstOrNull { it.text("name").equals(name, true) }
        require(previous != null || old.draft.authors.size < maxOf(150, old.initial.authors.size)) { "Límite de autores alcanzado." }
        require(old.draft.authors.none { it !== previous && it.text("name").equals(name, true) }) { "Ya existe un autor con ese nombre. Elígelo en la lista." }
        val author = previous.orEmpty() + mapOf("id" to (previous?.text("id")?.ifBlank { null } ?: ("author-" + UUID.randomUUID())), "name" to name, "url" to url)
        val photos = old.draft.photos.map { p -> if (previous != null && (p.text("authorId").isNotBlank() && p["authorId"] == previous["id"] || p.text("authorId").isBlank() && p["credit"] == previous["name"])) p + mapOf("authorId" to author["id"], "credit" to name, "creditUrl" to url) else p }
        val authors = if (previous == null) old.draft.authors + listOf(author) else old.draft.authors.map { if (it === previous) author else it }
        old.copy(draft = PhotoLibraryDraft(photos, authors), editing = photo + ("authorId" to author["id"]))
    }
    fun upload(uri: Uri, id: String) {
        val old = mutable.value; val uid = old.uid ?: return
        if (!old.ready || old.busy || old.editing?.text("id") != id) return
        val version = epoch; mutable.value = old.copy(busy = true, message = "Subiendo fotografía…")
        viewModelScope.launch {
            try {
                authorize(uid); if (!same(uid, version)) return@launch
                val url = MerchantImageUpload.upload(getApplication(), uri, "photos", "homepage", uid, admin = true)
                if (same(uid, version)) mutable.value = old.copy(editing = old.editing.orEmpty() + ("url" to url), message = "Foto subida. Guarda un borrador o publica para conservar su enlace.")
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { if (same(uid, version)) mutable.value = old.copy(message = e.message ?: "No se pudo subir. El formulario se conserva.") }
        }
    }
    fun save() {
        val old = mutable.value; val uid = old.uid ?: return; if (!old.ready || old.busy) return
        try { require(old.editing == null) { "Guarda la foto en cambios pendientes antes de publicar." }; AdminPhotoPolicy.validate(old.draft, old.initial); require(old.draft != old.initial) { "No hay cambios para publicar." } }
        catch (e: Exception) { mutable.value = old.copy(message = e.message); return }
        val version = epoch; mutable.value = old.copy(busy = true, message = null)
        viewModelScope.launch {
            try {
                authorize(uid); val target = ref(); val audit = db.collection("adminAudit").document()
                db.runTransaction { tx ->
                    check(same(uid, version)) { "La sesión cambió." }
                    val current = tx.get(target)
                    check(AdminPhotoPolicy.version(current.data.orEmpty()) == AdminPhotoPolicy.version(old.base.orEmpty())) { "La biblioteca cambió en otra sesión. Guarda un borrador y actualiza antes de revisar tus cambios." }
                    tx.set(target, mapOf("photoManagerItems" to old.draft.photos, "photoManagerAuthors" to old.draft.authors, "photoManagerInitialized" to true, "photoManagerUpdatedAt" to FieldValue.serverTimestamp()), SetOptions.merge())
                    tx.set(audit, mapOf("action" to "photos.updated", "module" to "photos", "summary" to "Publicó biblioteca fotográfica y créditos", "details" to mapOf("photos" to old.draft.photos.size, "authors" to old.draft.authors.size), "actorUid" to uid, "actorEmail" to (auth.currentUser?.email ?: ""), "createdAt" to FieldValue.serverTimestamp()))
                    Unit
                }.await()
                if (same(uid, version)) bind(uid, "Biblioteca publicada. Las vistas compartidas usarán las fotos y créditos guardados.")
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { if (same(uid, version)) mutable.value = old.copy(message = if (e is IllegalStateException || e is IllegalArgumentException) e.message else "No se pudo confirmar la publicación. Guarda un borrador y actualiza antes de repetir.") }
        }
    }
    fun local(action: String) {
        val old = mutable.value; val uid = old.uid ?: return; if (!old.ready || old.busy || auth.currentUser?.uid != uid) return
        val version = epoch; mutable.value = old.copy(busy = true, message = null)
        viewModelScope.launch {
            try {
                var restored: LocalAdminDraft? = null
                val rows = withContext(Dispatchers.IO) {
                    val app: Application = getApplication()
                    when (action) {
                        "save" -> AdminLocalDrafts.save(app, uid, "photos", "library", "Biblioteca fotográfica", AdminPhotoPolicy.version(old.base.orEmpty()), JSONObject().put("photos", JSONArray(old.draft.photos.map(AdminPhotoPolicy::storable))).put("authors", JSONArray(old.draft.authors.map { it.filterKeys { key -> key in setOf("id", "name", "url") } })).put("editing", old.editing?.let { JSONObject(AdminPhotoPolicy.storable(it)) } ?: JSONObject.NULL))
                        "restore" -> restored = AdminLocalDrafts.load(app, uid, "photos", "library")
                        "delete" -> AdminLocalDrafts.remove(app, uid, "photos", "library")
                        "list" -> Unit
                        else -> error("Acción incompatible.")
                    }; AdminLocalDrafts.list(app, uid, "photos")
                }
                if (!same(uid, version)) return@launch
                val saved = restored
                if (saved == null) mutable.value = old.copy(localDrafts = rows, message = when (action) { "save" -> "Borrador guardado en este teléfono, sin publicar."; "delete" -> "Borrador local eliminado."; else -> null })
                else {
                    fun restoreRows(key: String, current: List<Map<String, Any?>>): List<Map<String, Any?>> = AdminPhotoPolicy.rows(AdminLocalDrafts.value(saved.data.getJSONArray(key))).map { row ->
                        val values = if (key == "photos") AdminPhotoPolicy.storable(row) else row.filterKeys { it in setOf("id", "name", "url") }
                        current.firstOrNull { it["id"] == row["id"] }.orEmpty() + values
                    }
                    val photos = restoreRows("photos", old.initial.photos); val authors = restoreRows("authors", old.initial.authors)
                    require(photos.map { it.text("id") }.all { it.length in 1..100 } && photos.map { it["id"] }.distinct().size == photos.size)
                    val savedEditing = (AdminLocalDrafts.value(saved.data.opt("editing")) as? Map<*, *>)?.entries?.associate { it.key.toString() to it.value }
                    val original = photos.firstOrNull { it["id"] == savedEditing?.get("id") }
                    val editing = savedEditing?.let { original.orEmpty() + AdminPhotoPolicy.storable(it) }
                    mutable.value = old.copy(draft = PhotoLibraryDraft(photos, authors), editing = editing, original = original, localDrafts = rows,
                        message = if (saved.fingerprint != AdminLocalDrafts.fingerprint(AdminPhotoPolicy.version(old.base.orEmpty()))) "Borrador recuperado; la biblioteca publicada cambió. Revisa las fotos, autores y retiros antes de publicar." else "Borrador recuperado, sin publicar.")
                }
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { if (same(uid, version)) mutable.value = old.copy(message = e.message ?: "No se pudo gestionar el borrador.") }
        }
    }
}
