package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class MesaPolicyTest {
    @Test fun readsAllAdminSectionsWithoutInventingContacts() {
        val raw = MesaPolicy.groups.keys.associateWith { key -> listOf(mapOf((if (key in setOf("board", "institutions")) "name" else "title") to key, "description" to "Texto completo", "role" to "Presidencia", "institution" to "Loja")) }
        val result = MesaPolicy.read(raw)
        assertEquals(7, result.groups.size)
        assertTrue(result.groups.values.all { it.size == 1 })
        assertEquals("Presidencia · Loja", result.groups.getValue("board").single().detail)
        assertNull(result.email);assertNull(result.phone)
    }
    @Test fun removesHiddenAndMalformedRowsButKeepsFinishedActivities() {
        val result = MesaPolicy.read(mapOf("agenda" to listOf(null, "bad", mapOf("title" to "Oculta", "hidden" to true), mapOf("title" to "Borrador", "status" to "draft"), mapOf("title" to "Hecha", "status" to "finished"), mapOf("description" to "Sin título"))))
        assertEquals(listOf("Hecha"), result.groups.getValue("agenda").map { it.title })
        assertFalse(MesaPolicy.read(mapOf("active" to false)).active)
    }
    @Test fun validatesMediaAndContactsAndKeepsTextAsText() {
        val result = MesaPolicy.read(mapOf("intro" to "<script>Texto</script>", "email" to "mesa@example.com", "phone" to "+593 (7) 123-4567", "facebook" to "javascript:alert(1)", "instagram" to "https://instagram.com/mesa", "gallery" to listOf("logo mesa turistica.webp", "//evil.example/img.png", "file:///secret", "https://cdn.example/a.png", "https://cdn.example/a.png")))
        assertEquals("mesa@example.com", result.email);assertNotNull(result.phone)
        assertNull(result.facebook);assertEquals("https://instagram.com/mesa", result.instagram)
        assertEquals(2, result.gallery.size);assertTrue(result.gallery.first().contains("%20"))
        assertEquals("<script>Texto</script>", result.intro)
        assertNull(MesaPolicy.read(mapOf("email" to "a@b.com\r\nBcc: evil@example.com", "phone" to "tel:javascript")).email)
    }
    @Test fun nextActivityUsesEcuadorDateAndExcludesFinishedCancelledAndUnknownDates() {
        val raw = MesaPolicy.read(mapOf("agenda" to listOf(mapOf("title" to "Hoy en Loja", "date" to "2026-10-29", "time" to "19:00"), mapOf("title" to "Mañana", "date" to "2026-10-30"), mapOf("title" to "Terminó", "date" to "2026-10-29", "status" to "finished"), mapOf("title" to "Canceló", "date" to "2026-10-29", "status" to "cancelled"), mapOf("title" to "Sin fecha", "date" to "2026-02-31"))))
        val rows = raw.groups.getValue("agenda")
        assertEquals("Hoy en Loja", MesaPolicy.next(rows, Instant.parse("2026-10-30T03:00:00Z").toEpochMilli())?.title)
        assertEquals("Mañana", MesaPolicy.next(rows, Instant.parse("2026-10-30T05:00:00Z").toEpochMilli())?.title)
        assertNull(MesaPolicy.next(rows, Instant.parse("2026-10-31T05:00:00Z").toEpochMilli()))
    }
    @Test fun boundsPublicProjectionAndIgnoresAdminMetadata() {
        val raw = MesaPolicy.read(mapOf("title" to "T".repeat(1000), "board" to (1..300).map { mapOf("name" to "Persona $it") }, "gallery" to (1..100).map { "https://cdn.example/$it.png" }, "updatedBy" to "private@example.com"))
        assertEquals(200, raw.title.length);assertEquals(200, raw.groups.getValue("board").size);assertEquals(50, raw.gallery.size)
        assertFalse(raw.toString().contains("private@example.com"))
    }
    @Test fun canonicalInstitutionLinkOpensNativeRouteOnly() {
        assertEquals("mesa", NativeLinkPolicy.parse("https://www.visitaloja.com/mesa-turistica.html")?.route)
        assertEquals("mesa", PushPolicy.route("/mesa-turistica.html"))
        assertNull(NativeLinkPolicy.parse("https://evil.example/mesa-turistica.html"))
        assertNull(NativeLinkPolicy.parse("https://visitaloja.com/mesa-turistica.html?qr=secret"))
    }
}
