package com.visitaloja.app

import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

data class PlaceMedia(val video: String? = null, val paidVideo: Boolean = false, val start: Long? = null, val end: Long? = null, val validWindow: Boolean = true, val audioEs: String? = null, val audioEn: String? = null)
internal object PlaceMediaPolicy {
    private fun JSONObject.text(key: String) = optJSONObject(key)?.optString("stringValue").orEmpty()
    private fun date(value: String, end: Boolean): Long? = runCatching { Instant.parse(value).toEpochMilli() }.getOrNull()
        ?: runCatching { LocalDate.parse(value).atStartOfDay(ZoneId.of("America/Guayaquil")).let { if (end) it.plusDays(1).minusNanos(1) else it }.toInstant().toEpochMilli() }.getOrNull()
    fun audio(value: String): String? = DiscoveryPolicy.media(value.trim().replace(" ", "%20"))
    fun read(fields: JSONObject): PlaceMedia {
        val s = fields.optJSONObject("subscription")?.optJSONObject("mapValue")?.optJSONObject("fields") ?: JSONObject()
        fun raw(vararg keys: String) = keys.firstNotNullOfOrNull { key -> s.optJSONObject(key)?.let { it.optString("timestampValue").ifBlank { it.optString("stringValue") } }?.takeIf(String::isNotBlank) }.orEmpty()
        val startRaw = raw("startAt", "startDate");val endRaw = raw("endAt", "endDate")
        val start = date(startRaw, false);val end = date(endRaw, true)
        val benefit = s.optJSONObject("benefits")?.optJSONObject("mapValue")?.optJSONObject("fields")?.optJSONObject("video")?.opt("booleanValue") == true
        val paid = s.text("plan").isNotBlank() && s.text("plan") != "free" && s.text("status") !in setOf("paused", "pending", "expired", "suspended") && benefit
        return PlaceMedia(VideoPolicy.source(fields.text("youtubeUrl"))?.url, paid, start, end,
            (startRaw.isBlank() || start != null) && (endRaw.isBlank() || end != null) && (start == null || end == null || start <= end),
            audio(fields.text("audioUrl")), audio(fields.text("audioUrlEn")))
    }
    fun video(place: Place, now: Long): VideoSource? {
        val m = place.media
        if (!PlacePolicy.published(place) || !m.paidVideo || !m.validWindow || (m.start != null && now < m.start) || (m.end != null && now > m.end)) return null
        return m.video?.let(VideoPolicy::source)
    }
    fun cache(media: PlaceMedia) = JSONObject().put("video", media.video ?: JSONObject.NULL).put("paidVideo", media.paidVideo).put("start", media.start ?: JSONObject.NULL).put("end", media.end ?: JSONObject.NULL).put("validWindow", media.validWindow)
        .put("audioEs", media.audioEs ?: JSONObject.NULL).put("audioEn", media.audioEn ?: JSONObject.NULL)
    fun cached(raw: JSONObject?): PlaceMedia {
        if (raw == null) return PlaceMedia()
        fun number(key: String) = raw.optLong(key).takeIf { raw.has(key) && !raw.isNull(key) }
        return PlaceMedia(VideoPolicy.source(raw.optString("video"))?.url, raw.optBoolean("paidVideo"), number("start"), number("end"), raw.optBoolean("validWindow", false),
            if (raw.isNull("audioEs")) null else audio(raw.optString("audioEs")), if (raw.isNull("audioEn")) null else audio(raw.optString("audioEn")))
    }
    fun audioKey(place: Place, english: Boolean) = "place:${place.id}:${if (english) "en" else "es"}"
    fun activeAudio(places: List<Place>, key: String): String? = places.firstNotNullOfOrNull { p ->
        if (!PlacePolicy.published(p)) null else when (key) { audioKey(p, false) -> p.media.audioEs; audioKey(p, true) -> p.media.audioEn; else -> null }
    }
}
