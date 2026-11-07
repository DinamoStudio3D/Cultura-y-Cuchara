package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test

class DiscoveryPolicyTest {
    private val photo = mapOf("id" to "photo-1", "section" to "Loja en imágenes", "url" to "assets/photos/jipiro-laguna.webp", "title" to "Parque Jipiro", "credit" to "Geovanny Muñoz")
    private fun managed(vararg rows: Map<String, Any?>) = mapOf("photoManagerInitialized" to true, "photoManagerItems" to rows.toList())
    @Test fun emptyConfiguredGalleryNeverRestoresWithdrawnDefaults() {
        val defaults = DiscoveryPolicy.photos(managed(photo), emptyList())
        assertEquals(1, defaults.size)
        assertEquals(defaults, DiscoveryPolicy.photos(emptyMap(), defaults))
        assertTrue(DiscoveryPolicy.photos(managed(), defaults).isEmpty())
        assertTrue(DiscoveryPolicy.photos(managed(photo + ("active" to false)), defaults).isEmpty())
    }
    @Test fun photoProjectionPreservesCreditsAndSectionFilters() {
        val photos = DiscoveryPolicy.photos(managed(photo, photo + ("id" to "second") + ("section" to "Portada principal")), emptyList())
        assertEquals("Geovanny Muñoz", photos.first().credit)
        assertEquals("https://www.visitaloja.com/assets/photos/jipiro-laguna.webp", photos.first().url)
        assertEquals(1, DiscoveryPolicy.filter(photos, "Loja en imágenes", "geovanny munoz").size)
        assertTrue(DiscoveryPolicy.filter(photos, "Loja en imágenes", "desconocido").isEmpty())
    }
    @Test fun untrustedPhotoHostsAndUnsafeMediaAreRejected() {
        listOf("http://i.imgur.com/a.jpg", "//i.imgur.com/a.jpg", "javascript:alert(1)", "https://user:pass@i.imgur.com/a.jpg", "https://i.imgur.com/a.jpg\nattack", "https://i.imgur.com/a.jpg\\x").forEach { assertNull(it, DiscoveryPolicy.media(it)) }
        assertNull(DiscoveryPolicy.photoUrl("https://i.imgur.com.evil.test/a.jpg"))
        assertNull(DiscoveryPolicy.photoUrl("assets/brand/logo.webp"))
        assertNotNull(DiscoveryPolicy.photoUrl("https://res.cloudinary.com/demo/image/upload/a"))
    }
    @Test fun unpublishedHistoryAndPodcastStayHidden() {
        listOf(mapOf("active" to false), mapOf("published" to false), mapOf("status" to "draft"), mapOf("hidden" to true), mapOf("visible" to false)).forEach {
            assertNull(DiscoveryPolicy.time("id", it + ("title" to "Centro")))
            assertNull(DiscoveryPolicy.podcast(it))
        }
    }
    @Test fun missingHistoricPhotosRemainMissingAndTextRemainsReadable() {
        val place = DiscoveryPolicy.time("id", mapOf("title" to "Centro", "imgPast" to "assets/photos/photo-unavailable.svg", "imgPresent" to "assets/photos/centro-loja-torre-reloj.webp", "desc" to "<p>Una historia</p>"))!!
        assertNull(place.past)
        assertNotNull(place.present)
        assertEquals("Una historia", place.description)
        assertEquals("Ayer", place.pastLabel)
        assertNull(place.audio)
    }
    @Test fun configuredInvalidAudioNeverPlaysDifferentSample() {
        assertNotNull(DiscoveryPolicy.podcast(emptyMap())!!.audio)
        assertNull(DiscoveryPolicy.podcast(mapOf("audioUrl" to "http://example.com/audio.mp3"))!!.audio)
        assertEquals("https://www.visitaloja.com/audio.mp3", DiscoveryPolicy.media("audio.mp3"))
    }
}
