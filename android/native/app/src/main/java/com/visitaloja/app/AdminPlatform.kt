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
import org.json.JSONArray
import org.json.JSONObject

internal data class PlatformField(val key: String, val label: String, val fallback: String = "", val type: String = "text", val max: Int = 700,
    val options: List<String> = emptyList(), val min: Double = 0.0, val upper: Double = 100.0)
internal data class PlatformGroup(val id: String, val title: String, val native: Boolean, val fields: List<PlatformField>)
internal object AdminPlatformPolicy {
    fun groups(catalog: JSONObject, kind: String): List<PlatformGroup> {
        if (kind == "supporters") {
            val defaults = catalog.getJSONObject("supporters")
            fun f(key: String, label: String, type: String = "text", max: Int = 120, options: List<String> = emptyList(), min: Double = 0.0, upper: Double = 100.0) =
                PlatformField("s|$key", label, defaults.opt(key)?.takeUnless { it is JSONArray }?.toString().orEmpty(), type, max, options, min, upper)
            return listOf(PlatformGroup("supporters", "Negocios que apoyan VisitaLoja", true, listOf(
                f("title", "Título ES"), f("titleEn", "Título EN"), f("subtitle", "Descripción ES", max = 300), f("subtitleEn", "Descripción EN", max = 300),
                f("active", "Mostrar franja", "bool"), f("includeMesa", "Incluir Mesa Turística", "bool"), f("mode", "Selección de negocios", "choice", options = listOf("all", "selected")),
                f("size", "Tamaño de logos", "choice", options = listOf("small", "medium", "large")), f("duration", "Duración del recorrido · segundos", "number", min = 20.0, upper = 120.0),
                f("direction", "Dirección", "choice", options = listOf("left", "right")), f("motion", "Animar carrusel", "bool"), f("pauseOnHover", "Pausar con puntero en web", "bool"),
                f("showNames", "Mostrar nombres", "bool"), f("clickable", "Permitir abrir fichas", "bool"), f("selectedIds", "Seleccionados", "ids", max = 200000),
                f("excludedIds", "Excluidos", "ids", max = 200000), f("orderIds", "Orden", "ids", max = 200000))))
        }
        fun r(key: String, label: String, fallback: String = "", type: String = "text", max: Int = 700, options: List<String> = emptyList(), min: Double = 0.0, upper: Double = 100.0) = PlatformField("r|$key", label, fallback, type, max, options, min, upper)
        val roots = listOf(r("title", "Título principal ES"), r("titleEn", "Título principal EN"), r("subtitle", "Descripción principal ES"), r("subtitleEn", "Descripción principal EN"),
            r("logoUrl", "Logo público de la web", type = "image", max = 2000), r("fiavlImageUrl", "Imagen del festival", type = "image", max = 2000),
            r("heroHeight", "Altura de portada", "immersive", "choice", options = listOf("immersive", "standard", "compact")), r("heroStyle", "Estilo de portada web", "cinematic", "choice", options = listOf("cinematic", "classic", "clean")),
            r("cornerStyle", "Esquinas", "large", "choice", options = listOf("large", "medium", "extra")), r("cardStyle", "Tarjetas web", "elevated", "choice", options = listOf("elevated", "bordered", "soft")),
            r("cardImageFit", "Encuadre de fotos en tarjetas web", "contain", "choice", options = listOf("contain", "cover")), r("heroIntervalSeconds", "Intervalo de portada · segundos", "6", "number", min = 2.0, upper = 60.0),
            r("heroImageOpacity", "Visibilidad de imagen web · porcentaje", "55", "number"), r("showTrendingSection", "Mostrar tendencias", "true", "bool"),
            r("showNowPlanner", "Mostrar planificador web", "true", "bool"), r("showAccountFloatingButton", "Botón flotante de cuenta web", "true", "bool"),
            r("premiumVisual", "Estilo visual web", "true", "bool"), r("premiumAnimations", "Animaciones web", "true", "bool"),
            r("latestYoutubeTitle", "Título del video destacado", max = 180), r("latestYoutubeUrl", "Video destacado", type = "video", max = 2000), r("latestVideoThumbUrl", "Miniatura del video", type = "image", max = 2000),
            r("welcomeMusicEnabled", "Música de bienvenida", "true", "bool"), r("welcomeMusicUrl", "Audio de bienvenida · enlace", type = "audio", max = 2000), r("welcomeMusicVolume", "Volumen de bienvenida · 0 a 1", "0.2", "number", upper = 1.0),
            r("institutionalTitle", "Título institucional", max = 180), r("institutionalDescription", "Descripción institucional", max = 700), r("institutionName", "Institución", max = 180), r("sponsorNames", "Texto de patrocinadores", max = 700))
        val groups = mutableListOf(PlatformGroup("general", "Cabecera, música e identidad", true, roots + PlatformField("c|contactEmail", "Correo de contacto", "contacto@visitaloja.com", "email", 150)))
        val blocks = catalog.getJSONArray("blocks")
        for (i in 0 until blocks.length()) {
            val block = blocks.getJSONObject(i); val id = block.getString("id"); val fields = mutableListOf<PlatformField>()
            if (!block.getBoolean("noVisibility")) fields += PlatformField("b|$id|enabled", "Mostrar bloque", "true", "bool")
            val texts = block.getJSONArray("fields")
            for (j in 0 until texts.length()) { val row = texts.getJSONObject(j); val key = row.getString("key"); fields += PlatformField("b|$id|$key", row.getString("label") + " ES", row.getString("es")); fields += PlatformField("b|$id|" + key + "En", row.getString("label") + " EN", row.getString("en")) }
            val links = block.getJSONArray("links")
            for (j in 0 until links.length()) { val row = links.getJSONObject(j); fields += PlatformField("b|$id|" + row.getString("key"), row.getString("label") + " · enlace", row.getString("url"), if (block.getBoolean("optionalHttpsLinks")) "https" else "link", 2000) }
            if (block.getBoolean("image")) fields += listOf(PlatformField("b|$id|imageUrl", "Imagen del bloque", block.getString("imageUrl"), "image", 2000), PlatformField("b|$id|imageAlt", "Descripción accesible de imagen", block.getString("imageAlt"), max = 300), PlatformField("b|$id|imageCredit", "Crédito fotográfico", max = 500))
            groups += PlatformGroup(id, block.getString("name"), block.getBoolean("native"), fields)
        }
        return groups
    }
    fun map(value: Any?): Map<String, Any?> {
        require(value == null || value is Map<*, *> && value.keys.all { it is String }) { "Configuración incompatible. Usa la web." }
        return (value as? Map<*, *>)?.entries?.associate { it.key as String to it.value }.orEmpty()
    }
    fun read(base: Map<String, Any?>, groups: List<PlatformGroup>): Map<String, String> {
        val homepage = if (groups.first().id == "general") map(base["homepageContent"]) else emptyMap()
        val blocks = map(homepage["blocks"])
        return groups.flatMap { it.fields }.associate { field ->
            val parts = field.key.split('|'); val raw = when (parts[0]) { "r", "s" -> base[parts[1]]; "c" -> homepage[parts[1]]; else -> map(blocks[parts[1]])[parts[2]] }
            val value = if (raw == null) field.fallback else when (field.type) {
                "bool" -> { require(raw is Boolean); raw.toString() }
                "number" -> { require(raw is Number || raw is String); raw.toString() }
                "ids" -> { require(raw is List<*> && raw.size <= 1000 && raw.all { it is String && it.length in 1..180 && !it.contains('\n') }); raw.filterIsInstance<String>().joinToString("\n") }
                else -> { require(raw is String) { "Campo incompatible: " + field.label }; raw }
            }
            field.key to value
        }
    }
    fun parse(field: PlatformField, value: String): Any {
        require(value.length <= field.max) { "Revisa " + field.label }
        val text = value.trim()
        return when (field.type) {
            "bool" -> { require(text in setOf("true", "false")); text == "true" }
            "number" -> text.toDoubleOrNull()?.takeIf { it.isFinite() && it in field.min..field.upper } ?: error("Revisa el rango de " + field.label)
            "choice" -> text.takeIf { it in field.options } ?: error("Revisa " + field.label)
            "ids" -> { val ids = value.lines().filter(String::isNotBlank); require(ids.size <= 1000 && ids.distinct().size == ids.size && ids.all { it.length <= 180 && '/' !in it }); ids }
            "image", "audio" -> { require(text.isBlank() || DiscoveryPolicy.media(text) != null) { "Usa un enlace HTTPS o un archivo válido en " + field.label }; text }
            "video" -> { require(text.isBlank() || VideoPolicy.source(text) != null) { "Revisa el enlace de video." }; text }
            "email" -> text.takeIf { Regex("^[^\\s@<>]+@[^\\s@<>]+\\.[^\\s@<>]+$").matches(it) } ?: error("Revisa el correo de contacto.")
            "https" -> { require(text.isEmpty() || text.startsWith("https://", true) && DiscoveryPolicy.media(text) != null); text }
            "link" -> { require(text.isEmpty() || text.length <= 2000 && !Regex("[\\u0000-\\u0020<>\"']").containsMatchIn(text) && (text.startsWith("https://", true) && DiscoveryPolicy.media(text) != null || Regex("^(?:#[a-zA-Z][\\w-]*|/?[a-zA-Z0-9][a-zA-Z0-9_./?=&%#-]*)$").matches(text) && !text.startsWith("//"))); text }
            else -> value.trim()
        }
    }
    fun patch(kind: String, base: Map<String, Any?>, initial: Map<String, String>, draft: Map<String, String>, groups: List<PlatformGroup>): Map<String, Any?> {
        val fields = groups.flatMap { it.fields }; require(draft.keys == initial.keys)
        val changed = fields.filter { draft[it.key] != initial[it.key] }; require(changed.isNotEmpty()) { "No hay cambios para guardar." }
        val result = mutableMapOf<String, Any?>()
        if (kind == "supporters") {
            require(draft["s|title"].orEmpty().isNotBlank()) { "Escribe el título ES del carrusel." }
            changed.forEach { result[it.key.substringAfter('|')] = parse(it, draft[it.key].orEmpty()) }
            val rawRevision = base["revision"]
            val revision = if (rawRevision == null) 0L else (rawRevision as? Number)?.toDouble()?.takeIf { it.isFinite() && it >= 0 && it % 1.0 == 0.0 }?.toLong() ?: error("Revisión incompatible. Usa la web.")
            require(revision in 0 until Long.MAX_VALUE); result["revision"] = revision + 1
        } else {
            changed.filter { it.key.startsWith("r|") }.forEach { result[it.key.substringAfter('|')] = parse(it, draft[it.key].orEmpty()) }
            val contentChanges = changed.filter { !it.key.startsWith("r|") }
            if (contentChanges.isNotEmpty()) {
                val homepage = map(base["homepageContent"]).toMutableMap(); val blocks = map(homepage["blocks"]).toMutableMap()
                contentChanges.filter { it.key.startsWith("c|") }.forEach { homepage[it.key.substringAfter('|')] = parse(it, draft[it.key].orEmpty()) }
                contentChanges.filter { it.key.startsWith("b|") }.map { it.key.split('|')[1] }.distinct().forEach { id ->
                    val row = map(blocks[id]).toMutableMap()
                    fields.filter { it.key.startsWith("b|$id|") }.forEach { field ->
                        val name = field.key.substringAfterLast('|')
                        if (row[name] == null || draft[field.key] != initial[field.key]) row[name] = parse(field, draft[field.key].orEmpty())
                    }
                    blocks[id] = row
                }
                homepage["version"] = 1; homepage["blocks"] = blocks; result["homepageContent"] = homepage
            }
        }
        return result
    }
    private fun fire(value: Any?): JSONObject = when (value) {
        is Timestamp -> JSONObject().put("timestampValue", value.toDate().toInstant().toString())
        is String -> JSONObject().put("stringValue", value)
        is Boolean -> JSONObject().put("booleanValue", value)
        is Map<*, *> -> JSONObject().put("mapValue", JSONObject().put("fields", JSONObject(value.entries.associate { it.key.toString() to fire(it.value) })))
        is Number -> JSONObject().put("doubleValue", value)
        null -> JSONObject().put("nullValue", JSONObject.NULL)
        else -> JSONObject().put("invalidValue", true)
    }
    fun place(id: String, raw: Map<String, Any?>): Place {
        val fields = JSONObject(listOf("subscription", "customLogoUrl", "hidden", "published").associateWith { fire(raw[it]) })
        return Place(id, raw.text("title"), listOf(raw.text("category")), "", "", null, active = raw["active"] != false,
            publicationStatus = raw.text("publicationStatus"), status = raw.text("status"), support = SupportersPolicy.read(fields))
    }
}
internal data class AdminPlatformState(val uid: String? = null, val kind: String = "home", val busy: Boolean = false, val ready: Boolean = false,
    val base: Map<String, Any?>? = null, val initial: Map<String, String> = emptyMap(), val draft: Map<String, String> = emptyMap(),
    val groups: List<PlatformGroup> = emptyList(), val places: List<Place> = emptyList(), val localDrafts: List<LocalAdminDraft> = emptyList(), val message: String? = null)
