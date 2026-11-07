package com.visitaloja.app

import org.json.JSONArray
import org.json.JSONObject
import java.net.URI
import java.text.Normalizer

data class PlacePhoto(val url: String, val caption: String = "", val credit: String = "")

data class MapBrand(val logoUrl: String? = null, val iconClass: String = "", val style: String = "", val paidLogo: Boolean = false, val start: Long? = null, val end: Long? = null)

data class Place(
    val id: String, val title: String, val categories: List<String>, val address: String,
    val description: String, val imageUrl: String?, val cantonId: String = "loja",
    val active: Boolean = true, val publicationStatus: String = "published", val status: String = "",
    val latitude: Double? = null, val longitude: Double? = null,
    val photos: List<PlacePhoto> = emptyList(), val phone: String? = null, val whatsapp: String? = null, val slug: String = "", val mapBrand: MapBrand = MapBrand(), val missionCategory: String? = null, val missionCanton: String? = null, val menuQrId: String? = null, val info: PlaceInfo = PlaceInfo(), val media: PlaceMedia = PlaceMedia(), val promotion: PlacePromotion = PlacePromotion(), val support: SupportPlan = SupportPlan()
) {
    val categoryLabel: String get() = when (categories.firstOrNull()) {
        "cafe" -> "Cafetería"
        "hotel", "hostal", "hospedaje", "alojamiento" -> "Hospedaje"
        "restaurante", "hueca", "urbana", "asadero", "cevicheria" -> "Gastronomía"
        "turismo" -> "Turismo"
        "aliado" -> "Marca aliada"
        "panaderia" -> "Panadería"
        "heladeria" -> "Heladería"
        "bar" -> "Bar"
        "artesania" -> "Comercio local"
        else -> "Parada de VisitaLoja"
    }
}
object PlacePolicy {
    private val hidden = setOf("hidden", "draft", "archived", "inactive", "deleted")
    private val food = setOf("cafe", "hueca", "urbana", "heladeria", "panaderia", "bar", "restaurante", "asadero", "cevicheria")
    private val lodging = setOf("hotel", "hostal", "hospedaje", "alojamiento")
    private val ignored = setOf("de", "en", "el", "la", "los", "las", "un", "una", "para", "con", "y", "del", "al")
    private val aliases = mapOf(
        "cafeteria" to setOf("cafe", "cafeteria", "coffee"), "cafeterias" to setOf("cafe", "cafeteria", "coffee"),
        "cafes" to setOf("cafe", "cafeteria"), "hoteles" to lodging, "hospedaje" to lodging,
        "restaurantes" to food, "comida" to food, "gastronomia" to food
    )
    fun normalize(value: String): String = Normalizer.normalize(value, Normalizer.Form.NFD)
        .replace(Regex("\\p{M}+"), "").lowercase(java.util.Locale.ROOT).replace(Regex("[^a-z0-9]+"), " ").trim()
    fun published(place: Place): Boolean = place.active && place.publicationStatus in setOf("", "published") && place.status !in hidden && place.title.isNotBlank()
    fun matches(place: Place, query: String = "", category: String = "all"): Boolean {
        if (!published(place)) return false
        if (category != "all" && when (category) { "food" -> place.categories.none { it in food }; "hotel" -> place.categories.none { it in lodging }; else -> category !in place.categories }) return false
        val haystack = normalize(listOf(place.title, place.address, place.description, place.cantonId, place.categories.joinToString(" ")).joinToString(" "))
        return normalize(query).split(" ").filter { it.isNotBlank() && it !in ignored }.all { term ->
            (aliases[term] ?: setOf(term)).any(haystack::contains)
        }
    }
    fun safeImage(value: String?): String? = try {
        value?.takeIf { it.length <= 4096 }?.let(::URI)?.takeIf { it.scheme == "https" && !it.host.isNullOrBlank() && it.userInfo == null }?.toASCIIString()
    } catch (_: Exception) { null }
    fun safePhone(value: String?): String? {
        val raw = value?.trim() ?: return null
        if (!raw.matches(Regex("[+0-9 () .-]{7,30}")) || raw.count { it == '+' } > 1 || '+' in raw.drop(1)) return null
        val digits = raw.filter(Char::isDigit)
        return digits.takeIf { it.length in 7..15 }?.let { if (raw.startsWith("+")) "+$it" else it }
    }
    fun whatsapp(value: String?): String? {
        val digits = safePhone(value)?.filter(Char::isDigit) ?: return null
        val international = when { digits.length == 10 && digits.startsWith("09") -> "593" + digits.drop(1); digits.length == 9 && digits.startsWith("9") -> "593$digits"; else -> digits }
        return international.takeIf { it.length in 10..15 && !it.startsWith("0") }
    }
    fun publicUrl(place: Place): String {
        val slug = normalize(place.slug.ifBlank { place.title.ifBlank { place.id } }).replace(' ', '-')
        return if (slug.isBlank()) "https://www.visitaloja.com/" else "https://www.visitaloja.com/parada/$slug"
    }
    fun safeCoordinate(value: Double?, latitude: Boolean): Double? = value?.takeIf { it.isFinite() && it in (if (latitude) -90.0..90.0 else -180.0..180.0) }
}
object PlaceJson {
    private fun JSONObject.text(key: String): String = optJSONObject(key)?.optString("stringValue", "") ?: ""
    private fun JSONObject.coordinate(key: String): Double? = optJSONObject(key)?.let { value ->
        when { value.has("doubleValue") -> value.optDouble("doubleValue"); value.has("integerValue") -> value.optString("integerValue").toDoubleOrNull(); else -> null }
    }
    private fun JSONObject.date(key: String, end: Boolean = false): Long? {
        val raw = optJSONObject(key)?.let { it.optString("timestampValue").ifBlank { it.optString("stringValue") } }.orEmpty()
        return runCatching { java.time.Instant.parse(raw).toEpochMilli() }.getOrNull()
            ?: runCatching { java.time.LocalDate.parse(raw).atStartOfDay(java.time.ZoneId.of("America/Guayaquil")).let { if (end) it.plusDays(1).minusNanos(1) else it }.toInstant().toEpochMilli() }.getOrNull()
    }
    fun document(document: JSONObject): Place? {
        val fields = document.optJSONObject("fields") ?: return null
        val id = document.optString("name").substringAfterLast('/')
        val category = fields.optJSONObject("category")
        val categories = category?.optJSONObject("arrayValue")?.optJSONArray("values")?.let { array ->
            (0 until array.length()).mapNotNull { array.optJSONObject(it)?.optString("stringValue")?.takeIf(String::isNotBlank) }
        } ?: listOf(fields.text("category")).filter(String::isNotBlank)
        val missionCategory = listOf("category", "categoria", "type", "tipo").firstNotNullOfOrNull { key ->
            fields.optJSONObject(key)?.let { raw ->
                if (raw.has("arrayValue")) raw.optJSONObject("arrayValue")?.optJSONArray("values")?.let { list -> (0 until list.length()).joinToString(",") { list.optJSONObject(it)?.optString("stringValue").orEmpty() } } ?: ""
                else raw.optString("stringValue").trim().takeIf(String::isNotBlank)
            }
        }?.trim()?.takeIf(String::isNotBlank)
        val gallery = fields.optJSONObject("gallery")?.optJSONObject("arrayValue")?.optJSONArray("values") ?: JSONArray()
        val hero = fields.text("heroImage").ifBlank {
            fields.optJSONObject("heroImage")?.optJSONObject("mapValue")?.optJSONObject("fields")?.let { it.text("url").ifBlank { it.text("img") } } ?: ""
        }
        val candidates = listOf(hero) + (0 until gallery.length()).map { index ->
            gallery.optJSONObject(index)?.optJSONObject("mapValue")?.optJSONObject("fields")?.text("img") ?: ""
        }
        val photos = (0 until gallery.length()).mapNotNull { index ->
            val item = gallery.optJSONObject(index) ?: return@mapNotNull null
            val data = item.optJSONObject("mapValue")?.optJSONObject("fields")
            val url = PlacePolicy.safeImage(item.optString("stringValue").ifBlank { data?.let { it.text("img").ifBlank { it.text("url") } } ?: "" }) ?: return@mapNotNull null
            PlacePhoto(url, data?.text("caption").orEmpty().take(300), data?.let { it.text("credit").ifBlank { it.text("author") } }.orEmpty().take(200))
        }.distinctBy { it.url }.take(30)
        val profile = fields.optJSONObject("businessProfile")?.optJSONObject("mapValue")?.optJSONObject("fields")
        val subscription = fields.optJSONObject("subscription")?.optJSONObject("mapValue")?.optJSONObject("fields") ?: JSONObject()
        val benefits = subscription.optJSONObject("benefits")?.optJSONObject("mapValue")?.optJSONObject("fields")
        val result = Place(
            id = id, title = fields.text("title"), categories = categories, address = fields.text("address"),
            description = fields.text("description").ifBlank { fields.text("desc") }.replace(Regex("<[^>]*>"), "").trim(),
            imageUrl = candidates.firstNotNullOfOrNull(PlacePolicy::safeImage) ?: photos.firstOrNull()?.url, cantonId = fields.text("cantonId").ifBlank { "loja" },
            active = fields.optJSONObject("active")?.optBoolean("booleanValue", true) ?: true,
            publicationStatus = fields.text("publicationStatus"), status = fields.text("status"),
            latitude = PlacePolicy.safeCoordinate(fields.coordinate("lat"), true), longitude = PlacePolicy.safeCoordinate(fields.coordinate("lng"), false),
            photos = photos, phone = PlacePolicy.safePhone(profile?.text("phone")), whatsapp = PlacePolicy.whatsapp(profile?.text("whatsapp")), slug = fields.text("slug"),
            support = SupportersPolicy.read(fields), promotion = PromotionPolicy.read(fields), media = PlaceMediaPolicy.read(fields), info = PlaceInfoPolicy.read(fields), menuQrId = fields.text("menuQrId").takeIf(MenuPolicy::validId), missionCategory = missionCategory, missionCanton = fields.text("cantonId").trim().takeIf(String::isNotBlank),
            mapBrand = MapBrand(PlacePolicy.safeImage(fields.text("customLogoUrl")), fields.text("iconClass").take(60), fields.text("mapMarkerStyle").take(20),
                subscription.text("plan").isNotBlank() && subscription.text("plan") != "free" && subscription.text("status") !in setOf("paused", "pending", "expired", "suspended") && benefits?.optJSONObject("logoPin")?.optBoolean("booleanValue") == true,
                subscription.date("startAt") ?: subscription.date("startDate"), subscription.date("endAt", true) ?: subscription.date("endDate", true))
        )
        return result.takeIf { id.isNotBlank() && PlacePolicy.published(it) }
    }
    fun cachePlace(place: Place): JSONObject = JSONObject().put("id", place.id).put("title", place.title)
        .put("categories", JSONArray(place.categories)).put("address", place.address).put("description", place.description)
        .put("imageUrl", place.imageUrl ?: JSONObject.NULL).put("cantonId", place.cantonId)
        .put("media", PlaceMediaPolicy.cache(place.media))
        .put("info", PlaceInfoPolicy.cache(place.info))
        .put("menuQrId", place.menuQrId ?: JSONObject.NULL)
        .put("missionCategory", place.missionCategory ?: JSONObject.NULL).put("missionCanton", place.missionCanton ?: JSONObject.NULL)
        .put("photos", JSONArray(place.photos.map { JSONObject().put("url", it.url).put("caption", it.caption).put("credit", it.credit) }))
        .put("phone", place.phone ?: JSONObject.NULL).put("whatsapp", place.whatsapp ?: JSONObject.NULL).put("slug", place.slug)
        .put("mapBrand", JSONObject().put("logoUrl", place.mapBrand.logoUrl ?: JSONObject.NULL).put("iconClass", place.mapBrand.iconClass).put("style", place.mapBrand.style).put("paidLogo", place.mapBrand.paidLogo).put("start", place.mapBrand.start ?: JSONObject.NULL).put("end", place.mapBrand.end ?: JSONObject.NULL))
        .put("latitude", place.latitude ?: JSONObject.NULL).put("longitude", place.longitude ?: JSONObject.NULL)
    fun cached(value: JSONObject): Place? {
        val categories = value.optJSONArray("categories") ?: JSONArray()
        return Place(value.optString("id"), value.optString("title"), (0 until categories.length()).map { categories.optString(it) },
            value.optString("address"), value.optString("description"), PlacePolicy.safeImage(value.optString("imageUrl")),
            value.optString("cantonId", "loja"), latitude = value.optDouble("latitude").takeIf { !value.isNull("latitude") }?.let { PlacePolicy.safeCoordinate(it, true) },
            longitude = value.optDouble("longitude").takeIf { !value.isNull("longitude") }?.let { PlacePolicy.safeCoordinate(it, false) },
            photos = value.optJSONArray("photos")?.let { a -> (0 until a.length()).mapNotNull { i ->
                val photo = a.optJSONObject(i) ?: return@mapNotNull null
                PlacePolicy.safeImage(photo.optString("url"))?.let { PlacePhoto(it, photo.optString("caption").take(300), photo.optString("credit").take(200)) }
            }.distinctBy { it.url }.take(30) } ?: emptyList(),
            media = PlaceMediaPolicy.cached(value.optJSONObject("media")), info = PlaceInfoPolicy.cached(value.optJSONObject("info")), menuQrId = value.optString("menuQrId").takeIf(MenuPolicy::validId), missionCategory = value.optString("missionCategory").takeUnless { value.isNull("missionCategory") || it.isBlank() }, missionCanton = value.optString("missionCanton").takeUnless { value.isNull("missionCanton") || it.isBlank() },
            phone = PlacePolicy.safePhone(value.optString("phone")), whatsapp = PlacePolicy.whatsapp(value.optString("whatsapp")), slug = value.optString("slug"), mapBrand = value.optJSONObject("mapBrand")?.let { brand ->
                MapBrand(PlacePolicy.safeImage(brand.optString("logoUrl")), brand.optString("iconClass").take(60), brand.optString("style").take(20), brand.optBoolean("paidLogo"),
                    brand.optLong("start").takeIf { brand.has("start") && !brand.isNull("start") }, brand.optLong("end").takeIf { brand.has("end") && !brand.isNull("end") })
            } ?: MapBrand()
        ).takeIf { it.id.isNotBlank() && PlacePolicy.published(it) }
    }
}
