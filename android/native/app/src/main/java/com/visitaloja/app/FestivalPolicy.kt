package com.visitaloja.app

import java.time.LocalDate
import java.time.LocalTime
import java.time.Instant
import java.net.URI
import org.json.JSONObject

data class FestivalEvent(
    val id: String, val title: String, val day: LocalDate, val time: LocalTime,
    val category: String, val place: String, val description: String, val free: Boolean,
    val durationMinutes: Long?, val mapUrl: String?, val route: Boolean, val precision: String,
    val latitude: Double?, val longitude: Double?, val routePoints: List<FestivalPoint> = emptyList()
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

data class FestivalPoint(val latitude: Double, val longitude: Double)

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
            map, row["route"] is Map<*, *> || row["route"] is JSONObject || row["route"] == true, value("locationPrecision"),
            coordinate(row["lat"], 90.0), coordinate(row["lng"], 180.0), routePoints(row["route"]))
    }

    private fun routePoints(raw: Any?): List<FestivalPoint> {
        fun values(value: Any?): List<*> = when (value) {
            is org.json.JSONArray -> (0 until minOf(value.length(), 2000)).map { value.opt(it) }
            is List<*> -> value.take(2000)
            else -> emptyList<Any>()
        }
        val rawPoints = when (raw) {
            is JSONObject -> raw.opt("points")
            is Map<*, *> -> raw["points"]
            else -> null
        }
        return values(rawPoints).map { point ->
            val pair = values(point)
            val lat = coordinate(pair.getOrNull(0), 90.0) ?: return emptyList()
            val lng = coordinate(pair.getOrNull(1), 180.0) ?: return emptyList()
            FestivalPoint(lat, lng)
        }.takeIf { it.size >= 2 }.orEmpty()
    }

    private fun coordinate(raw: Any?, limit: Double): Double? =
        raw?.toString()?.toDoubleOrNull()?.takeIf { it in -limit..limit }

    fun forDay(grouped: Map<LocalDate, List<FestivalEvent>>, day: LocalDate?): List<FestivalEvent> =
        day?.let { grouped[it] }.orEmpty()

    data class Venue(val id: String, val latitude: Double, val longitude: Double, val events: List<FestivalEvent>)

    fun venues(events: List<FestivalEvent>, now: Long): List<Venue> = events
        .filter { !it.route && it.latitude != null && it.longitude != null &&
            (it.latitude != 0.0 || it.longitude != 0.0) && it.status(now) != "Finalizada" }
        .groupBy { it.latitude!! to it.longitude!! }
        .map { (point, rows) -> Venue("${point.first}|${point.second}", point.first, point.second, rows) }

    fun venueGeoJson(venues: List<Venue>, route: List<FestivalPoint> = emptyList()): String {
        fun coordinate(point: FestivalPoint) = org.json.JSONArray(listOf(point.longitude, point.latitude))
        fun feature(kind: String, id: String, type: String, points: org.json.JSONArray) =
            JSONObject().put("type", "Feature").put("properties", JSONObject().put("id", id).put("kind", kind))
                .put("geometry", JSONObject().put("type", type).put("coordinates", points))
        val features = org.json.JSONArray()
        venues.forEach { features.put(feature("venue", it.id, "Point", coordinate(FestivalPoint(it.latitude, it.longitude)))) }
        if (route.size >= 2) {
            features.put(feature("parade", "parade", "LineString", org.json.JSONArray(route.map(::coordinate))))
            features.put(feature("start", "start", "Point", coordinate(route.first())))
            features.put(feature("finish", "finish", "Point", coordinate(route.last())))
        }
        return JSONObject().put("type", "FeatureCollection").put("features", features).toString()
    }

    fun merge(published: List<FestivalEvent>, imported: List<FestivalEvent>): List<FestivalEvent> {
        val ids = mutableSetOf<String>()
        val keys = mutableSetOf<List<String>>()
        val importedById = imported.associateBy(FestivalEvent::id)
        return (published + imported).filter { event ->
            val key = listOf(event.day.toString(), event.time.toString(), PlacePolicy.normalize(event.title), PlacePolicy.normalize(event.place))
            if (event.id in ids || key in keys) false else { ids.add(event.id); keys.add(key); true }
        }.map { event ->
            val reference = importedById[event.id]
            if (event.routePoints.isEmpty() && reference != null && reference.routePoints.isNotEmpty())
                event.copy(route = true, routePoints = reference.routePoints)
            else event
        }.sortedBy { it.start }
    }

    fun defaultDay(days: List<LocalDate>, now: Long): LocalDate? {
        val today = Instant.ofEpochMilli(now).atZone(AgendaPolicy.zone).toLocalDate()
        return days.firstOrNull { it >= today } ?: days.lastOrNull()
    }
}
