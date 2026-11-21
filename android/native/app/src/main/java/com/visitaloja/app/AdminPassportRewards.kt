package com.visitaloja.app

import android.app.Application
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
import java.util.UUID

internal data class PassportModeDraft(val primary: Map<String, String>, val choices: Map<String, Map<String, String>> = emptyMap())
internal object AdminPassportRewardPolicy {
    val modes = linkedMapOf("tourist" to "Turista", "local" to "Lojano")
    val fields = linkedMapOf("title" to ("Nombre del premio" to 100), "description" to ("Condiciones e instrucciones" to 400), "imageUrl" to ("Imagen · enlace opcional" to 4096), "code" to ("Código o referencia editorial" to 40), "buttonText" to ("Texto del botón" to 50), "url" to ("Enlace de entrega o WhatsApp · HTTPS" to 2000))
    private val choiceKeys = setOf("active", "title", "description", "merchantUid")
    private fun defaults(mode: String): Map<String, String> = mapOf("active" to "true", "title" to if (mode == "tourist") "Explorador de Sabores de Loja" else "Embajador de los Sabores Lojanos", "description" to if (mode == "tourist") "¡Completaste tu recorrido! Presenta este pasaporte para recibir la recompensa disponible." else "¡Redescubriste nuestra ciudad! Presenta este pasaporte para recibir la recompensa disponible.", "imageUrl" to "", "code" to if (mode == "tourist") "TURISTA-LOJA" else "SOY-LOJANO", "buttonText" to "Solicitar mi premio", "url" to "", "merchantUid" to "")
    private fun text(row: Map<String, Any?>, keys: Set<String>, fallback: Map<String, String>): Map<String, String> = keys.associateWith { key ->
        val value = row[key]
        if (key == "active") { require(value == null || value is Boolean); (value != false).toString() }
        else { require(value == null || value is String) { "Campo de premio incompatible: $key" }; value as? String ?: fallback[key].orEmpty() }
    }
    fun read(base: Map<String, Any?>): Map<String, PassportModeDraft> = modes.keys.associateWith { mode ->
        val row = AdminPlatformPolicy.map(base[mode]); val choices = AdminPlatformPolicy.map(row["choices"])
        require(choices.size <= 100) { "Hay demasiadas alternativas. Usa la web." }
        val primary = AdminPlatformPolicy.map(choices["primary"])
        val primaryFields = text(row, fields.keys + setOf("active", "merchantUid"), defaults(mode)).toMutableMap()
        if (primary.isNotEmpty()) {
            require(primary["active"] == null || primary["active"] == (row["active"] != false)) { "La visibilidad del principal difiere de su modalidad. Revisa esa configuración en la web." }
            primaryFields.putAll(text(primary, choiceKeys - "active", primaryFields))
        }
        val others = choices.filterKeys { it != "primary" }.mapValues { (id, value) ->
            require(id.length in 1..80 && '/' !in id) { "ID de alternativa incompatible. Usa la web." }
            text(AdminPlatformPolicy.map(value), choiceKeys, emptyMap())
        }
        PassportModeDraft(primaryFields, others)
    }
    fun validate(draft: Map<String, PassportModeDraft>, base: Map<String, Any?>, merchants: Map<String, Map<String, Any?>>) {
        require(base.text("campaignId").matches(Regex("[A-Za-z0-9_-]{1,60}"))) { "Configura primero una campaña válida en la web." }
        require(draft.keys == modes.keys)
        val initial = read(base)
        draft.forEach { (mode, value) ->
            require(value.primary.keys == fields.keys + setOf("active", "merchantUid") && value.choices.values.all { it.keys == choiceKeys }) { "Borrador de premios incompatible." }
            require(value.choices.size <= maxOf(9, initial.getValue(mode).choices.size)) { "Máximo nueve alternativas, además del premio principal." }
            fields.forEach { (key, info) -> require(value.primary[key].orEmpty().length <= info.second) { "Revisa " + info.first } }
            val url = value.primary["url"].orEmpty().trim(); val image = value.primary["imageUrl"].orEmpty().trim()
            require(url.isEmpty() || url.startsWith("https://", true) && DiscoveryPolicy.media(url) != null) { "Usa un enlace HTTPS para la entrega." }
            require(image.isEmpty() || DiscoveryPolicy.media(image) != null) { "Revisa el enlace de imagen del premio." }
            fun recipient(row: Map<String, String>, alternative: Boolean) {
                require(row["active"] in setOf("true", "false"))
                require(row["title"].orEmpty().length <= 100 && row["description"].orEmpty().length <= 400 && row["merchantUid"].orEmpty().length <= 128)
                val uid = row["merchantUid"].orEmpty()
                if (uid.isNotBlank()) require(merchants[uid]?.get("active") == true) { "El negocio de entrega ya no está activo. Elige otro o retira su asignación." }
                if (row["active"] == "true") {
                    require(row["title"].orEmpty().isNotBlank()) { "Cada premio activo necesita nombre." }
                    require(if (alternative) uid.isNotBlank() else uid.isNotBlank() || url.isNotBlank()) { "Cada alternativa activa necesita un negocio; el principal permite negocio o enlace HTTPS." }
                }
            }
            recipient(value.primary, false)
            value.choices.forEach { (id, row) -> require(id != "primary" && id.matches(Regex("[A-Za-z0-9_-]{1,80}"))); recipient(row, true) }
        }
    }
    fun patch(draft: Map<String, PassportModeDraft>, base: Map<String, Any?>): Map<String, Any?> = draft.mapValues { (mode, value) ->
        val row = AdminPlatformPolicy.map(base[mode]); val oldChoices = AdminPlatformPolicy.map(row["choices"])
        fun values(text: Map<String, String>): Map<String, Any?> = text.mapValues { (key, v) -> if (key == "active") v == "true" else v.trim() }
        val choices = value.choices.mapValues { (id, text) -> AdminPlatformPolicy.map(oldChoices[id]) + values(text) }.toMutableMap()
        if (choices.isNotEmpty() || row["choices"] != null) choices["primary"] = AdminPlatformPolicy.map(oldChoices["primary"]) + values(value.primary.filterKeys { it in choiceKeys })
        row + values(value.primary) + ("choices" to if (choices.isEmpty()) null else choices)
    }
    fun grants(merchant: Map<String, Any?>, uid: String, campaign: String, draft: Map<String, PassportModeDraft>): List<String> {
        val raw = merchant["passportGrants"]
        require(raw == null || raw is List<*> && raw.size <= 1000 && raw.all { it is String }) { "Permisos de canje incompatibles. Usa la web." }
        val result = (raw as? List<*>)?.filterIsInstance<String>().orEmpty().filter { it !in setOf("$campaign:turista", "$campaign:lojano") }.toMutableList()
        draft.forEach { (mode, value) ->
            // Match the shared editor: the assigned primary merchant receives the grant;
            // alternatives grant access only while offered. Other campaigns remain unchanged.
            if (value.primary["merchantUid"] == uid || value.choices.values.any { it["active"] == "true" && it["merchantUid"] == uid }) result += campaign + if (mode == "tourist") ":turista" else ":lojano"
        }
        require(result.size <= 1000); return result.distinct()
    }
}
internal data class PassportRewardState(val uid: String? = null, val busy: Boolean = false, val ready: Boolean = false,
    val base: Map<String, Any?>? = null, val merchants: Map<String, Map<String, Any?>> = emptyMap(),
    val draft: Map<String, PassportModeDraft> = emptyMap(), val initial: Map<String, PassportModeDraft> = emptyMap(),
    val localDrafts: List<LocalAdminDraft> = emptyList(), val message: String? = null)
