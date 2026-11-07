package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class AgendaPolicyTest {
    private val base = mapOf<String, Any?>("id" to "e", "title" to "Música en Loja", "date" to "2026-10-26", "time" to "19:30", "location" to "Teatro")
    @Test fun readsEcuadorTimeWithoutUsingThePhonesTimeZone() {
        assertEquals(Instant.parse("2026-10-27T00:30:00Z").toEpochMilli(), AgendaPolicy.parse(base, 0)!!.start)
    }
    @Test fun unpublishedAndInvalidEventsNeverAppear() {
        for (patch in listOf(mapOf("active" to false), mapOf("hidden" to true), mapOf("published" to false), mapOf("publicationStatus" to "draft"), mapOf("date" to "2026-02-30"), mapOf("time" to "25:00"), mapOf("title" to ""))) assertNull(AgendaPolicy.parse(base + patch, 0))
    }
    @Test fun usesTheSameDefaultTimeAndOneHourBoundaryAsTheWeb() {
        val event = AgendaPolicy.parse(base - "time", 0)!!
        assertEquals(Instant.parse("2026-10-26T23:00:00Z").toEpochMilli(), event.start)
        assertEquals(1, AgendaPolicy.upcoming(listOf(event), event.start + 3599999).size)
        assertTrue(AgendaPolicy.upcoming(listOf(event), event.start + 3600000).isEmpty())
    }
    @Test fun todayAndSevenDaysUseLocalMidnightAndExcludeTheNextWeek() {
        val now = Instant.parse("2026-10-27T00:00:00Z").toEpochMilli() // Still October 26 in Loja.
        val today = AgendaPolicy.parse(base, 0)!!
        val tomorrow = AgendaPolicy.parse(base + mapOf("id" to "tomorrow", "date" to "2026-10-27"), 1)!!
        val nextWeek = AgendaPolicy.parse(base + mapOf("id" to "week", "date" to "2026-11-02"), 2)!!
        assertEquals(listOf(today), AgendaPolicy.filter(listOf(nextWeek, tomorrow, today), now, "today", ""))
        assertEquals(listOf(today, tomorrow), AgendaPolicy.filter(listOf(nextWeek, tomorrow, today), now, "week", "musica teatro"))
    }
    @Test fun ordersEventsAndRejectsUnsafeImagesAndCoordinates() {
        val event = AgendaPolicy.parse(base + mapOf("img" to "javascript:bad", "lat" to 91, "lng" to 0), 0)!!
        assertNull(event.image); assertNull(event.latitude); assertEquals(0.0, event.longitude!!, 0.0)
        assertEquals(listOf(event), AgendaPolicy.upcoming(listOf(event, event), event.start))
    }
}
