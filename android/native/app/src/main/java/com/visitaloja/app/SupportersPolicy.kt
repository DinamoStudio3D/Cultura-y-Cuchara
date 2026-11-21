package com.visitaloja.app

import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.util.Locale

/** Public membership projection only; no billing/contact/admin fields. Not persisted in the directory cache. */
data class SupportPlan(val paid: Boolean = false, val start: Long? = null, val end: Long? = null, val valid: Boolean = true, val logo: String? = null)
internal data class SupportConfig(val active: Boolean = true, val includeMesa: Boolean = true, val title: String = SupportersPolicy.title, val subtitle: String = SupportersPolicy.subtitle, val selected: Boolean = false, val selectedIds: List<String> = emptyList(), val excludedIds: List<String> = emptyList(), val orderIds: List<String> = emptyList(), val size: String = "medium", val duration: Int = 35, val right: Boolean = false, val motion: Boolean = true, val pauseOnHover: Boolean = true, val showNames: Boolean = false, val clickable: Boolean = true)
internal data class Supporter(val id: String, val name: String, val logo: String?, val institution: Boolean = false)
internal object SupportersPolicy {
    const val title = "Ellos hacen posible VisitaLoja"
    const val subtitle = "Conoce los negocios que apoyan este proyecto y nos ayudan a mostrar lo mejor de Loja."
    const val mesaId = "institution-mesa-turistica"
    private fun JSONObject.text(key: String) = optJSONObject(key)?.optString("stringValue").orEmpty()
    private fun date(raw: String, end: Boolean): Long? = runCatching { Instant.parse(raw).toEpochMilli() }.getOrNull()
        ?: runCatching { LocalDate.parse(raw).atStartOfDay(ZoneId.of("America/Guayaquil")).let { if (end) it.plusDays(1).minusNanos(1) else it }.toInstant().toEpochMilli() }.getOrNull()
    fun read(fields: JSONObject): SupportPlan {
        val sub = fields.optJSONObject("subscription")?.optJSONObject("mapValue")?.optJSONObject("fields") ?: JSONObject()
        fun raw(vararg keys: String): String = keys.firstNotNullOfOrNull { key ->
            sub.optJSONObject(key)?.let { value -> when {
                value.has("nullValue") -> null
                value.has("timestampValue") -> value.optString("timestampValue").takeIf(String::isNotEmpty)
                value.has("stringValue") -> value.optString("stringValue").takeIf(String::isNotEmpty)
                else -> "invalid-date-type"
            } }
        }.orEmpty()
        val startRaw = raw("startAt", "startDate");val endRaw = raw("endAt", "endDate")
        val start = date(startRaw, false);val end = date(endRaw, true)
        val plan = sub.text("plan").trim().lowercase(Locale.ROOT)
        val status = sub.text("status").ifEmpty { "active" }.trim().lowercase(Locale.ROOT)
        return SupportPlan(fields.optJSONObject("hidden")?.opt("booleanValue") != true && fields.optJSONObject("published")?.opt("booleanValue") != false && plan.isNotEmpty() && plan !in setOf("free", "gratis", "gratuito") && status in setOf("active", "paid"), start, end,
            (startRaw.isEmpty() || start != null) && (endRaw.isEmpty() || end != null) && (start == null || end == null || start <= end), DiscoveryPolicy.media(fields.text("customLogoUrl").trim().replace(" ", "%20")))
    }
    fun config(data: Map<String, Any?>): SupportConfig {
        fun ids(key: String) = (data[key] as? List<*>)?.filterIsInstance<String>()?.filter { it.length <= 180 }?.distinct()?.take(1000).orEmpty()
        fun copy(key: String, fallback: String, limit: Int) = (data[key] as? String)?.trim()?.take(limit) ?: fallback
        val englishTitle = copy("titleEn", "They make VisitaLoja possible", 120).let { if (it == "Brands already working with us") "They make VisitaLoja possible" else it }
        val heading = copy("title", title, 120).let { if (it == "Marcas que ya trabajan con nosotros") title else it }.ifBlank { englishTitle.ifBlank { title } }
        val intro = copy("subtitle", subtitle, 300).ifBlank { copy("subtitleEn", "Meet the businesses that support this project and help us showcase the best of Loja.", 300) }
        return SupportConfig(data["active"] != false, data["includeMesa"] != false, heading, intro, data["mode"] == "selected", ids("selectedIds"), ids("excludedIds"), ids("orderIds"), (data["size"] as? String)?.takeIf { it in setOf("small", "medium", "large") } ?: "medium", ((data["duration"] as? Number)?.toDouble()?.takeIf { it.isFinite() && it != 0.0 } ?: 35.0).coerceIn(20.0,120.0).toInt(), data["direction"] == "right", data["motion"] != false, data["pauseOnHover"] != false, data["showNames"] == true, data["clickable"] != false)
    }
    fun eligible(place: Place, now: Long): Boolean = PlacePolicy.published(place) && place.support.let { it.paid && it.valid && (it.start == null || now >= it.start) && (it.end == null || now <= it.end) }
    fun entries(places: List<Place>, config: SupportConfig, now: Long, fresh: Boolean): List<Supporter> {
        if (!fresh || !config.active) return emptyList()
        val rank = config.orderIds.withIndex().associate { it.value to it.index }
        val selected = config.selectedIds.toSet();val excluded = config.excludedIds.toSet()
        val list = places.filter { eligible(it, now) && it.id != mesaId && if (config.selected) it.id in selected else it.id !in excluded }.distinctBy { it.id }
            .withIndex().sortedBy { rank[it.value.id] ?: (100_000 + it.index) }.map { Supporter(it.value.id, it.value.title, it.value.support.logo) }
        return if (config.includeMesa) list + Supporter(mesaId, "Mesa Turística de Loja", "https://www.visitaloja.com/logo%20mesa%20turistica.webp", true) else list
    }
}
