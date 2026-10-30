package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test

class PlatformPolicyTest {
    private fun raw(contact: Map<String, Any?>, email: String = "hola@example.com", identity: Map<String, Any?> = emptyMap()) = mapOf<String, Any?>("homepageContent" to mapOf("contactEmail" to email, "blocks" to mapOf("footerContact" to contact, "footerIdentity" to identity)))
    @Test fun onlyPublishedContactChannelsAreProjectedWithoutSampleFallbacks() {
        val data = PlatformPolicy.contact(raw(mapOf("whatsappUrl" to "https://wa.me/593123456789", "instagramUrl" to "", "youtubeUrl" to "javascript:alert(1)")))
        assertEquals("hola@example.com", data.email)
        assertEquals(listOf("WhatsApp" to "https://wa.me/593123456789"), data.links)
        assertTrue(PlatformPolicy.contact(emptyMap()).links.isEmpty())
        assertNull(PlatformPolicy.contact(emptyMap()).email)
    }
    @Test fun contactMatchesHomepageSpanishAndEnglishFallbackAndFooter() {
        val source = raw(mapOf("footerContactTitle" to "Escríbenos", "footerContactTitleEn" to "Contact us", "footerContactHelp" to "Ayuda", "footerContactHelpEn" to ""), identity = mapOf("title" to "Proyecto de Loja", "titleEn" to "Loja project"))
        assertEquals("Escríbenos", PlatformPolicy.contact(source).title)
        val english = PlatformPolicy.contact(source, true)
        assertEquals("Contact us", english.title);assertEquals("Ayuda", english.description);assertEquals("Loja project", english.footer)
    }
    @Test fun urlsRejectCredentialsSchemesWhitespaceControlsAndPorts() {
        assertEquals("https://example.com/a?q=1", PlatformPolicy.safeLink("https://example.com/a?q=1"))
        for (bad in listOf("http://example.com", "https://user:pass@example.com", "https://example.com:443", "https://example.com/a b", "//example.com", "https://example.com/\\evil", "https://example.com/\n", "assets/photo.png", "")) assertNull(PlatformPolicy.safeLink(bad))
    }
    @Test fun emailsCannotInjectRecipientsSubjectsOrControls() {
        for (bad in listOf("", "x", "a@b.com?bcc=other@b.com", "a@b.com\nbcc:x", "a@b.com&subject=test", "a%0a@b.com", "x".repeat(151) + "@b.com")) assertNull(PlatformPolicy.contact(raw(emptyMap(), bad)).email)
        assertEquals("hola+loja@example.com", PlatformPolicy.contact(raw(emptyMap(), "hola+loja@example.com")).email)
    }
    @Test fun legalExtractsOnlyArticleParagraphsAndHeadingsInSourceOrder() {
        val html = "<head><title>No</title></head><article class='card'><p>VERSIÓN 1.2</p><h1>Tu privacidad</h1><p>Tu cuenta &amp; datos</p><h2>Opciones</h2><p>Consulta <a href='/notifications.html'>Mis notificaciones</a>.</p></article><footer><p>No incluir</p></footer>"
        val blocks = PlatformPolicy.legal(html)
        assertEquals(listOf("p", "h1", "p", "h2", "p"), blocks.map { it.kind })
        assertEquals("VERSIÓN 1.2", blocks.first().html)
        assertTrue(blocks.none { "No incluir" in it.html })
        assertTrue(blocks.last().html.contains("Mis notificaciones"))
    }
    @Test fun missingOrUnexpectedLegalDocumentDoesNotLookLikeVerifiedPolicy() {
        assertTrue(PlatformPolicy.legal("<html><h1>Error</h1></html>").isEmpty())
        assertTrue(PlatformPolicy.legal("<article><h1>Error</h1><p>Try later</p></article>").isEmpty())
        assertNull(PlatformPolicy.documentUrl("../admin"))
        assertEquals("https://www.visitaloja.com/privacidad.html", PlatformPolicy.documentUrl("privacy"))
        assertEquals("https://www.visitaloja.com/terminos.html", PlatformPolicy.documentUrl("terms"))
    }
    @Test fun legalDocumentsAndContactHaveNativePublicLinkDestinations() {
        assertEquals("privacy", NativeLinkPolicy.parse("https://www.visitaloja.com/privacidad.html")?.route)
        assertEquals("terms", NativeLinkPolicy.parse("https://visitaloja.com/terminos.html")?.route)
        assertEquals("contact", NativeLinkPolicy.parse("https://www.visitaloja.com/#contacto")?.route)
        assertNull(NativeLinkPolicy.parse("https://evil.example/privacidad.html"))
        assertNull(NativeLinkPolicy.parse("https://www.visitaloja.com/privacidad.html?place=private"))
    }
    @Test(expected = IllegalArgumentException::class) fun oversizedLegalResponseIsRejected() { PlatformPolicy.legal("x".repeat(256001)) }
}
