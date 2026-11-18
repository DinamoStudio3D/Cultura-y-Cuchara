package com.visitaloja.app

import android.app.Application
import android.graphics.Bitmap
import android.graphics.drawable.BitmapDrawable
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import coil.imageLoader
import coil.request.ImageRequest
import coil.request.SuccessResult
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

internal data class AdminPostcardBrand(val id: String, val name: String, val color: String, val enabled: Boolean)
internal data class AdminPostcardDraft(val text: Map<String, String> = emptyMap(), val brands: List<AdminPostcardBrand> = emptyList(), val frames: List<Map<String, Any?>> = emptyList())
internal object AdminPostcardPolicy {
    val brands = listOf(AdminPostcardBrand("brand-nature", "Loja Natural", "#173D30", true), AdminPostcardBrand("brand-food", "Sabores de Loja", "#9A3412", true), AdminPostcardBrand("brand-memory", "Recuerdo Visita Loja", "#123B66", true))
    val fields = linkedMapOf("watermark" to ("Marca inferior" to 80), "sampleImg" to ("Imagen de muestra · enlace o archivo publicado" to 4096), "defaultMsg" to ("Frase inicial para el visitante" to 220))
    val frameFields = linkedMapOf("name" to ("Nombre del marco" to 60), "icon" to ("Ícono para el selector web" to 4), "img" to ("Imagen del marco · PNG o WebP con transparencia" to 4096))
    private val reserved = setOf("fiavl", "vintage", "cafe", "polaroid", "brand-nature", "brand-food", "brand-memory")
    fun read(settings: Map<String, Any?>, frames: Map<String, Any?>): AdminPostcardDraft {
        require(fields.keys.all { settings[it] == null || settings[it] is String }) { "Configuración incompatible. Revísala en la web." }
        val config = settings["brandFrames"]
        require(config == null || config is Map<*, *>)
        val brandRows = brands.map { fallback ->
            val row = (config as? Map<*, *>)?.get(fallback.id)
            require(row == null || row is Map<*, *>)
            val raw = row as? Map<*, *>
            require(listOf("name", "color").all { raw?.get(it) == null || raw?.get(it) is String } && (raw?.get("enabled") == null || raw?.get("enabled") is Boolean))
            fallback.copy(name = (raw?.get("name") as? String) ?: fallback.name, color = (raw?.get("color") as? String) ?: fallback.color, enabled = raw?.get("enabled") != false)
        }
        val source = frames["frames"]
        require(source == null || source is List<*> && source.size <= 200) { "Lista de marcos incompatible o demasiado grande. Usa la web." }
        val rows = (source as? List<*>).orEmpty().map { item ->
            require(item is Map<*, *> && item.keys.all { it is String })
            val row = item.entries.associate { it.key as String to it.value }
            require(row.text("id").matches(Regex("[A-Za-z0-9_-]{1,100}")) && frameFields.keys.all { row[it] == null || row[it] is String }) { "Hay un marco incompatible. Usa la web." }
            row
        }
        require(rows.map { it.text("id") }.distinct().size == rows.size) { "Hay identificadores repetidos de marcos. Revísalos en la web." }
        return AdminPostcardDraft(fields.keys.associateWith { settings.text(it) }, brandRows, rows)
    }
    fun validate(draft: AdminPostcardDraft, initial: AdminPostcardDraft) {
        fields.forEach { (key, info) -> if (draft.text[key] != initial.text[key]) require(draft.text[key].orEmpty().length <= info.second) { "Revisa " + info.first } }
        val sample = draft.text["sampleImg"].orEmpty()
        require(sample.isBlank() || DiscoveryPolicy.media(sample) != null) { "Revisa la imagen de muestra." }
        require(draft.brands.map { it.id } == brands.map { it.id })
        draft.brands.forEach { row -> require(row.name.trim().length in 1..40 && row.color.matches(Regex("#[0-9a-fA-F]{6}"))) { "Revisa nombre y color hexadecimal de los marcos de marca." } }
        require(draft.frames.size <= maxOf(40, initial.frames.size) && draft.frames.size <= 200) { "Se admiten hasta 40 marcos personalizados nuevos; conserva o reduce los anteriores." }
        require(draft.frames.map { it.text("id") }.distinct().size == draft.frames.size)
        draft.frames.forEach { row ->
            val before = initial.frames.firstOrNull { it.text("id") == row.text("id") }
            if (row != before) {
                require(row.text("id").matches(Regex("[A-Za-z0-9_-]{1,100}")) && (before != null || row.text("id") !in reserved))
                require(row.text("name").trim().length in 1..60 && row.text("icon").length <= 4 && DiscoveryPolicy.media(row.text("img")) != null) { "Revisa nombre, ícono y enlace del marco." }
            }
        }
    }
    fun settings(draft: AdminPostcardDraft, base: Map<String, Any?>): Map<String, Any?> {
        val oldBrands = (base["brandFrames"] as? Map<*, *>)?.entries?.associate { it.key.toString() to it.value }.orEmpty()
        val updated = oldBrands + draft.brands.associate { brand ->
            val old = (oldBrands[brand.id] as? Map<*, *>)?.entries?.associate { it.key.toString() to it.value }.orEmpty()
            brand.id to (old + mapOf("enabled" to brand.enabled, "name" to brand.name.trim(), "color" to brand.color))
        }
        return draft.text + mapOf("brandFrames" to updated)
    }
}
internal data class AdminPostcardState(val uid: String? = null, val busy: Boolean = false, val ready: Boolean = false,
    val base: Map<String, Any?>? = null, val baseFrames: Map<String, Any?>? = null,
    val draft: AdminPostcardDraft = AdminPostcardDraft(), val initial: AdminPostcardDraft = AdminPostcardDraft(),
    val frameDraft: EditorialDraft? = null, val localDrafts: List<LocalAdminDraft> = emptyList(), val preview: Bitmap? = null, val message: String? = null)
