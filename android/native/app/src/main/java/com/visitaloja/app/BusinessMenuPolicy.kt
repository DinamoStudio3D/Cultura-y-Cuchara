package com.visitaloja.app

import com.google.firebase.Timestamp
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.util.Date
import java.util.Locale

internal data class BusinessDish(val key: String, val name: String, val nameEn: String, val price: String, val category: String, val categoryEn: String, val description: String, val descriptionEn: String, val image: String?, val available: Boolean, val tags: List<String>)
internal data class BusinessMenuSource(val id: String, val title: String, val titleEn: String, val published: Boolean, val plan: String, val paid: Boolean, val start: Long?, val end: Long?, val valid: Boolean, val menuActive: Boolean, val menuBenefit: Boolean, val menuTitle: String, val menuTitleEn: String, val dishes: List<BusinessDish>, val phone: String?, val orders: Boolean, val reservations: Boolean, val orderEs: String, val orderEn: String, val reservationEs: String, val reservationEn: String)
internal data class BusinessCatalogue(val id: String, val title: String, val titleEn: String, val menuTitle: String, val menuTitleEn: String, val dishes: List<BusinessDish>, val phone: String?, val orders: Boolean, val reservations: Boolean, val orderEs: String, val orderEn: String, val reservationEs: String, val reservationEn: String)
internal data class BusinessRequest(val reservation: Boolean = false, val dish: String? = null, val quantity: Int = 1, val date: String = "", val time: String = "", val guests: Int = 2, val notes: String = "", val english: Boolean = false)
internal object BusinessMenuPolicy {
    val zone: ZoneId = ZoneId.of("America/Guayaquil")
    private val defaults = mapOf("free" to 0, "impulse" to 0, "featured" to 10, "premium" to 20)
    private fun Map<*, *>.text(key: String, limit: Int = 200) = (this[key] as? String).orEmpty().trim().take(limit)
    private fun Map<*, *>.map(key: String) = this[key] as? Map<*, *> ?: emptyMap<Any, Any>()
    private fun canonical(value: String): String = when (val key = value.trim().lowercase(Locale.ROOT)) { "gratis" -> "free"; "impulso", "emprendo" -> "impulse"; "destacado", "pro", "activo" -> "featured"; else -> key }
    private fun visible(raw: Map<*, *>) = raw["active"] != false && raw["hidden"] != true && raw["published"] != false && raw.text("status").lowercase(Locale.ROOT) !in setOf("draft", "hidden", "deleted", "archived", "inactive") && raw.text("publicationStatus").lowercase(Locale.ROOT) in setOf("", "published")
    private fun date(value: Any?, end: Boolean): Long? = when (value) {
        null, "" -> null
        is Timestamp -> value.toDate().time
        is Date -> value.time
        is String -> runCatching { Instant.parse(value).toEpochMilli() }.getOrNull() ?: runCatching { LocalDate.parse(value).atStartOfDay(zone).let { if (end) it.plusDays(1).minusNanos(1) else it }.toInstant().toEpochMilli() }.getOrNull()
        else -> null
    }
    fun limits(raw: Map<String, Any?>): Map<String, Int> {
        val result = defaults.toMutableMap()
        (raw["plans"] as? List<*>)?.take(100)?.filterIsInstance<Map<*, *>>()?.forEach { plan ->
            val id = canonical(plan.text("id"))
            if (id.isNotBlank()) {
                val legacy = ((plan["offerVersion"] as? Number)?.toInt() ?: 0) < 1
                val configured = (plan.map("features")["maxFeaturedProducts"] as? Number)?.toDouble()?.takeIf { it.isFinite() }?.toInt()?.coerceIn(0, 100)
                result[id] = if (legacy && id in defaults) defaults.getValue(id) else configured ?: defaults[id] ?: 0
            }
        }
        return result
    }
    fun source(id: String, raw: Map<String, Any?>): BusinessMenuSource {
        val sub = raw.map("subscription");val menu = raw.map("menu");val commerce = raw.map("commerce")
        fun point(a: String, b: String) = sub[a]?.takeUnless { it == "" } ?: sub[b]
        val startRaw = point("startAt", "startDate");val endRaw = point("endAt", "endDate")
        val start = date(startRaw, false);val end = date(endRaw, true)
        val plan = canonical(sub.text("plan"));val status = sub.text("status").ifBlank { "active" }.lowercase(Locale.ROOT)
        val dishes = (menu["dishes"] as? List<*>)?.take(200)?.mapIndexedNotNull { index, item ->
            val dish = item as? Map<*, *> ?: return@mapIndexedNotNull null
            val name = dish.text("name").ifBlank { dish.text("nameEn") };val price = dish.text("price", 60)
            if (!visible(dish) || name.isBlank() || price.isBlank()) return@mapIndexedNotNull null
            val tags = listOf("recommended" to "Recomendado", "isNew" to "Nuevo", "vegetarian" to "Vegetariano", "spicy" to "Picante").filter { dish[it.first] == true || dish[it.first] == "true" }.map { it.second }
            BusinessDish(index.toString(), name, dish.text("nameEn"), price, dish.text("category").ifBlank { "Otros" }, dish.text("categoryEn"), dish.text("description", 5000), dish.text("descriptionEn", 5000), DiscoveryPolicy.media(dish.text("image", 4096).replace(" ", "%20")), dish["available"] != false && dish["available"] != "false", tags)
        }.orEmpty()
        val title = raw.text("title")
        return BusinessMenuSource(id, title, raw.text("titleEn"), visible(raw) && title.isNotBlank(), plan, plan.isNotBlank() && plan != "free" && status in setOf("active", "paid", "trial"), start, end,
            (startRaw == null || startRaw == "" || start != null) && (endRaw == null || endRaw == "" || end != null) && (start == null || end == null || start <= end),
            menu["active"] == true, sub.map("benefits")["menu"] == true, menu.text("title").ifBlank { "Productos destacados" }, menu.text("titleEn"), dishes,
            PlacePolicy.whatsapp(commerce.text("whatsapp", 40).ifBlank { sub.text("contactWhatsapp", 40) }), commerce["orderActive"] == true, commerce["reservationActive"] == true,
            commerce.text("orderMessage", 2000).ifBlank { "Hola, deseo realizar un pedido en {negocio}." }, commerce.text("orderMessageEn", 2000).ifBlank { "Hello, I would like to place an order at {negocio}." },
            commerce.text("reservationMessage", 2000).ifBlank { "Hola, deseo reservar una mesa en {negocio}." }, commerce.text("reservationMessageEn", 2000).ifBlank { "Hello, I would like to reserve a table at {negocio}." })
    }
    fun catalogue(source: BusinessMenuSource, limits: Map<String, Int>, now: Long, plansFresh: Boolean): BusinessCatalogue? {
        if (!source.published) return null
        val paid = source.paid && source.valid && (source.start == null || now >= source.start) && (source.end == null || now <= source.end)
        val dishes = if (plansFresh && paid && source.menuActive && source.menuBenefit) source.dishes.take(limits[source.plan] ?: 0) else emptyList()
        return BusinessCatalogue(source.id, source.title, source.titleEn, source.menuTitle, source.menuTitleEn, dishes, source.phone, source.orders && source.phone != null, source.reservations && source.phone != null, source.orderEs, source.orderEn, source.reservationEs, source.reservationEn)
    }
    fun filter(dishes: List<BusinessDish>, query: String, category: String, english: Boolean) = dishes.filter { dish ->
        (category.isBlank() || category == BusinessMenuPolicy.category(dish, english)) && PlacePolicy.normalize(query).split(' ').filter(String::isNotBlank).all { it in PlacePolicy.normalize("${dish.name} ${dish.nameEn} ${dish.category} ${dish.categoryEn} ${dish.description} ${dish.descriptionEn}") }
    }
    fun category(dish: BusinessDish, english: Boolean) = if (english) dish.categoryEn.ifBlank { dish.category } else dish.category
    fun error(menu: BusinessCatalogue, request: BusinessRequest, now: Long): String? {
        if (menu.phone == null || (if (request.reservation) !menu.reservations else !menu.orders)) return "Esta opción ya no está disponible."
        if (request.notes.length > 1000 || request.notes.any { it.isISOControl() && it != '\n' }) return "Revisa las indicaciones del mensaje."
        if (request.reservation) {
            val date = runCatching { LocalDate.parse(request.date) }.getOrNull() ?: return "Selecciona una fecha."
            val time = runCatching { LocalTime.parse(request.time) }.getOrNull() ?: return "Selecciona una hora."
            if (request.guests !in 1..30) return "Indica entre 1 y 30 personas."
            if (date.atTime(time).atZone(zone).toInstant().toEpochMilli() <= now) return "Selecciona una fecha y hora futuras (hora de Ecuador)."
        } else if (request.dish != null) {
            if (request.quantity !in 1..20 || menu.dishes.none { it.key == request.dish && it.available }) return "El producto no está disponible. Revisa la carta actual."
        }
        return null
    }
    fun message(menu: BusinessCatalogue, request: BusinessRequest): String {
        val title = if (request.english) menu.titleEn.ifBlank { menu.title } else menu.title
        val template = if (request.reservation) { if (request.english) menu.reservationEn else menu.reservationEs } else { if (request.english) menu.orderEn else menu.orderEs }
        val header = template.replace(Regex("\\{negocio\\}", RegexOption.IGNORE_CASE)) { title }
        val details = if (request.reservation) "${if (request.english) "Date" else "Fecha"}: ${request.date}\n${if (request.english) "Time (Ecuador)" else "Hora (Ecuador)"}: ${request.time}\n${if (request.english) "Guests" else "Personas"}: ${request.guests}" else menu.dishes.find { it.key == request.dish }?.let { dish -> "${request.quantity} × ${if (request.english) dish.nameEn.ifBlank { dish.name } else dish.name}\n${if (request.english) "Published price" else "Precio publicado"}: ${dish.price}" }.orEmpty()
        return listOf(header, details, request.notes.trim(), "${if (request.english) "Please confirm availability and conditions." else "Por favor, confirma disponibilidad y condiciones."}\nVisitaLoja.com").filter(String::isNotBlank).joinToString("\n\n")
    }
}
