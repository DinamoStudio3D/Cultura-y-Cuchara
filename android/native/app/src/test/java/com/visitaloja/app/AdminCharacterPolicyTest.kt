package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test

class AdminCharacterPolicyTest {
    private val groups = listOf(PlatformGroup("character", "Personaje", true, listOf(
        PlatformField("r|active", "Visible", "true", "bool"), PlatformField("r|imageUrl", "Imagen", "mascota-vive-loja.png", "image"),
        PlatformField("n|messages|inicio", "Saludo", "Hola"), PlatformField("n|certificate|title", "Certificado", "Explorador"))))
    @Test fun changingGreetingPreservesCampaignInventoryAndUneditedMessages() {
        val base = mapOf<String, Any?>("imageUrl" to "mascota-vive-loja.png", "messages" to mapOf("inicio" to "Hola", "mapa" to "Mapa", "extra" to "Conservar"), "benefit" to mapOf("campaignId" to "old-campaign", "stock" to 10), "certificate" to mapOf("title" to "Explorador", "signature" to "Visita Loja"))
        val initial = AdminPlatformPolicy.read(base, groups)
        val patch = AdminPlatformPolicy.patch("chabaquito", base, initial, initial + ("n|messages|inicio" to "Bienvenido"), groups)
        assertEquals(setOf("messages"), patch.keys)
        assertEquals(mapOf("inicio" to "Bienvenido", "mapa" to "Mapa", "extra" to "Conservar"), patch["messages"])
        assertFalse(patch.containsKey("benefit")); assertFalse(patch.containsKey("missions"))
    }
    @Test fun certificateAndCharacterVisibilityAreIndependentOfV2MissionDefinitions() {
        val initial = AdminPlatformPolicy.read(emptyMap(), groups)
        val patch = AdminPlatformPolicy.patch("chabaquito", emptyMap(), initial, initial + mapOf("r|active" to "false", "n|certificate|title" to "Explorador lojano"), groups)
        assertEquals(false, patch["active"]); assertEquals(mapOf("title" to "Explorador lojano"), patch["certificate"])
        assertFalse(patch.containsKey("missions")); assertFalse(patch.containsKey("benefit"))
    }
    @Test fun nativeGuideUsesPublicGreetingAndSafeImageButNeverRunsWebMarkup() {
        val config = GuideCharacterPolicy.read(mapOf("active" to false, "imageUrl" to "javascript:alert(1)", "messages" to mapOf("inicio" to "Bienvenido")))
        assertFalse(config.active); assertNull(config.image); assertEquals("Bienvenido", config.greeting)
        assertTrue(GuideCharacterPolicy.read(emptyMap()).active)
        assertEquals("https://www.visitaloja.com/mascota-vive-loja.png", GuideCharacterPolicy.read(mapOf("imageUrl" to "mascota-vive-loja.png")).image)
    }
}
