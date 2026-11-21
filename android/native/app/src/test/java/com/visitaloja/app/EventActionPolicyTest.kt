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
    @Test fun englishShareKeepsLojaDayAndOriginalNamesRegardlessOfDeviceDefaults() {
        val previousZone = java.util.TimeZone.getDefault()
        val previousLocale = java.util.Locale.getDefault()
        try {
            java.util.TimeZone.setDefault(java.util.TimeZone.getTimeZone("Pacific/Kiritimati"))
            java.util.Locale.setDefault(java.util.Locale.FRANCE)
            val start = Instant.parse("2026-11-13T01:00:00Z").toEpochMilli()
            val text = EventActionPolicy.share("Noche de música", start, "Teatro Bolívar", "https://www.visitaloja.com/#agenda", true)
            assertTrue(text.startsWith("Noche de música\n"))
            assertTrue(text.contains("Thu 12 Nov 2026 · 20:00"))
            assertTrue(text.contains("Loja, Ecuador time"))
            assertTrue(text.contains("Teatro Bolívar"))
            assertTrue(EventActionPolicy.share("Noche de música", start, "", "https://www.visitaloja.com/").contains("Hora de Loja, Ecuador"))
        } finally {
            java.util.TimeZone.setDefault(previousZone)
            java.util.Locale.setDefault(previousLocale)
        }
    }
}
