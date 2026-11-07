package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class EventActionPolicyTest {
    @Test fun calendarOnlyUsesKnownValidDuration() {
        assertNull(EventActionPolicy.end(1000, null))
        assertNull(EventActionPolicy.end(1000, 0))
        assertNull(EventActionPolicy.end(1000, 1441))
        assertEquals(1201000L, EventActionPolicy.end(1000, 20))
    }
    @Test fun sharesLojaTimeAndOmitsEmptyLocation() {
        val text = EventActionPolicy.share("Teatro", Instant.parse("2026-11-13T01:00:00Z").toEpochMilli(), "", "https://www.visitaloja.com/")
        assertTrue(text.contains("20:00"))
        assertTrue(text.contains("12"))
        assertTrue(text.contains("Hora de Loja, Ecuador"))
        assertFalse(text.contains("\n\n"))
    }
}
