package com.visitaloja.app

import java.net.URI
import java.time.OffsetDateTime

internal data class EntryAnnouncement(val id: String, val title: String, val description: String, val image: String?, val contact: String?, val start: Long?, val end: Long?)
internal object AnnouncementPolicy {
    private fun url(value: Any?): String? {
        val raw = (value as? String)?.trim()?.takeIf { it.isNotEmpty() && it.length <= 2000 && it.none { c -> c.isISOControl() || c == '\\' } } ?: return null
        val resolved = when { raw.startsWith("/") && !raw.startsWith("//") -> "https://www.visitaloja.com$raw"; raw.startsWith("assets/") -> "https://www.visitaloja.com/$raw"; else -> raw }
        return runCatching { URI(resolved.replace(" ", "%20")).takeIf { it.scheme.equals("https", true) && !it.host.isNullOrBlank() && it.rawUserInfo == null && it.port == -1 }?.toASCIIString() }.getOrNull()
    }
    private fun date(raw: Any?): Long? {
        if (raw == null || raw == "") return null
        require(raw is String && Regex("^\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d(?::\\d\\d(?:\\.\\d{1,3})?)?(?:Z|[+-]\\d\\d:\\d\\d)$").matches(raw))
        return OffsetDateTime.parse(raw).toInstant().toEpochMilli()
    }
    fun read(raw: Map<String, Any?>, legacy: Boolean = false): List<EntryAnnouncement> {
        val items = if (legacy) listOf(raw + ("id" to "legacy-announcement")) else {
            if (raw["active"] != true) return emptyList()
            (raw["items"] as? List<*>)?.take(200)?.mapNotNull { value -> (value as? Map<*, *>)?.entries?.filter { it.key is String }?.associate { it.key as String to it.value } } ?: emptyList()
        }
        return items.mapNotNull { item -> runCatching {
            if (item["popupActive"] != true) return@mapNotNull null
            val title = (item["popupTitle"] as? String).orEmpty().take(120).trim()
            val start = date(item["popupStartsAt"]); val end = date(item["popupEndsAt"])
            require(end == null || start == null || end > start)
            EntryAnnouncement((item["id"] as? String).orEmpty(), title.ifBlank { "¡Promoción Especial!" }, (item["popupDesc"] as? String).orEmpty().take(500), url(item["popupImg"]), url(item["popupWhatsapp"]), start, end)
        }.getOrNull() }
    }
    // Same first-active selection and exclusive end boundary as popup-schedule.js.
    fun current(items: List<EntryAnnouncement>, now: Long) = items.firstOrNull { (it.start == null || now >= it.start) && (it.end == null || now < it.end) }
}
