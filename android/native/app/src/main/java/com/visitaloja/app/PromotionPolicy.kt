package com.visitaloja.app

import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

data class PlacePromotion(val title: String = "", val description: String = "", val image: String? = null, val button: String = "", val url: String? = null, val enabled: Boolean = false, val start: Long? = null, val end: Long? = null, val valid: Boolean = true, val dateOnlyEnd: Boolean = false)
internal object PromotionPolicy {
    private val zone = ZoneId.of("America/Guayaquil")
    private fun JSONObject.text(key: String) = optJSONObject(key)?.optString("stringValue").orEmpty().trim()
    private fun JSONObject.fields(key: String) = optJSONObject(key)?.optJSONObject("mapValue")?.optJSONObject("fields") ?: JSONObject()
    private fun raw(data: JSONObject, vararg keys: String) = keys.firstNotNullOfOrNull { key -> data.optJSONObject(key)?.let { it.optString("timestampValue").ifBlank { it.optString("stringValue") } }?.trim()?.takeIf(String::isNotBlank) }.orEmpty()
    private fun date(raw: String, end: Boolean): Long? = runCatching { Instant.parse(raw).toEpochMilli() }.getOrNull()
        ?: runCatching { LocalDate.parse(raw).atStartOfDay(zone).let { if (end) it.plusDays(1).minusNanos(1) else it }.toInstant().toEpochMilli() }.getOrNull()
    fun read(fields: JSONObject): PlacePromotion {
        val sub = fields.fields("subscription"); val promo = sub.fields("promotion")
        val starts = listOf(raw(sub, "startAt", "startDate"), raw(promo, "startAt", "startDate"))
        val ends = listOf(raw(sub, "endAt", "endDate"), raw(promo, "endAt", "endDate"))
        val startTimes = starts.map { date(it, false) }; val endTimes = ends.map { date(it, true) }
        val start = startTimes.filterNotNull().maxOrNull(); val end = endTimes.filterNotNull().minOrNull()
        val valid = starts.zip(startTimes).all { (raw, parsed) -> raw.isBlank() || parsed != null } && ends.zip(endTimes).all { (raw, parsed) -> raw.isBlank() || parsed != null } && (start == null || end == null || start <= end)
        val enabled = sub.text("plan").isNotBlank() && sub.text("plan") != "free" && sub.text("status") !in setOf("paused", "pending", "expired", "suspended") && sub.fields("benefits").optJSONObject("promo")?.opt("booleanValue") == true && promo.optJSONObject("active")?.opt("booleanValue") == true
        val chosenEnd = ends.zip(endTimes).firstOrNull { it.second == end && end != null }?.first.orEmpty()
        return PlacePromotion(promo.text("title").ifBlank { promo.text("titleEn") }.take(250), promo.text("description").ifBlank { promo.text("descriptionEn") }.take(4000), DiscoveryPolicy.media(promo.text("image")), promo.text("buttonText").ifBlank { promo.text("buttonTextEn") }.take(100), PlacePolicy.safeImage(promo.text("buttonUrl")), enabled, start, end, valid, Regex("\\d{4}-\\d{2}-\\d{2}").matches(chosenEnd))
    }
    fun visible(place: Place, now: Long, fresh: Boolean): Boolean = fresh && PlacePolicy.published(place) && place.promotion.let { it.enabled && it.valid && (it.start == null || now >= it.start) && (it.end == null || now <= it.end) }
    fun filter(places: List<Place>, query: String, now: Long, fresh: Boolean) = places.filter { p -> visible(p, now, fresh) && PlacePolicy.normalize(query).split(' ').filter(String::isNotBlank).all { it in PlacePolicy.normalize("${p.title} ${p.promotion.title} ${p.promotion.description} ${p.address} ${p.categoryLabel}") } }
    fun validity(promo: PlacePromotion): String = promo.end?.let { end ->
        val pattern = if (promo.dateOnlyEnd) "d MMM yyyy" else "d MMM yyyy, HH:mm"
        "Hasta ${DateTimeFormatter.ofPattern(pattern, Locale.forLanguageTag("es-EC")).withZone(zone).format(Instant.ofEpochMilli(end))}${if (promo.dateOnlyEnd) "" else " (Ecuador)"}"
    } ?: "Consulta la vigencia con el negocio"
}