internal class AdminPassportRewardsViewModel(app: Application) : AndroidViewModel(app) {
    private val auth = FirebaseAuth.getInstance(); private val db = FirebaseFirestore.getInstance()
    private val mutable = MutableStateFlow(PassportRewardState()); val state = mutable.asStateFlow(); private var epoch = 0
    private fun same(uid: String, version: Int) = epoch == version && auth.currentUser?.uid == uid && mutable.value.uid == uid
    private fun ref() = db.collection("siteContent").document("passport")
    private suspend fun authorize(uid: String) {
        val user = auth.currentUser?.takeIf { it.uid == uid } ?: error("La sesión cambió.")
        val claims = user.getIdToken(true).await().claims
        check(AdminPlacePolicy.allowed(user.email, claims, emptyMap()) || AdminPlacePolicy.allowed(user.email, claims, db.collection("adminUsers").document(uid).get(Source.SERVER).await().data.orEmpty())) { "Necesitas administración general." }
    }
    fun bind(uid: String?, notice: String? = null) {
        val version = ++epoch; mutable.value = PassportRewardState(uid, busy = uid != null); if (uid == null) return
        viewModelScope.launch {
            try {
                authorize(uid); val doc = ref().get(Source.SERVER).await()
                require(doc.data?.text("campaignId")?.isNotBlank() == true) { "Configura primero la campaña de pasaporte en la web." }
                val merchants = linkedMapOf<String, Map<String, Any?>>(); var cursor: DocumentSnapshot? = null; var more: Boolean
                do {
                    var query: Query = db.collection("missionRewardMerchants").orderBy(FieldPath.documentId()).limit(100); cursor?.let { query = query.startAfter(it) }
                    val page = query.get(Source.SERVER).await(); if (!same(uid, version)) return@launch
                    page.documents.forEach { merchants[it.id] = it.data.orEmpty() }; check(merchants.size <= 400) { "Más de 400 negocios de canje. Usa la web para esta campaña." }
                    cursor = page.documents.lastOrNull(); more = page.size() == 100
                } while (more)
                val draft = AdminPassportRewardPolicy.read(doc.data.orEmpty())
                if (same(uid, version)) mutable.value = PassportRewardState(uid, ready = true, base = doc.data, merchants = merchants, initial = draft, draft = draft, message = notice)
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { if (same(uid, version)) mutable.value = mutable.value.copy(busy = false, message = e.message ?: "No se pudieron cargar los premios.") }
        }
    }
    private fun change(action: (PassportRewardState) -> PassportRewardState) { val old = mutable.value; if (!old.ready || old.busy || auth.currentUser?.uid != old.uid) return
        try { mutable.value = action(old).copy(message = null) } catch (e: Exception) { mutable.value = old.copy(message = e.message) }
    }
    fun edit(mode: String, id: String, key: String, value: String) = change { old ->
        val d = old.draft.getValue(mode)
        val updated = if (id == "primary") d.copy(primary = d.primary + (key to value)) else d.copy(choices = d.choices + (id to (d.choices.getValue(id) + (key to value))))
        old.copy(draft = old.draft + (mode to updated))
    }
    fun add(mode: String) = change { old -> val d = old.draft.getValue(mode); require(d.choices.size < 9) { "Se admiten nueve alternativas." }
        old.copy(draft = old.draft + (mode to d.copy(choices = d.choices + (("reward-" + UUID.randomUUID()) to mapOf("active" to "true", "title" to "", "description" to "", "merchantUid" to "")))))
    }
    fun remove(mode: String, id: String) = change { old -> val d = old.draft.getValue(mode); old.copy(draft = old.draft + (mode to d.copy(choices = d.choices - id))) }
    fun save() {
        val old = mutable.value; val uid = old.uid ?: return; if (!old.ready || old.busy) return
        val patch = try { AdminPassportRewardPolicy.validate(old.draft, old.base.orEmpty(), old.merchants); AdminPassportRewardPolicy.patch(old.draft, old.base.orEmpty()) } catch (e: Exception) { mutable.value = old.copy(message = e.message); return }
        val version = epoch; mutable.value = old.copy(busy = true, message = null)
        viewModelScope.launch {
            try {
                authorize(uid); val target = ref(); val audit = db.collection("adminAudit").document(); val campaign = old.base.orEmpty().text("campaignId")
                db.runTransaction { tx ->
                    check(same(uid, version)) { "La sesión cambió." }; val current = tx.get(target)
                    check(current.data == old.base) { "La campaña cambió en otra sesión. Guarda un borrador y actualiza para revisar." }
                    val fresh = old.merchants.keys.associateWith { id -> tx.get(db.collection("missionRewardMerchants").document(id)).data ?: error("Un negocio se eliminó. Actualiza el catálogo.") }
                    check(fresh == old.merchants) { "Los negocios o sus permisos cambiaron. Guarda un borrador y actualiza." }
                    AdminPassportRewardPolicy.validate(old.draft, current.data.orEmpty(), fresh)
                    val grants = fresh.mapValues { (id, row) -> AdminPassportRewardPolicy.grants(row, id, campaign, old.draft) }
                    // Replace whole mode maps so removing a choice also removes its Firestore key.
                    val changes = patch + mapOf("updatedAt" to FieldValue.serverTimestamp(), "updatedBy" to (auth.currentUser?.email ?: ""))
                    tx.set(target, changes, SetOptions.mergeFields(changes.keys.toList()))
                    grants.forEach { (id, values) -> if (values != (fresh.getValue(id)["passportGrants"] ?: emptyList<String>())) tx.update(db.collection("missionRewardMerchants").document(id), mapOf("passportGrants" to values, "updatedAt" to FieldValue.serverTimestamp())) }
                    tx.set(audit, mapOf("action" to "passport.rewards.updated", "module" to "passport", "summary" to "Actualizó premios y negocios de entrega", "details" to mapOf("campaignId" to campaign), "actorUid" to uid, "actorEmail" to (auth.currentUser?.email ?: ""), "createdAt" to FieldValue.serverTimestamp()))
                    Unit
                }.await()
                if (same(uid, version)) bind(uid, "Premios y permisos de entrega guardados juntos. Los códigos y canjes existentes se conservan.")
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { if (same(uid, version)) mutable.value = old.copy(message = if (e is IllegalArgumentException || e is IllegalStateException) e.message else "No se pudo confirmar la publicación. Guarda un borrador y actualiza antes de repetir.") }
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
                        "save" -> AdminLocalDrafts.save(app, uid, "passport-rewards", "configuration", "Premios del pasaporte", old.base, JSONObject().put("campaignId", old.base.orEmpty().text("campaignId")).put("modes", JSONObject(old.draft.mapValues { (_, v) -> mapOf("primary" to v.primary, "choices" to v.choices) })))
                        "restore" -> restored = AdminLocalDrafts.load(app, uid, "passport-rewards", "configuration")
                        "delete" -> AdminLocalDrafts.remove(app, uid, "passport-rewards", "configuration")
                        "list" -> Unit
                        else -> error("Acción incompatible.")
                    }; AdminLocalDrafts.list(app, uid, "passport-rewards")
                }
                if (!same(uid, version)) return@launch
                val saved = restored
                if (saved == null) mutable.value = old.copy(localDrafts = rows, message = when (action) { "save" -> "Borrador guardado en este teléfono, sin publicar."; "delete" -> "Borrador local eliminado."; else -> null })
                else {
                    require(saved.data.getString("campaignId") == old.base.orEmpty().text("campaignId")) { "El borrador pertenece a otra campaña; se conserva sin aplicarlo." }
                    val modes = saved.data.getJSONObject("modes")
                    val draft = AdminPassportRewardPolicy.modes.keys.associateWith { mode -> val row = modes.getJSONObject(mode); val choices = row.getJSONObject("choices")
                        PassportModeDraft(AdminLocalDrafts.strings(row.getJSONObject("primary")), choices.keys().asSequence().associateWith { AdminLocalDrafts.strings(choices.getJSONObject(it)) })
                    }
                    require(draft.values.all { it.choices.size <= 100 })
                    mutable.value = old.copy(draft = draft, localDrafts = rows, message = if (saved.fingerprint != AdminLocalDrafts.fingerprint(old.base)) "Borrador recuperado. La campaña cambió: revisa premios, alternativas y negocios antes de publicar." else "Borrador recuperado sin publicar.")
                }
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { if (same(uid, version)) mutable.value = old.copy(message = e.message ?: "No se pudo gestionar el borrador.") }
        }
    }
}
