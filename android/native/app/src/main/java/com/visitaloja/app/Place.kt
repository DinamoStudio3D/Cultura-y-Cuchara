package com.visitaloja.app

import org.json.JSONArray
import org.json.JSONObject
import java.net.URI
import java.text.Normalizer

data class Place(
    val id: String, val title: String, val categories: List<String>, val address: String,
    val description: String, val imageUrl: String?, val cantonId: String = "loja",
    val active: Boolean = true, val publicationStatus: String = "published", val status: String = "",
    val latitude: Double? = null, val longitude: Double? = null
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
    fun safeCoordinate(value: Double?, latitude: Boolean): Double? = value?.takeIf { it.isFinite() && it in (if (latitude) -90.0..90.0 else -180.0..180.0) }
}
object PlaceJson {
    private fun JSONObject.text(key: String): String = optJSONObject(key)?.optString("stringValue", "") ?: ""
    private fun JSONObject.coordinate(key: String): Double? = optJSONObject(key)?.let { value ->
        when { value.has("doubleValue") -> value.optDouble("doubleValue"); value.has("integerValue") -> value.optString("integerValue").toDoubleOrNull(); else -> null }
    }
    fun document(document: JSONObject): Place? {
        val fields = document.optJSONObject("fields") ?: return null
        val id = document.optString("name").substringAfterLast('/')
        val category = fields.optJSONObject("category")
        val categories = category?.optJSONObject("arrayValue")?.optJSONArray("values")?.let { array ->
            (0 until array.length()).mapNotNull { array.optJSONObject(it)?.optString("stringValue")?.takeIf(String::isNotBlank) }
        } ?: listOf(fields.text("category")).filter(String::isNotBlank)
        val gallery = fields.optJSONObject("gallery")?.optJSONObject("arrayValue")?.optJSONArray("values") ?: JSONArray()
        val hero = fields.text("heroImage").ifBlank {
            fields.optJSONObject("heroImage")?.optJSONObject("mapValue")?.optJSONObject("fields")?.let { it.text("url").ifBlank { it.text("img") } } ?: ""
        }
        val candidates = listOf(hero) + (0 until gallery.length()).map { index ->
            gallery.optJSONObject(index)?.optJSONObject("mapValue")?.optJSONObject("fields")?.text("img") ?: ""
        }
        val result = Place(
            id = id, title = fields.text("title"), categories = categories, address = fields.text("address"),
            description = fields.text("description").ifBlank { fields.text("desc") }.replace(Regex("<[^>]*>"), "").trim(),
            imageUrl = candidates.firstNotNullOfOrNull(PlacePolicy::safeImage), cantonId = fields.text("cantonId").ifBlank { "loja" },
            active = fields.optJSONObject("active")?.optBoolean("booleanValue", true) ?: true,
            publicationStatus = fields.text("publicationStatus"), status = fields.text("status"),
            latitude = PlacePolicy.safeCoordinate(fields.coordinate("lat"), true), longitude = PlacePolicy.safeCoordinate(fields.coordinate("lng"), false)
        )
        return result.takeIf { id.isNotBlank() && PlacePolicy.published(it) }
    }
    fun cachePlace(place: Place): JSONObject = JSONObject().put("id", place.id).put("title", place.title)
        .put("categories", JSONArray(place.categories)).put("address", place.address).put("description", place.description)
        .put("imageUrl", place.imageUrl ?: JSONObject.NULL).put("cantonId", place.cantonId)
        .put("latitude", place.latitude ?: JSONObject.NULL).put("longitude", place.longitude ?: JSONObject.NULL)
    fun cached(value: JSONObject): Place? {
        val categories = value.optJSONArray("categories") ?: JSONArray()
        return Place(value.optString("id"), value.optString("title"), (0 until categories.length()).map { categories.optString(it) },
            value.optString("address"), value.optString("description"), PlacePolicy.safeImage(value.optString("imageUrl")),
            value.optString("cantonId", "loja"), latitude = value.optDouble("latitude").takeIf { !value.isNull("latitude") }?.let { PlacePolicy.safeCoordinate(it, true) },
            longitude = value.optDouble("longitude").takeIf { !value.isNull("longitude") }?.let { PlacePolicy.safeCoordinate(it, false) }
        ).takeIf { it.id.isNotBlank() && PlacePolicy.published(it) }
    }
}
