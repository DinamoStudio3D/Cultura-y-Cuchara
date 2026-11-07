package com.visitaloja.app

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.time.Instant

class FestivalPolicyTest {
    @Test fun packagedProgramMatchesPublicScheduleShape() {
        val source = File("src/main/assets/fiavl-2026.json")
        val rows = JSONObject(source.readText()).getJSONArray("events")
        val events = (0 until rows.length()).map { index ->
            val row = rows.getJSONObject(index)
            requireNotNull(FestivalPolicy.parse(row.keys().asSequence().associateWith(row::opt)))
        }
        val program = FestivalPolicy.merge(emptyList(), events)
        assertEquals(394, events.size)
        assertEquals(394, program.size)
        assertEquals(11, program.map { it.day }.distinct().size)
        val parade = program.single { it.id == "fiavl2026-21d664ab2cee" }
        assertTrue(parade.route)
        assertTrue(parade.routePoints.size > 2)
        val features = JSONObject(FestivalPolicy.venueGeoJson(emptyList(), parade.routePoints)).getJSONArray("features")
        assertEquals("LineString", features.getJSONObject(0).getJSONObject("geometry").getString("type"))
        assertEquals(3, features.length())
        val first = features.getJSONObject(0).getJSONObject("geometry").getJSONArray("coordinates").getJSONArray(0)
        assertEquals(parade.routePoints.first().longitude, first.getDouble(0), 0.0)
        assertEquals(parade.routePoints.first().latitude, first.getDouble(1), 0.0)
        assertEquals("2026-11-12", FestivalPolicy.defaultDay(program.map { it.day }.distinct(),
            Instant.parse("2026-11-07T02:00:00Z").toEpochMilli()).toString())
    }

    @Test fun openingAgendaBeforeTheFirstSnapshotHasNoDayYet() {
        val days = sortedMapOf<java.time.LocalDate, List<FestivalEvent>>()
        assertTrue(FestivalPolicy.forDay(days, FestivalPolicy.defaultDay(emptyList(), 0)).isEmpty())
    }

    @Test fun mapGroupsActivitiesAndExcludesFinishedAndUnlocatedOnes() {
        val row = mapOf("id" to "one", "title" to "Teatro", "date" to "2026-11-12",
            "time" to "18:00", "lat" to -3.99, "lng" to "-79.20")
        val first = requireNotNull(FestivalPolicy.parse(row))
        val other = first.copy(id = "two")
        val expired = first.copy(id = "old", day = first.day.minusDays(1))
        val unlocated = first.copy(id = "unknown", longitude = null)
        val venues = FestivalPolicy.venues(listOf(first, other, expired, unlocated), first.start)
        assertEquals(listOf("one", "two"), venues.single().events.map { it.id })
        val feature = JSONObject(FestivalPolicy.venueGeoJson(venues)).getJSONArray("features").getJSONObject(0)
        assertEquals(-79.2, feature.getJSONObject("geometry").getJSONArray("coordinates").getDouble(0), 0.00001)
    }

    @Test fun publishedEventWinsAndStatusUsesLojaTime() {
        val row = mapOf("id" to "imported", "title" to "Música", "place" to "Plaza", "date" to "2026-11-12",
            "time" to "19:00", "durationMinutes" to 90, "mapUrl" to "https://evil.example/maps")
        val imported = requireNotNull(FestivalPolicy.parse(row))
        val published = imported.copy(id = "published", title = "Musica", free = true)
        assertEquals(listOf(published), FestivalPolicy.merge(listOf(published), listOf(imported)))
        assertNull(imported.mapUrl)
        assertNull(imported.status(imported.start - 1))
        assertEquals("En curso", imported.status(Instant.parse("2026-11-13T00:00:00Z").toEpochMilli()))
        assertEquals("Finalizada", imported.status(imported.start + 90 * 60_000))
        assertEquals("Ya inició", imported.copy(durationMinutes = null).status(imported.start))
    }

    @Test fun festivalLinksDoNotReplaceTheGeneralAgenda() {
        assertEquals("festival", NativeLinkPolicy.parse(FestivalPolicy.PROGRAM)?.route)
        assertEquals("festival", PushPolicy.route("/programacion-fiavl-2026"))
        assertEquals("agenda", NativeLinkPolicy.parse("https://www.visitaloja.com/#agenda")?.route)
    }
}
