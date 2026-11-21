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
import java.math.BigDecimal

internal object AdminPlanPolicy {
    val textFields = linkedMapOf("badge" to ("Etiqueta" to 120), "title" to ("Título" to 200), "subtitle" to ("Descripción" to 700), "promo" to ("Aviso comercial" to 400), "plansTitle" to ("Título del catálogo" to 180), "plansIntro" to ("Introducción del catálogo" to 500))
    val services = linkedMapOf("logoPin" to "Logo en el mapa", "badge" to "Distintivo", "priority" to "Prioridad", "promo" to "Promociones", "stats" to "Estadísticas", "video" to "Video", "menuImageQr" to "QR de carta en imagen", "loyalty" to "Fidelidad", "menu" to "Productos destacados")
    fun canonical(id: String) = when (id.lowercase()) { "gratis" -> "free"; "impulso", "emprendo" -> "impulse"; "destacado", "pro", "activo" -> "featured"; else -> id.lowercase() }
    private fun objectMap(json: JSONObject): Map<String, Any?> = AdminPlatformPolicy.map(AdminLocalDrafts.value(json))
    fun money(value: String): Double {
        val amount = value.trim().toBigDecimalOrNull() ?: throw IllegalArgumentException("Precio: usa un número con punto decimal.")
        require(amount >= BigDecimal.ZERO && amount <= BigDecimal("99999999.99") && amount.stripTrailingZeros().scale() <= 2) { "Precio: usa un importe no negativo de hasta dos decimales." }
        return amount.toDouble()
    }
    fun normalized(row: Map<String, Any?>, catalog: JSONObject): Map<String, Any?> {
        require(listOf("name", "description", "cta").all { row[it] == null || row[it] is String }) { "Textos de plan incompatibles. Usa la web." }
        require(listOf("active", "recommended").all { row[it] == null || row[it] is Boolean }) { "Estado de plan incompatible." }
        val id = row.text("id"); require(id.matches(Regex("[A-Za-z0-9_-]{1,80}"))) { "ID de plan incompatible. Usa la web." }
        val canonical = canonical(id); val spec = catalog.getJSONObject("specs").optJSONObject(canonical)
        val legacy = (row["offerVersion"]?.toString()?.toDoubleOrNull() ?: 0.0) < 1
        val fallback = catalog.getJSONObject("features").optJSONObject(id) ?: catalog.getJSONObject("features").getJSONObject("free")
        val features = (objectMap(fallback) + AdminPlatformPolicy.map(row["features"])).toMutableMap()
        require(services.keys.all { features[it] == null || features[it] is Boolean }) { "Servicios de plan incompatibles." }
        val result = row.toMutableMap()
        if (spec != null) {
            result["name"] = spec.getString("name"); result["offerVersion"] = 1
            if (legacy) {
                val paid = spec.getDouble("monthly") > 0; val products = spec.getInt("products")
                result["monthly"] = spec.getDouble("monthly"); result["annual"] = spec.getDouble("monthly") * 10
                features.putAll(mapOf("maxGalleryImages" to spec.getInt("photos"), "maxFeaturedProducts" to products, "analyticsPeriodMonths" to spec.getInt("months"), "stats" to paid, "video" to paid, "menu" to (products > 0), "menuImageQr" to paid, "loyalty" to true))
            }
        }
        fun number(key: String, fallback: Int): Any = features[key] ?: fallback
        features["maxGalleryImages"] = number("maxGalleryImages", row["maxGalleryImages"]?.toString()?.toIntOrNull() ?: 6)
        features["maxFeaturedProducts"] = number("maxFeaturedProducts", spec?.getInt("products") ?: 0)
        features["analyticsPeriodMonths"] = number("analyticsPeriodMonths", spec?.getInt("months") ?: 1)
        result["features"] = features
        return result
    }
    fun benefits(row: Map<String, Any?>, catalog: JSONObject): List<String> {
        val id = canonical(row.text("id")); val templates = catalog.getJSONObject("templates").optJSONObject(id)
        if (templates == null) return (row["benefits"] as? List<*>)?.filterIsInstance<String>().orEmpty()
        val features = AdminPlatformPolicy.map(row["features"])
        fun count(key: String) = (features[key] as? Number)?.toInt() ?: features[key]?.toString()?.toIntOrNull() ?: 0
        val photos = count("maxGalleryImages"); val products = count("maxFeaturedProducts"); val months = count("analyticsPeriodMonths")
        val list = templates.getJSONArray((if (products > 0) "products" else "none") + "-" + if (months == 1) "one" else "many")
        return (0 until list.length()).map { list.getString(it).replace("{photos}", photos.toString()).replace("{products}", products.toString()).replace("{months}", months.toString()) }
    }
    fun rows(base: Map<String, Any?>, catalog: JSONObject): List<Map<String, Any?>> {
        val raw = base["plans"]
        val list = if (raw == null || raw is List<*> && raw.isEmpty()) AdminPhotoPolicy.rows(AdminLocalDrafts.value(catalog.getJSONObject("defaults").getJSONArray("plans")), 50) else AdminPhotoPolicy.rows(raw, 50)
        require(list.map { it.text("id").lowercase() }.distinct().size == list.size) { "Hay IDs de plan repetidos." }
        return list.map { normalized(it, catalog) }
    }
    fun groups(base: Map<String, Any?>, main: Map<String, Any?>, catalog: JSONObject, rows: List<Map<String, Any?>>): List<PlatformGroup> {
        val defaults = catalog.getJSONObject("defaults")
        val root = textFields.map { (key, info) -> PlatformField("g|$key", info.first, (base[key] as? String) ?: defaults.optString(key), max = info.second) } + listOf(
            PlatformField("g|showSubscriptions", "Mostrar acceso a planes en la web", (main["showSubscriptions"] != false).toString(), "bool"),
            PlatformField("g|showBusinessSignup", "Mostrar Sumar mi negocio en la web", (main["showBusinessSignup"] != false).toString(), "bool"),
            PlatformField("g|subscriptionWhatsapp", "WhatsApp comercial · código de país y número", main.text("subscriptionWhatsapp"), max = 20))
        val groups = mutableListOf(PlatformGroup("general", "Presentación y contacto", true, root))
        rows.forEach { row -> val id = row.text("id"); val features = AdminPlatformPolicy.map(row["features"])
            fun field(key: String, label: String, fallback: String = "", type: String = "text", max: Int = 240) = PlatformField("p|$id|$key", label, row[key]?.toString() ?: fallback, type, max)
            val known = catalog.getJSONObject("specs").has(canonical(id))
            val fields = mutableListOf(field("name", "Nombre del plan", type = if (known) "readonly" else "text", max = 80), field("active", "Visible", "true", "bool"), field("recommended", "Más recomendado", "false", "bool"), field("monthly", "Precio mensual USD", "0", "money", 20), field("annual", "Precio anual USD", "0", "money", 20), field("description", "Descripción", max = 240), field("cta", "Texto del botón", max = 60))
            if (!known) fields += PlatformField("p|$id|benefits", "Beneficios · uno por línea", (row["benefits"] as? List<*>)?.joinToString("\n").orEmpty(), max = 20000)
            services.forEach { (key, label) -> fields += PlatformField("f|$id|$key", label, (features[key] == true).toString(), "bool") }
            listOf("maxGalleryImages" to "Límite de fotografías · 0 a 100", "maxFeaturedProducts" to "Productos destacados · 0 a 100", "analyticsPeriodMonths" to "Historial de estadísticas · meses, 0 a 36").forEach { (key, label) -> fields += PlatformField("f|$id|$key", label, (features[key] as? Number)?.toDouble()?.let { if (it.isFinite() && it % 1.0 == 0.0) it.toLong().toString() else it.toString() } ?: features[key].toString(), "count", max = 3, upper = if (key == "analyticsPeriodMonths") 36.0 else 100.0) }
            groups += PlatformGroup(id, row.text("name"), true, fields)
        }
        return groups
    }
    fun parse(field: PlatformField, value: String): Any {
        require(value.length <= field.max) { "Revisa " + field.label }
        return when (field.type) {
            "money" -> money(value)
            "count" -> value.toIntOrNull()?.takeIf { it in 0..field.upper.toInt() } ?: throw IllegalArgumentException("Revisa " + field.label)
            else -> AdminPlatformPolicy.parse(field, value)
        }
    }
    fun build(base: Map<String, Any?>, rows: List<Map<String, Any?>>, draft: Map<String, String>, groups: List<PlatformGroup>, catalog: JSONObject): Pair<Map<String, Any?>, Map<String, Any?>> {
        require(draft.keys == groups.flatMap { it.fields }.map { it.key }.toSet()) { "El catálogo cambió. Actualiza el editor." }
        val parsed = groups.flatMap { it.fields }.associate { it.key to parse(it, draft.getValue(it.key)) }
        val plans = rows.map { old -> val id = old.text("id"); val fields = parsed.filterKeys { it.startsWith("p|$id|") }.mapKeys { it.key.substringAfterLast('|') }
            val features = AdminPlatformPolicy.map(old["features"]) + parsed.filterKeys { it.startsWith("f|$id|") }.mapKeys { it.key.substringAfterLast('|') }
            var plan = old + fields + ("features" to features)
            require(plan.text("name").isNotBlank() && plan.text("cta").isNotBlank()) { "Completa el nombre y botón de cada plan." }
            if (catalog.getJSONObject("specs").has(canonical(id))) plan = plan + mapOf("name" to old.text("name"), "benefits" to benefits(plan, catalog))
            else plan = plan + ("benefits" to draft["p|$id|benefits"].orEmpty().lines().map(String::trim).filter(String::isNotBlank).also { require(it.size <= 100 && it.all { text -> text.length <= 300 }) { "Revisa los beneficios del plan." } })
            plan
        }
        require(plans.any { it["active"] == true }) { "Debe quedar al menos un plan visible." }
        require(plans.count { it["active"] == true && it["recommended"] == true } <= 1) { "Solo puede haber un plan visible recomendado." }
        val phone = parsed.getValue("g|subscriptionWhatsapp").toString().filter(Char::isDigit)
        require(phone.length in 10..15 && !phone.startsWith("0")) { "WhatsApp: incluye código de país y número, por ejemplo 593." }
        val content = textFields.keys.associateWith { parsed.getValue("g|$it") } + ("plans" to plans)
        val main = mapOf("showSubscriptions" to parsed.getValue("g|showSubscriptions"), "showBusinessSignup" to parsed.getValue("g|showBusinessSignup"), "subscriptionWhatsapp" to phone)
        return content to main
    }
}
internal data class AdminPlansState(val uid: String? = null, val ready: Boolean = false, val busy: Boolean = false, val base: Map<String, Any?>? = null, val main: Map<String, Any?>? = null,
    val rows: List<Map<String, Any?>> = emptyList(), val catalog: JSONObject? = null, val groups: List<PlatformGroup> = emptyList(), val draft: Map<String, String> = emptyMap(), val initial: Map<String, String> = emptyMap(), val localDrafts: List<LocalAdminDraft> = emptyList(), val message: String? = null)