internal class AdminPostcardViewModel(app: Application) : AndroidViewModel(app) {
    private val auth = FirebaseAuth.getInstance(); private val db = FirebaseFirestore.getInstance()
    private val mutable = MutableStateFlow(AdminPostcardState()); val state = mutable.asStateFlow(); private var epoch = 0
    private fun same(uid: String, version: Int) = epoch == version && auth.currentUser?.uid == uid && mutable.value.uid == uid
    private suspend fun authorize(uid: String) {
        val user = auth.currentUser?.takeIf { it.uid == uid } ?: error("La sesión cambió.")
        val claims = user.getIdToken(true).await().claims
        check(AdminPlacePolicy.allowed(user.email, claims, emptyMap()) || AdminPlacePolicy.allowed(user.email, claims,
            db.collection("adminUsers").document(uid).get(Source.SERVER).await().data.orEmpty())) { "Necesitas administración general." }
    }
    fun bind(uid: String?, notice: String? = null) {
        val version = ++epoch; mutable.value = AdminPostcardState(uid, busy = uid != null)
        if (uid == null) return
        viewModelScope.launch {
            try {
                authorize(uid)
                val config = db.collection("settings").document("postcards").get(Source.SERVER).await()
                val frames = db.collection("settings").document("postcard_frames").get(Source.SERVER).await()
                val draft = AdminPostcardPolicy.read(config.data.orEmpty(), frames.data.orEmpty())
                if (same(uid, version)) mutable.value = AdminPostcardState(uid, ready = true, base = config.data, baseFrames = frames.data, draft = draft, initial = draft, message = notice)
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { if (same(uid, version)) mutable.value = mutable.value.copy(busy = false, message = e.message ?: "No se pudo cargar Postales.") }
        }
    }
    fun edit(draft: AdminPostcardDraft) { val old = mutable.value; if (old.ready && !old.busy) mutable.value = old.copy(draft = draft, preview = null, message = null) }
    fun frame(id: String?) {
        val old = mutable.value; if (!old.ready || old.busy) return
        val base = old.draft.frames.firstOrNull { it.text("id") == id }
        if (id != null && base == null) return
        val key = id ?: "frame_" + java.util.UUID.randomUUID()
        mutable.value = old.copy(frameDraft = EditorialDraft(key, base, AdminPostcardPolicy.frameFields.keys.associateWith { base?.text(it).orEmpty() }.toMutableMap().also { if (base == null) it["icon"] = "🖼️" }), message = null)
    }
    fun editFrame(draft: EditorialDraft) { val old = mutable.value; if (!old.busy && old.frameDraft?.id == draft.id) mutable.value = old.copy(frameDraft = draft, message = null) }
    fun closeFrame() { if (!mutable.value.busy) mutable.value = mutable.value.copy(frameDraft = null) }
    private suspend fun verifyImage(url: String) {
        val safe = DiscoveryPolicy.media(url) ?: error("Revisa el enlace de la imagen.")
        val context: Application = getApplication()
        val result = context.imageLoader.execute(ImageRequest.Builder(context).data(safe).size(720).allowHardware(false).build())
        val bitmap = ((result as? SuccessResult)?.drawable as? BitmapDrawable)?.bitmap ?: error("No se pudo abrir la imagen del marco. Revisa su enlace y formato.")
        require(bitmap.width > 0 && bitmap.height > 0)
    }
    fun applyFrame() {
        val old = mutable.value; val uid = old.uid ?: return; val frame = old.frameDraft ?: return; if (!old.ready || old.busy) return
        val version = epoch; mutable.value = old.copy(busy = true, message = "Comprobando imagen del marco…")
        viewModelScope.launch {
            try {
                val row = frame.original.orEmpty() + frame.text.mapValues { it.value.trim() } + ("id" to frame.id)
                val rows = if (frame.original == null) old.draft.frames + row else old.draft.frames.map { if (it.text("id") == frame.id) row else it }
                val draft = old.draft.copy(frames = rows)
                AdminPostcardPolicy.validate(draft, old.initial); verifyImage(row.text("img"))
                if (same(uid, version)) mutable.value = old.copy(draft = draft, frameDraft = null, preview = null, message = "Marco añadido al formulario. Publica la configuración o guarda un borrador para conservarlo.")
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { if (same(uid, version)) mutable.value = old.copy(message = e.message ?: "No se pudo comprobar el marco.") }
        }
    }
    fun removeFrame(id: String) = edit(mutable.value.draft.copy(frames = mutable.value.draft.frames.filter { it.text("id") != id }))
    fun move(id: String, step: Int) {
        val old = mutable.value; val index = old.draft.frames.indexOfFirst { it.text("id") == id }; val target = index + step
        if (index < 0 || target !in old.draft.frames.indices || step !in setOf(-1, 1)) return
        val rows = old.draft.frames.toMutableList(); rows.add(target, rows.removeAt(index)); edit(old.draft.copy(frames = rows))
    }
    fun preview(id: String) {
        val old = mutable.value; val uid = old.uid ?: return; if (!old.ready || old.busy) return
        val version = epoch; mutable.value = old.copy(busy = true, message = "Preparando postal de muestra…")
        viewModelScope.launch {
            try {
                AdminPostcardPolicy.validate(old.draft, old.initial)
                val settings = PostcardPolicy.settings(AdminPostcardPolicy.settings(old.draft, old.base.orEmpty()), mapOf("frames" to old.draft.frames))
                val frame = settings.frames.firstOrNull { it.id == id } ?: error("Elige un marco disponible.")
                val bitmap = PostcardRenderer.render(getApplication(), settings.sample ?: R.drawable.visitaloja_logo, "Vista previa administrativa", frame, settings,
                    PostcardDraft(place = "Loja, Ecuador", message = settings.message), maxEdge = 720)
                if (same(uid, version)) mutable.value = old.copy(preview = bitmap, message = if (settings.sample == null) "Vista previa con el logo como foto de muestra. No se publicó." else "Vista previa sin publicar.")
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { if (same(uid, version)) mutable.value = old.copy(message = e.message ?: "No se pudo previsualizar la postal.") }
        }
    }
    fun save() {
        val old = mutable.value; val uid = old.uid ?: return; if (!old.ready || old.busy || old.frameDraft != null) return
        val version = epoch; mutable.value = old.copy(busy = true, message = "Comprobando configuración…")
        viewModelScope.launch {
            try {
                AdminPostcardPolicy.validate(old.draft, old.initial); authorize(uid)
                if (old.draft.text["sampleImg"] != old.initial.text["sampleImg"] && old.draft.text["sampleImg"].orEmpty().isNotBlank()) verifyImage(old.draft.text.getValue("sampleImg"))
                old.draft.frames.filter { row -> row.text("img") != old.initial.frames.firstOrNull { it.text("id") == row.text("id") }?.text("img") }.forEach { verifyImage(it.text("img")) }
                val settings = db.collection("settings").document("postcards"); val frames = db.collection("settings").document("postcard_frames"); val audit = db.collection("adminAudit").document()
                db.runTransaction { tx ->
                    check(same(uid, version)) { "La sesión cambió." }
                    val current = tx.get(settings); val currentFrames = tx.get(frames)
                    check(current.data == old.base && currentFrames.data == old.baseFrames) { "Las postales cambiaron desde otro dispositivo. Guarda un borrador, actualiza y recupera para revisar." }
                    val meta = mapOf("updatedAt" to FieldValue.serverTimestamp(), "updatedBy" to (auth.currentUser?.email ?: ""))
                    tx.set(settings, AdminPostcardPolicy.settings(old.draft, current.data.orEmpty()) + meta, SetOptions.merge())
                    tx.set(frames, mapOf("frames" to old.draft.frames) + meta, SetOptions.merge())
                    tx.set(audit, mapOf("action" to "postcards.updated", "module" to "postcards", "summary" to "Guardó textos y marcos de postales", "details" to mapOf("customFrameCount" to old.draft.frames.size),
                        "actorUid" to uid, "actorEmail" to (auth.currentUser?.email ?: ""), "createdAt" to FieldValue.serverTimestamp()))
                    Unit
                }.await()
                if (same(uid, version)) bind(uid, "Postales guardadas en VisitaLoja.")
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { if (same(uid, version)) mutable.value = old.copy(message = if (e is IllegalArgumentException || e is IllegalStateException) e.message else "No se pudo confirmar el guardado. Conserva un borrador y actualiza antes de repetir.") }
        }
    }
    fun local(action: String) {
        val old = mutable.value; val uid = old.uid ?: return; if (!old.ready || old.busy || auth.currentUser?.uid != uid) return
        val version = epoch; mutable.value = old.copy(busy = true, message = null)
        viewModelScope.launch {
            try {
                val context: Application = getApplication(); var restored: LocalAdminDraft? = null
                val fingerprint = mapOf("settings" to old.base, "frames" to old.baseFrames)
                val rows = withContext(Dispatchers.IO) {
                    when (action) {
                        "save" -> {
                            val data = JSONObject().put("text", JSONObject(old.draft.text)).put("brands", org.json.JSONArray(old.draft.brands.map { mapOf("id" to it.id, "name" to it.name, "color" to it.color, "enabled" to it.enabled) }))
                                .put("frames", org.json.JSONArray(old.draft.frames.map { row -> (listOf("id") + AdminPostcardPolicy.frameFields.keys).associateWith { row.text(it) } }))
                            old.frameDraft?.let { data.put("frameDraft", JSONObject().put("id", it.id).put("text", JSONObject(it.text))) }
                            AdminLocalDrafts.save(context, uid, "postcards", "configuration", "Configuración de postales", fingerprint, data)
                        }
                        "restore" -> restored = AdminLocalDrafts.load(context, uid, "postcards", "configuration")
                        "delete" -> AdminLocalDrafts.remove(context, uid, "postcards", "configuration")
                        "list" -> Unit
                        else -> error("Acción no compatible.")
                    }
                    AdminLocalDrafts.list(context, uid, "postcards")
                }
                if (!same(uid, version)) return@launch
                val saved = restored
                if (saved == null) mutable.value = old.copy(localDrafts = rows, message = when (action) { "save" -> "Borrador guardado en este teléfono para tu cuenta. No se publicó."; "delete" -> "Borrador local eliminado."; else -> null })
                else {
                    val text = AdminLocalDrafts.strings(saved.data.getJSONObject("text")); require(text.keys == AdminPostcardPolicy.fields.keys)
                    val rawBrands = saved.data.getJSONArray("brands")
                    val brands = (0 until rawBrands.length()).map { rawBrands.getJSONObject(it).let { row -> AdminPostcardBrand(row.getString("id"), row.getString("name"), row.getString("color"), row.getBoolean("enabled")) } }
                    require(brands.map { it.id } == AdminPostcardPolicy.brands.map { it.id })
                    val rawFrames = saved.data.getJSONArray("frames")
                    require(rawFrames.length() <= 200)
                    val frames = (0 until rawFrames.length()).map { index ->
                        val row = AdminLocalDrafts.strings(rawFrames.getJSONObject(index)); require(row.keys == (listOf("id") + AdminPostcardPolicy.frameFields.keys).toSet())
                        require(row.getValue("id").matches(Regex("[A-Za-z0-9_-]{1,100}")))
                        old.initial.frames.firstOrNull { it.text("id") == row["id"] }.orEmpty() + row
                    }
                    require(frames.map { it.text("id") }.distinct().size == frames.size)
                    val frameDraft = saved.data.optJSONObject("frameDraft")?.let { row ->
                        val id = row.getString("id"); require(id.matches(Regex("[A-Za-z0-9_-]{1,100}")))
                        val values = AdminLocalDrafts.strings(row.getJSONObject("text")); require(values.keys == AdminPostcardPolicy.frameFields.keys)
                        EditorialDraft(id, frames.firstOrNull { it.text("id") == id }, values)
                    }
                    mutable.value = old.copy(draft = AdminPostcardDraft(text, brands, frames), frameDraft = frameDraft, localDrafts = rows, preview = null,
                        message = if (saved.fingerprint != AdminLocalDrafts.fingerprint(fingerprint)) "Borrador recuperado. La configuración publicada cambió; revisa antes de guardar." else "Borrador recuperado sin publicar.")
                }
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { if (same(uid, version)) mutable.value = old.copy(message = e.message ?: "No se pudo gestionar el borrador.") }
        }
    }
}