internal class AdminPlatformViewModel(app: Application) : AndroidViewModel(app) {
    private val auth = FirebaseAuth.getInstance(); private val db = FirebaseFirestore.getInstance()
    private val mutable = MutableStateFlow(AdminPlatformState()); val state = mutable.asStateFlow(); private var epoch = 0
    private fun same(uid: String, version: Int) = epoch == version && auth.currentUser?.uid == uid && mutable.value.uid == uid
    private fun ref(kind: String): DocumentReference { require(kind in setOf("home", "supporters")); return if (kind == "home") db.collection("settings").document("main") else db.collection("siteContent").document("registeredBrands") }
    private suspend fun authorize(uid: String) {
        val user = auth.currentUser?.takeIf { it.uid == uid } ?: error("La sesión cambió.")
        val claims = user.getIdToken(true).await().claims
        check(AdminPlacePolicy.allowed(user.email, claims, emptyMap()) || AdminPlacePolicy.allowed(user.email, claims, db.collection("adminUsers").document(uid).get(Source.SERVER).await().data.orEmpty())) { "Necesitas administración general." }
    }
    fun bind(uid: String?, kind: String, notice: String? = null) {
        val version = ++epoch; mutable.value = AdminPlatformState(uid, kind, busy = uid != null)
        if (uid == null) return
        viewModelScope.launch {
            try {
                authorize(uid)
                val catalog = withContext(Dispatchers.IO) { getApplication<Application>().assets.open("admin-home-catalog.json").bufferedReader().use { JSONObject(it.readText()) } }
                val groups = AdminPlatformPolicy.groups(catalog, kind)
                val doc = ref(kind).get(Source.SERVER).await(); val draft = AdminPlatformPolicy.read(doc.data.orEmpty(), groups)
                val places = mutableListOf<Place>()
                if (kind == "supporters") {
                    var cursor: DocumentSnapshot? = null; var more: Boolean
                    do {
                        var query: Query = db.collection("locales").orderBy(FieldPath.documentId()).limit(100); cursor?.let { query = query.startAfter(it) }
                        val page = query.get(Source.SERVER).await(); if (!same(uid, version)) return@launch
                        places += page.documents.map { AdminPlatformPolicy.place(it.id, it.data.orEmpty()) }; check(places.size <= 5000) { "Directorio demasiado grande. Usa la web." }
                        cursor = page.documents.lastOrNull(); more = page.size() == 100
                    } while (more)
                }
                if (same(uid, version)) mutable.value = AdminPlatformState(uid, kind, ready = true, base = doc.data, initial = draft, draft = draft, groups = groups, places = places, message = notice)
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { if (same(uid, version)) mutable.value = mutable.value.copy(busy = false, message = e.message ?: "No se pudo cargar la configuración.") }
        }
    }
    fun edit(key: String, value: String) { val old = mutable.value; if (old.ready && !old.busy && key in old.draft) mutable.value = old.copy(draft = old.draft + (key to value), message = null) }
    fun choose(id: String, enabled: Boolean) {
        val old = mutable.value; if (old.kind != "supporters" || old.places.none { it.id == id && SupportersPolicy.eligible(it, System.currentTimeMillis()) }) return
        val key = if (old.draft["s|mode"] == "selected") "s|selectedIds" else "s|excludedIds"
        val ids = old.draft[key].orEmpty().lines().filter(String::isNotBlank).distinct()
        val add = if (key == "s|selectedIds") enabled else !enabled
        edit(key, (if (add) (ids + id).distinct() else ids - id).joinToString("\n"))
    }
    fun chooseAll(enabled: Boolean) {
        val old = mutable.value; if (old.kind != "supporters" || !old.ready || old.busy) return
        val available = old.places.filter { SupportersPolicy.eligible(it, System.currentTimeMillis()) }.map { it.id }.toSet()
        val key = if (old.draft["s|mode"] == "selected") "s|selectedIds" else "s|excludedIds"
        val ids = old.draft[key].orEmpty().lines().filter(String::isNotBlank).distinct()
        val add = if (key == "s|selectedIds") enabled else !enabled
        val next = if (add) (ids + available).distinct() else ids.filter { it !in available }
        if (next.size > 1000) { mutable.value = old.copy(message = "La selección supera 1000 referencias. Selecciona los negocios individualmente."); return }
        edit(key, next.joinToString("\n"))
    }
    fun move(id: String, step: Int) {
        val old = mutable.value; val ids = old.draft["s|orderIds"].orEmpty().lines().filter(String::isNotBlank)
        val rank = ids.withIndex().associate { it.value to it.index }
        val eligible = old.places.filter { SupportersPolicy.eligible(it, System.currentTimeMillis()) }.sortedBy { rank[it.id] ?: (100000 + old.places.indexOf(it)) }.map { it.id }
        val index = eligible.indexOf(id); val target = index + step; if (index < 0 || target !in eligible.indices || step !in setOf(-1, 1)) return
        val order = (ids + eligible).distinct().toMutableList(); val a = order.indexOf(id); val b = order.indexOf(eligible[target]); val value = order[a]; order[a] = order[b]; order[b] = value
        edit("s|orderIds", order.joinToString("\n"))
    }
    fun config(draft: Map<String, String>): Map<String, Any?> = draft.filterKeys { it.startsWith("s|") }.mapKeys { it.key.substringAfter('|') }.mapValues { (key, value) -> when (key) {
        "selectedIds", "excludedIds", "orderIds" -> value.lines().filter(String::isNotBlank)
        "duration" -> value.toDoubleOrNull() ?: 35.0
        "active", "includeMesa", "motion", "pauseOnHover", "showNames", "clickable" -> value == "true"
        else -> value
    } }
    fun save() {
        val old = mutable.value; val uid = old.uid ?: return; if (!old.ready || old.busy) return
        val patch = try { AdminPlatformPolicy.patch(old.kind, old.base.orEmpty(), old.initial, old.draft, old.groups) } catch (e: Exception) { mutable.value = old.copy(message = e.message); return }
        val version = epoch; mutable.value = old.copy(busy = true, message = null)
        viewModelScope.launch {
            try {
                authorize(uid); val target = ref(old.kind); val audit = db.collection("adminAudit").document()
                db.runTransaction { tx ->
                    check(same(uid, version)) { "La sesión cambió." }; val current = tx.get(target)
                    check(current.data == old.base) { "La configuración cambió desde otro dispositivo. Guarda un borrador, actualiza y recupera para revisar." }
                    tx.set(target, patch + mapOf("updatedAt" to FieldValue.serverTimestamp(), "updatedBy" to (auth.currentUser?.email ?: "")), SetOptions.merge())
                    tx.set(audit, mapOf("action" to "platform.updated", "module" to old.kind, "summary" to "Guardó portada o carrusel de apoyo", "details" to mapOf("changedFields" to old.draft.keys.count { old.draft[it] != old.initial[it] }),
                        "actorUid" to uid, "actorEmail" to (auth.currentUser?.email ?: ""), "createdAt" to FieldValue.serverTimestamp()))
                    Unit
                }.await()
                if (same(uid, version)) bind(uid, old.kind, "Configuración guardada en VisitaLoja.")
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { if (same(uid, version)) mutable.value = old.copy(message = if (e is IllegalArgumentException || e is IllegalStateException) e.message else "No se pudo confirmar el guardado. Guarda un borrador y actualiza antes de repetir.") }
        }
    }
    fun local(action: String) {
        val old = mutable.value; val uid = old.uid ?: return; if (!old.ready || old.busy || auth.currentUser?.uid != uid) return
        val version = epoch; mutable.value = old.copy(busy = true, message = null)
        viewModelScope.launch {
            try {
                val context: Application = getApplication(); var restored: LocalAdminDraft? = null
                val rows = withContext(Dispatchers.IO) {
                    when (action) {
                        "save" -> AdminLocalDrafts.save(context, uid, old.kind, "configuration", if (old.kind == "home") "Portada" else "Carrusel de apoyo", old.base, JSONObject(old.draft))
                        "restore" -> restored = AdminLocalDrafts.load(context, uid, old.kind, "configuration")
                        "delete" -> AdminLocalDrafts.remove(context, uid, old.kind, "configuration")
                        "list" -> Unit
                        else -> error("Acción no compatible.")
                    }; AdminLocalDrafts.list(context, uid, old.kind)
                }
                if (!same(uid, version)) return@launch
                val saved = restored
                if (saved == null) mutable.value = old.copy(localDrafts = rows, message = when (action) { "save" -> "Borrador guardado en este teléfono para tu cuenta, sin publicar."; "delete" -> "Borrador local eliminado."; else -> null })
                else {
                    val text = AdminLocalDrafts.strings(saved.data); require(text.keys == old.initial.keys) { "El esquema cambió. Revisa el borrador en una versión compatible." }
                    mutable.value = old.copy(draft = text, localDrafts = rows, message = if (saved.fingerprint != AdminLocalDrafts.fingerprint(old.base)) "Borrador recuperado. La configuración publicada cambió: revisa antes de guardar." else "Borrador recuperado sin publicar.")
                }
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { if (same(uid, version)) mutable.value = old.copy(message = e.message ?: "No se pudo gestionar el borrador.") }
        }
    }
    fun upload(uri: Uri, key: String) {
        val old = mutable.value; val uid = old.uid ?: return
        if (!old.ready || old.busy || old.kind != "home" || old.groups.flatMap { it.fields }.none { it.key == key && it.type == "image" }) return
        val version = epoch; mutable.value = old.copy(busy = true, message = "Subiendo imagen…")
        viewModelScope.launch {
            try {
                authorize(uid); if (!same(uid, version)) return@launch
                val url = MerchantImageUpload.upload(getApplication(), uri, "home", "homepage", uid, admin = true, preserveAlpha = key == "r|logoUrl")
                if (same(uid, version)) mutable.value = old.copy(draft = old.draft + (key to url), message = "Imagen subida al formulario. Guarda un borrador o confirma el guardado para conservar el enlace.")
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { if (same(uid, version)) mutable.value = old.copy(message = if (e is IllegalStateException || e is IllegalArgumentException) e.message else "No se pudo subir la imagen. Se conserva el formulario.") }
        }
    }
}
