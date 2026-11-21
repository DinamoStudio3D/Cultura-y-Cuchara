package com.visitaloja.app
import org.junit.Assert.*
import org.junit.Test

class AdminEventPolicyTest {
    private fun fields() = mapOf("title" to "Evento Loja", "date" to "2026-11-20", "time" to "18:00",
        "location" to "Centro", "desc" to "Actividad cultural", "lat" to "-3.99", "lng" to "-79.20")
    @Test fun draftEventUsesSharedWebFields() {
        val event = AdminEventPolicy.patch(fields(), "draft")
        assertEquals("draft", event["publicationStatus"])
        assertEquals("2026-11-20", event["date"])
        assertEquals(-3.99, event["lat"])
        assertFalse(event.containsKey("id"))
    }
    @Test(expected = IllegalArgumentException::class) fun latitudeOutsideEarthIsRejected() {
        AdminEventPolicy.patch(fields() + ("lat" to "100"), "published")
    }
    @Test(expected = java.time.format.DateTimeParseException::class) fun impossibleDateIsRejected() {
        AdminEventPolicy.patch(fields() + ("date" to "2026-02-30"), "published")
    }
    @Test(expected = IllegalArgumentException::class) fun unsafeImageLinkIsRejected() {
        AdminEventPolicy.patch(fields() + ("img" to "http://example.com/image.jpg"), "published")
    }
}
