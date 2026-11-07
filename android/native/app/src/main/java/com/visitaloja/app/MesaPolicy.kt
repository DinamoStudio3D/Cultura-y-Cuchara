package com.visitaloja.app

import java.time.LocalDate
import java.time.ZoneId
import java.util.Locale

internal data class MesaEntry(val title: String, val description: String = "", val detail: String = "", val date: LocalDate? = null, val time: String = "", val place: String = "", val status: String = "", val image: String? = null, val url: String? = null)
internal data class MesaContent(val active: Boolean = true, val title: String = "Mesa Turística de Loja", val intro: String = "Un espacio de articulación que reúne esfuerzos en favor del turismo lojano.", val objectives: String = "", val groups: Map<String, List<MesaEntry>> = emptyMap(), val gallery: List<String> = emptyList(), val email: String? = null, val phone: String? = null, val facebook: String? = null, val instagram: String? = null)
internal object MesaPolicy {
    val groups = linkedMapOf("board" to "Directiva", "institutions" to "Instituciones participantes", "agenda" to "Programación", "projects" to "Proyectos e iniciativas", "calls" to "Convocatorias", "documents" to "Documentos", "news" to "Noticias y novedades")
    private fun Map<*, *>.text(key: String, max: Int = 200) = (this[key] as? String).orEmpty().trim().take(max)
    private fun visible(raw: Map<*, *>) = raw["active"] != false && raw["visible"] != false && raw["hidden"] != true && raw["published"] != false && raw.text("status").lowercase(Locale.ROOT) !in setOf("draft", "hidden", "archived", "deleted", "inactive") && raw.text("publicationStatus").lowercase(Locale.ROOT) in setOf("", "published")
    fun media(value: String) = DiscoveryPolicy.media(value.trim().replace(" ", "%20"))
    fun date(value: String): LocalDate? = runCatching { LocalDate.parse(value) }.getOrNull()
    fun read(raw: Map<String, Any?>): MesaContent {
        if (!visible(raw)) return MesaContent(active = false)
        val rows = groups.keys.associateWith { group ->
            val result = (raw[group] as? List<*>)?.take(200)?.mapNotNull { it as? Map<*, *> }?.filter(::visible)?.mapNotNull { row ->
                val title = row.text(if (group in setOf("board", "institutions")) "name" else "title")
                if (title.isBlank()) return@mapNotNull null
                val detail = when (group) { "board" -> listOf(row.text("role"), row.text("institution")).filter(String::isNotBlank).joinToString(" · "); "institutions", "documents" -> row.text("type"); else -> "" }
                MesaEntry(title, row.text("description", 30000), detail, date(row.text("date")), row.text("time", 30), row.text("place", 500), row.text("status", 100), media(row.text(if (group == "institutions") "logo" else "image", 4096)), media(row.text("url", 4096)))
            }.orEmpty()
            if (group == "agenda") result.sortedWith(compareBy<MesaEntry> { it.date ?: LocalDate.MAX }.thenBy { it.time }) else result
        }
        val email = raw.text("email", 254).takeIf { Regex("[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\\.[A-Za-z0-9-]+)+").matches(it) }
        val phone = raw.text("phone", 40).takeIf { Regex("[+0-9() .-]{5,40}").matches(it) && it.count(Char::isDigit) >= 5 }
        return MesaContent(title = raw.text("title").ifBlank { MesaContent().title }, intro = raw.text("intro", 5000).ifBlank { MesaContent().intro }, objectives = raw.text("objectives", 30000), groups = rows,
            gallery = (raw["gallery"] as? List<*>)?.take(50)?.mapNotNull { (it as? String)?.let(::media) }?.distinct().orEmpty(), email = email, phone = phone, facebook = media(raw.text("facebook", 4096)), instagram = media(raw.text("instagram", 4096)))
    }
    fun next(items: List<MesaEntry>, now: Long): MesaEntry? {
        val today = java.time.Instant.ofEpochMilli(now).atZone(ZoneId.of("America/Guayaquil")).toLocalDate()
        return items.filter { it.date != null && !it.date.isBefore(today) && it.status.lowercase(Locale.ROOT) !in setOf("finished", "finalizada", "finalizado", "cancelled", "canceled", "cancelada", "cancelado") }.minWithOrNull(compareBy<MesaEntry> { it.date }.thenBy { it.time })
    }
    fun status(value: String) = when (value.lowercase(Locale.ROOT)) { "upcoming" -> "Próxima"; "live" -> "En curso"; "finished" -> "Finalizada"; else -> value }
}
