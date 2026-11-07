package com.visitaloja.app

import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.Instant

data class LojaEvent(val id: String, val title: String, val category: String, val description: String,
    val location: String, val start: Long, val image: String?, val latitude: Double?, val longitude: Double?)

object AgendaPolicy {
    val zone: ZoneId = ZoneId.of("America/Guayaquil")
    fun parse(raw: Map<String, Any?>, index: Int): LojaEvent? {
        if (raw["active"] == false || raw["hidden"] == true || raw["published"] == false || raw.text("publicationStatus") !in setOf("", "published") || raw.text("status") in setOf("draft", "hidden", "archived", "deleted")) return null
        val title = raw.text("title").trim().takeIf { it.isNotBlank() } ?: return null
        val dateText = raw.text("date")
        if (!dateText.matches(Regex("\\d{4}-\\d{2}-\\d{2}"))) return null
        val timeText = raw.text("time").takeIf { it.matches(Regex("\\d{2}:\\d{2}")) } ?: "18:00"
        val start = try { LocalDate.parse(dateText).atTime(LocalTime.parse(timeText)).atZone(zone).toInstant().toEpochMilli() } catch (_: Exception) { return null }
        val image = sequenceOf(raw.text("img"), raw.text("bannerImg")).mapNotNull { value ->
            val url = if (value.startsWith("assets/") && !value.contains("..")) "https://www.visitaloja.com/$value" else value
            PlacePolicy.safeImage(url)?.takeUnless { it.substringBefore('?').endsWith(".svg", true) }
        }.firstOrNull()
        return LojaEvent(raw.text("id").ifBlank { "event-$index-${dateText}-${title.hashCode()}" }, title,
            raw.text("type").ifBlank { "En Loja" }, raw.text("desc").replace(Regex("<[^>]*>"), "").trim(), raw.text("location"),
            start, image, PlacePolicy.safeCoordinate((raw["lat"] as? Number)?.toDouble(), true), PlacePolicy.safeCoordinate((raw["lng"] as? Number)?.toDouble(), false))
    }
    fun upcoming(events: List<LojaEvent>, now: Long): List<LojaEvent> = events.filter { it.start + 3600000L > now }.distinctBy { it.id }.sortedBy { it.start }
    fun filter(events: List<LojaEvent>, now: Long, period: String, query: String): List<LojaEvent> {
        val today = Instant.ofEpochMilli(now).atZone(zone).toLocalDate()
        val tokens = PlacePolicy.normalize(query).split(' ').filter(String::isNotEmpty)
        return upcoming(events, now).filter { event ->
            val date = Instant.ofEpochMilli(event.start).atZone(zone).toLocalDate()
            val periodMatches = when (period) { "today" -> date == today; "week" -> date >= today && date < today.plusDays(7); else -> true }
            val haystack = PlacePolicy.normalize("${event.title} ${event.category} ${event.location} ${event.description}")
            periodMatches && tokens.all { it in haystack }
        }
    }
}
