package com.visitaloja.app

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
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

internal data class CantonEditRoute(val key: String = java.util.UUID.randomUUID().toString(), val title: String = "",
    val duration: String = "", val notes: String = "", val placeIds: List<String> = emptyList())
internal data class CantonEditDraft(val text: Map<String, String> = emptyMap(), val featured: List<String> = emptyList(), val routes: List<CantonEditRoute> = emptyList())
internal data class CantonEditPlace(val id: String, val name: String, val raw: Map<String, Any?>)
internal object AdminCantonPolicy {
    val fields = linkedMapOf("tagline" to ("Frase de presentación" to 120), "description" to ("Descripción" to 4000),
        "highlights" to ("Qué conocer y consejos" to 1500), "cover" to ("Enlace de portada" to 2000), "coverCredit" to ("Crédito de portada" to 180),
        "history" to ("Historia" to 2500), "culture" to ("Cultura y tradiciones" to 2500), "gastronomy" to ("Gastronomía" to 2500),
        "climate" to ("Clima y qué llevar" to 2500), "festivals" to ("Festividades" to 2500), "arrival" to ("Cómo llegar" to 2500),
        "seoTitle" to ("Título SEO de la web" to 70), "seoDescription" to ("Descripción SEO de la web" to 170), "seoImage" to ("Imagen para compartir" to 2000))
    fun read(raw: Map<String, Any?>): CantonEditDraft {
        fun ids(value: Any?): List<String> {
            require(value == null || value is List<*>) { "Hay una lista con formato incompatible. Revísala en la web." }
            val list = (value as? List<*>).orEmpty()
            require(list.all { it is String }) { "Hay una referencia incompatible. Revísala en la web." }
            return list.filterIsInstance<String>()
        }
        require(fields.keys.all { raw[it] == null || raw[it] is String }) { "Hay un texto incompatible. Revísalo en la web." }
        val routes = raw["routes"]
        require(routes == null || routes is List<*>)
        return CantonEditDraft(fields.keys.associateWith { raw.text(it) }, ids(raw["featuredIds"]), (routes as? List<*>).orEmpty().map { value ->
            val row = value as? Map<*, *> ?: error("Hay una ruta incompatible. Revísala en la web.")
            require(listOf("title", "duration", "notes").all { row[it] == null || row[it] is String })
            CantonEditRoute(title = row["title"] as? String ?: "", duration = row["duration"] as? String ?: "",
                notes = row["notes"] as? String ?: "", placeIds = ids(row["placeIds"]))
        })
    }
    fun publicPlace(raw: Map<String, Any?>, canton: String) = raw.isNotEmpty() && raw.text("cantonId").trim().ifBlank { "loja" } == canton &&
        raw["active"] != false && raw.text("publicationStatus").let { it.isBlank() || it == "published" } &&
        !Regex("motel", RegexOption.IGNORE_CASE).containsMatchIn(listOf("category", "tag", "title", "type").joinToString(" ") { raw.text(it) })
    fun validate(draft: CantonEditDraft) {
        fields.forEach { (key, info) -> require(draft.text[key].orEmpty().length <= info.second) { "Revisa " + info.first } }
        for (key in listOf("cover", "seoImage")) {
            val url = draft.text[key].orEmpty()
            require(url.isBlank() || runCatching {
                val full = if (url.startsWith("assets/") && !url.contains("..")) "https://www.visitaloja.com/$url" else url
                val uri = java.net.URI(full)
                uri.scheme == "https" && !uri.host.isNullOrBlank() && uri.userInfo == null
            }.getOrDefault(false)) { "Usa una imagen HTTPS válida." }
        }
        fun ids(values: List<String>, range: IntRange) {
            require(values.size in range && values.distinct().size == values.size && values.all { it.isNotBlank() && it.length <= 128 && '/' !in it }) { "Revisa las paradas seleccionadas y sus límites." }
        }
        ids(draft.featured, 0..16)
        require(draft.routes.size <= 8) { "Se admiten hasta 8 rutas." }
        draft.routes.forEach { route ->
            require(route.title.trim().length in 1..100 && route.duration.trim().length in 1..80 && route.notes.length <= 1000) { "Completa título y duración de cada ruta." }
            ids(route.placeIds, 2..12)
        }
    }
    fun patch(draft: CantonEditDraft): Map<String, Any> {
        validate(draft)
        return draft.text + mapOf("featuredIds" to draft.featured, "routes" to draft.routes.mapIndexed { index, route ->
            mapOf("id" to "route-$index", "title" to route.title.trim(), "duration" to route.duration.trim(), "notes" to route.notes, "placeIds" to route.placeIds)
        })
    }
}
internal data class AdminCantonState(val uid: String? = null, val id: String = "", val busy: Boolean = false, val ready: Boolean = false,
    val base: Map<String, Any?>? = null, val draft: CantonEditDraft = CantonEditDraft(), val initial: CantonEditDraft = CantonEditDraft(),
    val places: List<CantonEditPlace> = emptyList(), val message: String? = null, val localDrafts: List<LocalAdminDraft> = emptyList())
