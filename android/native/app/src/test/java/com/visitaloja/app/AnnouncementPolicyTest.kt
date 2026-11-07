package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class AnnouncementPolicyTest {
    private val item = mapOf<String, Any?>("id" to "first", "popupActive" to true, "popupTitle" to "Evento", "popupStartsAt" to "2026-10-30T09:00:00-05:00", "popupEndsAt" to "2026-10-30T10:00:00-05:00")
    private fun queue(vararg items: Map<String, Any?>) = AnnouncementPolicy.read(mapOf("active" to true, "items" to items.toList()))
    @Test fun ecuadorStartInclusiveAndEndExclusive() {
        val items = queue(item)
        val start = Instant.parse("2026-10-30T14:00:00Z").toEpochMilli()
        assertNull(AnnouncementPolicy.current(items, start - 1))
        assertEquals("first", AnnouncementPolicy.current(items, start)?.id)
        assertNull(AnnouncementPolicy.current(items, start + 3600000))
    }
    @Test fun disabledQueueNeverResurrectsLegacyOrItems() {
        assertTrue(AnnouncementPolicy.read(mapOf("active" to false, "items" to listOf(item), "popupActive" to true)).isEmpty())
        assertTrue(AnnouncementPolicy.read(mapOf("active" to true, "items" to emptyList<Any>())).isEmpty())
        assertTrue(queue(item + ("popupActive" to false)).isEmpty())
    }
    @Test fun malformedAndReversedDatesFailClosed() {
        for (value in listOf("tomorrow", "2026-10-30T09:00", "2026-02-30T09:00:00Z", 12L)) assertTrue(queue(item + ("popupStartsAt" to value)).isEmpty())
        assertTrue(queue(item + ("popupEndsAt" to item["popupStartsAt"])).isEmpty())
    }
    @Test fun selectsOnlyFirstActiveAndMovesToNextAtBoundary() {
        val second = item + mapOf("id" to "second", "popupStartsAt" to item["popupEndsAt"], "popupEndsAt" to null)
        val items = queue(item, second)
        assertEquals("first", AnnouncementPolicy.current(items, Instant.parse("2026-10-30T14:30:00Z").toEpochMilli())?.id)
        assertEquals("second", AnnouncementPolicy.current(items, Instant.parse("2026-10-30T15:00:00Z").toEpochMilli())?.id)
        assertEquals("first", AnnouncementPolicy.current(queue(item, item + ("id" to "overlap")), Instant.parse("2026-10-30T14:30:00Z").toEpochMilli())?.id)
    }
    @Test fun openEndedLegacyUsesSameExplicitActivation() {
        val legacy = AnnouncementPolicy.read(mapOf("popupActive" to true, "popupTitle" to "Bienvenidos"), true)
        assertEquals("legacy-announcement", AnnouncementPolicy.current(legacy, 0)?.id)
        assertTrue(AnnouncementPolicy.read(mapOf("popupActive" to "true"), true).isEmpty())
    }
    @Test fun mediaAndContactRequireSafeHttpsAndBoundText() {
        val row = queue(item + mapOf("popupImg" to "assets/a b.webp", "popupWhatsapp" to "javascript:alert(1)", "popupDesc" to "x".repeat(900))).single()
        assertEquals("https://www.visitaloja.com/assets/a%20b.webp", row.image)
        assertNull(row.contact); assertEquals(500, row.description.length)
        for (bad in listOf("http://example.com/a", "https://user@example.com/a", "//example.com/a", "https://example.com\\x", "https://example.com:444/a")) assertNull(queue(item + ("popupImg" to bad)).single().image)
    }
}
