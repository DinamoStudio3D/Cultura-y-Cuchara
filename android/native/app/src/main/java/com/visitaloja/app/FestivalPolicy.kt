package com.visitaloja.app

import java.time.LocalDate
import java.time.LocalTime
import java.time.Instant
import java.net.URI

data class FestivalEvent(
    val id: String, val title: String, val day: LocalDate, val time: LocalTime,
    val category: String, val place: String, val description: String, val free: Boolean,
    val durationMinutes: Long?, val mapUrl: String?, val route: Boolean, val precision: String
) {
    val start: Long get() = day.atTime(time).atZone(AgendaPolicy.zone).toInstant().toEpochMilli()
    fun status(now: Long): String? {
        val end = durationMinutes?.let { start + it * 60_000 }
            ?: day.plusDays(1).atStartOfDay(AgendaPolicy.zone).toInstant().toEpochMilli()
        return when {
            now < start -> null
            now >= end -> "Finalizada"
            durationMinutes != null -> "En curso"
            else -> "Ya inició"
        }
    }
}

object FestivalPolicy {
    const val PROGRAM = "https://www.visitaloja.com/programacion-fiavl-2026"
    const val FEED = "https://www.visitaloja.com/data/fiavl-2026-import-preview.json"
    const val PARADE = "https://www.visitaloja.com/?fiavlRuta=desfile#mapa"

    fun parse(row: Map<String, Any?>): FestivalEvent? {
        fun value(key: String) = (row[key] as? String).orEmpty().trim()
        if (row["active"] == false || row["hidden"] == true || row["published"] == false) return null
        val id = value("id").ifBlank { return null }
        val title = value("title").ifBlank { return null }
        val day = runCatching { LocalDate.parse(value("date")) }.getOrNull() ?: return null
        val timeText = value("time").ifBlank { "00:00" }
        val time = runCatching { LocalTime.parse(timeText.padStart(5, '0')) }.getOrNull() ?: return null
        val map = value("mapUrl").takeIf { link ->
            val uri = runCatching { URI(link) }.getOrNull()
            uri?.scheme == "https" && uri.userInfo == null &&
                uri.host in setOf("www.google.com", "maps.google.com", "maps.app.goo.gl", "goo.gl")
        }
        return FestivalEvent(id, title, day, time, value("category").ifBlank { "Arte" },
            value("place").ifBlank { value("location") }, value("description").ifBlank { value("desc") },
            row["free"] == true, row["durationMinutes"]?.toString()?.toDoubleOrNull()?.takeIf { it in 1.0..1440.0 }?.toLong(),
            map, row["route"] is Map<*, *> || row["route"] == true, value("locationPrecision"))
    }

    fun merge(published: List<FestivalEvent>, imported: List<FestivalEvent>): List<FestivalEvent> {
        val ids = mutableSetOf<String>()
        val keys = mutableSetOf<List<String>>()
        return (published + imported).filter { event ->
            val key = listOf(event.day.toString(), event.time.toString(), PlacePolicy.normalize(event.title), PlacePolicy.normalize(event.place))
            if (event.id in ids || key in keys) false else { ids.add(event.id); keys.add(key); true }
        }.sortedBy { it.start }
    }

    fun defaultDay(days: List<LocalDate>, now: Long): LocalDate? {
        val today = Instant.ofEpochMilli(now).atZone(AgendaPolicy.zone).toLocalDate()
        return days.firstOrNull { it >= today } ?: days.lastOrNull()
    }
}