internal class AdminCantonViewModel(app: Application) : AndroidViewModel(app) {
    private val auth = FirebaseAuth.getInstance()
    private val db = FirebaseFirestore.getInstance()
    private val mutable = MutableStateFlow(AdminCantonState())
    val state = mutable.asStateFlow()
    private var generation = 0
    private fun same(uid: String, version: Int) = generation == version && mutable.value.uid == uid && auth.currentUser?.uid == uid
    private suspend fun authorize(uid: String) {
        val user = auth.currentUser?.takeIf { it.uid == uid } ?: error("La sesión cambió.")
        val claims = user.getIdToken(true).await().claims
        check(AdminPlacePolicy.allowed(user.email, claims, emptyMap()) || AdminPlacePolicy.allowed(user.email, claims,
            db.collection("adminUsers").document(uid).get(Source.SERVER).await().data.orEmpty())) { "Necesitas administración general." }
    }
    fun bind(uid: String?, id: String, notice: String? = null) {
        val version = ++generation
        mutable.value = AdminCantonState(uid, id, busy = uid != null)
        if (uid == null) return
        viewModelScope.launch {
            try {
                require(CantonPolicy.catalogue.any { it.id == id })
                authorize(uid)
                val doc = db.collection("siteContent").document("canton_$id").get(Source.SERVER).await()
                val draft = AdminCantonPolicy.read(doc.data.orEmpty())
                val places = mutableListOf<CantonEditPlace>()
                var cursor: DocumentSnapshot? = null
                do {
                    var query: Query = db.collection("locales").orderBy(FieldPath.documentId()).limit(100)
                    cursor?.let { query = query.startAfter(it) }
                    val page = query.get(Source.SERVER).await()
                    if (!same(uid, version)) return@launch
                    places += page.documents.map { CantonEditPlace(it.id, it.getString("title").orEmpty().ifBlank { it.id }, it.data.orEmpty()) }
                    check(places.size <= 5000) { "El directorio supera la capacidad de este editor. Usa la web." }
                    cursor = page.documents.lastOrNull()
                } while (page.size() == 100)
                if (same(uid, version)) mutable.value = AdminCantonState(uid, id, ready = true, base = doc.data, draft = draft, initial = draft, places = places, message = notice)
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { if (same(uid, version)) mutable.value = mutable.value.copy(busy = false, message = e.message ?: "No se pudo cargar el cantón.") }
        }
    }
    fun edit(draft: CantonEditDraft) { val old = mutable.value; if (old.ready && !old.busy) mutable.value = old.copy(draft = draft, message = null) }
    fun local(action: String, id: String? = null) {
        val old = mutable.value; val uid = old.uid ?: return
        if (!old.ready || old.busy || auth.currentUser?.uid != uid) return
        val version = generation; mutable.value = old.copy(busy = true, message = null)
        viewModelScope.launch {
            try {
                val context: Application = getApplication()
                var recovered: LocalAdminDraft? = null
                val rows = withContext(Dispatchers.IO) {
                    when (action) {
                        "save" -> {
                            val data = old.draft.text + mapOf("featuredIds" to old.draft.featured, "routes" to old.draft.routes.map { route ->
                                mapOf("title" to route.title, "duration" to route.duration, "notes" to route.notes, "placeIds" to route.placeIds)
                            })
                            AdminLocalDrafts.save(context, uid, "cantons", old.id, CantonPolicy.catalogue.first { it.id == old.id }.name, old.base, JSONObject(data))
                        }
                        "restore" -> {
                            require(id == old.id) { "Este borrador pertenece a otro cantón. Ábrelo desde su editor." }
                            recovered = AdminLocalDrafts.load(context, uid, "cantons", requireNotNull(id))
                        }
                        "delete" -> AdminLocalDrafts.remove(context, uid, "cantons", requireNotNull(id))
                        "list" -> Unit
                        else -> error("Acción no compatible.")
                    }
                    AdminLocalDrafts.list(context, uid, "cantons").filter { it.id == old.id }
                }
                if (!same(uid, version)) return@launch
                val saved = recovered
                if (saved != null) {
                    @Suppress("UNCHECKED_CAST")
                    val data = AdminLocalDrafts.value(saved.data) as? Map<String, Any?> ?: error("Borrador incompatible.")
                    val draft = AdminCantonPolicy.read(data)
                    mutable.value = old.copy(draft = draft, localDrafts = rows, message = if (saved.fingerprint != AdminLocalDrafts.fingerprint(old.base))
                        "Borrador recuperado. La guía publicada cambió: revisa todo antes de publicar." else "Borrador recuperado sin publicar.")
                } else mutable.value = old.copy(localDrafts = rows, message = when (action) { "save" -> "Borrador guardado en este teléfono para tu cuenta. No se publicó."; "delete" -> "Borrador local eliminado."; else -> null })
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { if (same(uid, version)) mutable.value = old.copy(message = e.message ?: "No se pudo gestionar el borrador.") }
        }
    }
    fun upload(uri: Uri) {
        val old = mutable.value; val uid = old.uid ?: return; if (!old.ready || old.busy) return
        val version = generation; mutable.value = old.copy(busy = true, message = "Subiendo portada…")
        viewModelScope.launch {
            try {
                authorize(uid)
                if (!same(uid, version)) return@launch
                val url = MerchantImageUpload.upload(getApplication(), uri, old.id, "canton", uid, admin = true)
                if (same(uid, version)) mutable.value = old.copy(draft = old.draft.copy(text = old.draft.text + ("cover" to url)), message = "Portada subida. Guarda el cantón para publicarla.")
            } catch (e: CancellationException) { throw e }
            catch (_: Exception) { if (same(uid, version)) mutable.value = old.copy(message = "No se pudo subir la portada. Se conserva el formulario.") }
        }
    }
    fun save() {
        val old = mutable.value; val uid = old.uid ?: return; if (!old.ready || old.busy) return
        try { AdminCantonPolicy.validate(old.draft) } catch (e: Exception) { mutable.value = old.copy(message = e.message); return }
        val version = generation; mutable.value = old.copy(busy = true, message = null)
        viewModelScope.launch {
            try {
                authorize(uid)
                val ref = db.collection("siteContent").document("canton_" + old.id)
                val audit = db.collection("adminAudit").document()
                db.runTransaction { tx ->
                    check(same(uid, version)) { "La sesión cambió." }
                    val current = tx.get(ref)
                    check(current.data == old.base) { "Otro administrador cambió el cantón. Conserva tus textos y actualiza antes de guardar." }
                    val ids = (old.draft.featured + old.draft.routes.flatMap { it.placeIds }).distinct()
                    ids.forEach { place ->
                        check(AdminCantonPolicy.publicPlace(tx.get(db.collection("locales").document(place)).data.orEmpty(), old.id)) {
                            "La parada $place ya no está publicada en este cantón. Retírala de destacados y rutas."
                        }
                    }
                    val previous = (current.get("version") as? Number)?.toLong() ?: 0L
                    check(previous in 0 until Long.MAX_VALUE) { "Versión incompatible." }
                    val patch = AdminCantonPolicy.patch(old.draft) + mapOf("version" to previous + 1, "cantonId" to old.id,
                        "updatedBy" to uid, "updatedAt" to FieldValue.serverTimestamp())
                    tx.set(ref, patch, SetOptions.merge())
                    tx.set(audit, mapOf("action" to "canton.updated", "module" to "cantons", "summary" to "Editó guía, destacados y rutas de un cantón",
                        "details" to mapOf("cantonId" to old.id, "routeCount" to old.draft.routes.size), "actorUid" to uid,
                        "actorEmail" to (auth.currentUser?.email ?: ""), "createdAt" to FieldValue.serverTimestamp()))
                    Unit
                }.await()
                if (same(uid, version)) bind(uid, old.id, "Guía guardada y publicada en VisitaLoja.")
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { if (same(uid, version)) mutable.value = old.copy(
                message = if (e is IllegalStateException || e is IllegalArgumentException) e.message else "No se pudo confirmar el guardado. Conserva tus textos y actualiza antes de repetir.") }
        }
    }
}
