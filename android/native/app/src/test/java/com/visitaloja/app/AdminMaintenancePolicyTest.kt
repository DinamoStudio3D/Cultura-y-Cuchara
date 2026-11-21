package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test

class AdminMaintenancePolicyTest {
    private val fields = listOf(PlatformField("r|active", "Activo", "false", "bool"), PlatformField("r|title", "Título", "Preparando Loja"), PlatformField("r|text", "Mensaje", "Volvemos pronto"), PlatformField("r|buttonUrl", "Enlace", type = "https"))
    private val groups = listOf(PlatformGroup("maintenance", "Mantenimiento", false, fields))
    @Test fun newNoticeIsOffUntilExplicitlyActivatedAndOnlyUpdatesMaintenanceFields() {
        val initial = AdminPlatformPolicy.read(emptyMap(), groups)
        assertEquals("false", initial["r|active"])
        val patch = AdminPlatformPolicy.patch("maintenance", emptyMap(), initial, initial + ("r|active" to "true"), groups)
        assertEquals(true, patch["active"]); assertEquals("Preparando Loja", patch["title"])
        assertEquals(setOf("active", "title", "text", "buttonUrl"), patch.keys)
    }
    @Test fun stoppingNoticeIsPossibleEvenWithAnUnchangedLegacyBadButton() {
        val base = mapOf<String, Any?>("active" to true, "title" to "Loja", "text" to "Pronto", "buttonUrl" to "http://legacy.example", "extra" to "keep")
        val initial = AdminPlatformPolicy.read(base, groups)
        val patch = AdminPlatformPolicy.patch("maintenance", base, initial, initial + ("r|active" to "false"), groups)
        assertEquals(mapOf("active" to false), patch)
        assertThrows(IllegalArgumentException::class.java) { AdminPlatformPolicy.patch("maintenance", base, initial, initial + ("r|title" to "Cambio"), groups) }
    }
    @Test fun activeNoticeNeedsTextAndRejectsExecutableOrRelativeButtons() {
        val initial = AdminPlatformPolicy.read(emptyMap(), groups)
        assertThrows(IllegalArgumentException::class.java) { AdminPlatformPolicy.patch("maintenance", emptyMap(), initial, initial + mapOf("r|active" to "true", "r|text" to ""), groups) }
        listOf("javascript:alert(1)", "//evil.example/a", "/admin.html").forEach { link -> assertThrows(IllegalArgumentException::class.java) { AdminPlatformPolicy.patch("maintenance", emptyMap(), initial, initial + mapOf("r|active" to "true", "r|buttonUrl" to link), groups) } }
    }
    @Test fun officialLinksCanOnlyUseStaticPathsOnTheCanonicalSite() {
        listOf("/", "/admin.html", "/merchant-dashboard.html").forEach { assertTrue(OfficialSystemLinkPolicy.path(it)) }
        listOf("//evil.example", "https://evil.example", "/a.html?token=secret", "/../a.html", "/admin.html#login").forEach { assertFalse(OfficialSystemLinkPolicy.path(it)) }
    }
}