internal class AdminPlansViewModel(app: Application) : AndroidViewModel(app) {
    private val auth = FirebaseAuth.getInstance(); private val db = FirebaseFirestore.getInstance(); private var epoch = 0
    private val mutable = MutableStateFlow(AdminPlansState()); val state = mutable.asStateFlow()
    private fun same(uid: String, version: Int) = version == epoch && auth.currentUser?.uid == uid && mutable.value.uid == uid
    private suspend fun authorize(uid: String) {
        val user = auth.currentUser?.takeIf { it.uid == uid } ?: error("La sesión cambió."); val claims = user.getIdToken(true).await().claims
        check(AdminPlacePolicy.allowed(user.email, claims, emptyMap()) || AdminPlacePolicy.allowed(user.email, claims, db.collection("adminUsers").document(uid).get(Source.SERVER).await().data.orEmpty())) { "Necesitas administración general." }
    }
    fun bind(uid: String?, notice: String? = null) {
        val version = ++epoch; mutable.value = AdminPlansState(uid = uid, busy = uid != null); if (uid == null) return
        viewModelScope.launch { try {
            authorize(uid); val catalog = withContext(Dispatchers.IO) { getApplication<Application>().assets.open("admin-plans-catalog.json").bufferedReader().use { JSONObject(it.readText()) } }
            val doc = db.collection("settings").document("subscriptions").get(Source.SERVER).await(); val main = db.collection("settings").document("main").get(Source.SERVER).await()
            val rows = AdminPlanPolicy.rows(doc.data.orEmpty(), catalog); val groups = AdminPlanPolicy.groups(doc.data.orEmpty(), main.data.orEmpty(), catalog, rows)
            val draft = groups.flatMap { it.fields }.associate { it.key to it.fallback }
            if (same(uid, version)) mutable.value = AdminPlansState(uid = uid, ready = true, base = doc.data, main = main.data, rows = rows, catalog = catalog, groups = groups, draft = draft, initial = draft, message = notice)
        } catch (e: CancellationException) { throw e } catch (e: Exception) { if (same(uid, version)) mutable.value = mutable.value.copy(busy = false, message = e.message ?: "No se pudo cargar el catálogo.") } }
    }
    fun edit(key: String, value: String) { val old = mutable.value; if (old.ready && !old.busy && auth.currentUser?.uid == old.uid && old.groups.flatMap { it.fields }.any { it.key == key && it.type != "readonly" }) mutable.value = old.copy(draft = old.draft + (key to value), message = null) }
    fun save() {
        val old = mutable.value; val uid = old.uid ?: return; if (!old.ready || old.busy) return
        val result = try { AdminPlanPolicy.build(old.base.orEmpty(), old.rows, old.draft, old.groups, old.catalog ?: error("Actualiza el catálogo.")) } catch (e: Exception) { mutable.value = old.copy(message = e.message); return }
        val version = epoch; mutable.value = old.copy(busy = true, message = null)
        viewModelScope.launch { try {
            authorize(uid); val contentRef = db.collection("settings").document("subscriptions"); val mainRef = db.collection("settings").document("main"); val audit = db.collection("adminAudit").document()
            db.runTransaction { tx ->
                check(same(uid, version)); val content = tx.get(contentRef); val main = tx.get(mainRef)
                check(content.data == old.base && main.data == old.main) { "La configuración cambió. Guarda un borrador y actualiza antes de revisar." }
                val stamps = mapOf("updatedAt" to FieldValue.serverTimestamp(), "updatedBy" to (auth.currentUser?.email ?: ""))
                tx.set(contentRef, result.first + stamps, SetOptions.merge()); tx.set(mainRef, result.second + stamps, SetOptions.merge())
                tx.set(audit, mapOf("action" to "plans.catalog.updated", "module" to "subscriptions", "summary" to "Publicó catálogo de planes", "details" to mapOf("planCount" to old.rows.size), "actorUid" to uid, "actorEmail" to (auth.currentUser?.email ?: ""), "createdAt" to FieldValue.serverTimestamp())); Unit
            }.await()
            if (same(uid, version)) bind(uid, "Catálogo y accesos publicados. No se registraron cobros ni se reasignaron planes a negocios.")
        } catch (e: CancellationException) { throw e } catch (e: Exception) { if (same(uid, version)) mutable.value = old.copy(message = if (e is IllegalStateException) e.message else "No se pudo confirmar el guardado. Actualiza antes de repetir.") } }
    }
    private fun baseline(state: AdminPlansState): Map<String, Any?> = mapOf("subscriptions" to state.base, "main" to state.main)
    fun local(action: String) {
        val old = mutable.value; val uid = old.uid ?: return; if (!old.ready || old.busy || auth.currentUser?.uid != uid) return
        val version = epoch; mutable.value = old.copy(busy = true, message = null)
        viewModelScope.launch { try {
            var restored: LocalAdminDraft? = null
            val rows = withContext(Dispatchers.IO) { val app: Application = getApplication()
                when (action) {
                    "save" -> AdminLocalDrafts.save(app, uid, "plans", "catalog", "Catálogo de planes", baseline(old), JSONObject(old.draft))
                    "restore" -> restored = AdminLocalDrafts.load(app, uid, "plans", "catalog")
                    "delete" -> AdminLocalDrafts.remove(app, uid, "plans", "catalog")
                    "list" -> Unit
                    else -> error("Acción incompatible.")
                }; AdminLocalDrafts.list(app, uid, "plans")
            }
            if (!same(uid, version)) return@launch
            val saved = restored
            if (saved == null) mutable.value = old.copy(localDrafts = rows, message = if (action == "save") "Borrador local guardado sin publicar." else null)
            else { val text = AdminLocalDrafts.strings(saved.data); require(text.keys == old.initial.keys) { "La estructura de planes cambió. Usa una versión compatible para revisar este borrador." }
                val fixed = old.groups.flatMap { it.fields }.filter { it.type == "readonly" }.associate { it.key to old.initial.getValue(it.key) }
                mutable.value = old.copy(draft = text + fixed, localDrafts = rows, message = if (saved.fingerprint != AdminLocalDrafts.fingerprint(baseline(old))) "Borrador recuperado. El catálogo publicado cambió: revisa precios y beneficios antes de confirmar." else "Borrador recuperado sin publicar.")
            }
        } catch (e: CancellationException) { throw e } catch (e: Exception) { if (same(uid, version)) mutable.value = old.copy(message = e.message ?: "No se pudo gestionar el borrador.") } }
    }
}
