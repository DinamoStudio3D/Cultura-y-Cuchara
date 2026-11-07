package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class CulturePolicyTest {
    private fun story(vararg extra: Pair<String, Any?>): Map<String, Any?> = mapOf<String, Any?>("id" to "one", "title" to "Café de Loja", "status" to "published", "intro" to "Sabores tradicionales", "body" to "Relato completo", "source" to "Memoria local") + extra
    private fun stories(vararg rows: Map<String, Any?>) = CulturePolicy.stories(mapOf("items" to rows.toList()))
    @Test fun onlyPublishedStoriesAndExplicitlyActiveCatalogueAppear() {
        val items = stories(story(), story("id" to "draft", "status" to "draft"), story("id" to "hidden", "hidden" to true), story("id" to "missing", "status" to ""))
        assertEquals(listOf("one"), CulturePolicy.visible(items, 0).map { it.id })
        val off = CulturePolicy.stories(mapOf("settings" to mapOf("active" to false), "items" to listOf(story())))
        assertTrue(CulturePolicy.visible(off, 0).isEmpty())
    }
    @Test fun publicationSchedulingHonorsBoundaryAndRejectsMalformedDates() {
        val due = Instant.parse("2026-10-30T05:00:00Z").toEpochMilli()
        val items = stories(story("publishAt" to "2026-10-30"), story("id" to "bad", "publishAt" to "broken"))
        assertTrue(CulturePolicy.visible(items, due - 1).isEmpty())
        assertEquals(listOf("one"), CulturePolicy.visible(items, due).map { it.id })
    }
    @Test fun storiesKeepBilingualTextSourcesAndOnlySafeMedia() {
        val s = stories(story("titleEn" to "Loja Coffee", "bodyEn" to "Complete story", "cover" to "javascript:bad", "gallery" to listOf("assets/photos/loja-centro.webp", "file:///bad"), "audioUrl" to "audios/Plaza santo domingo.mp3", "videoUrl" to "https://youtu.be/M7lc1UVf-VE", "relatedPlaceIds" to listOf("a", "a", "b"))).items.single()
        assertEquals("Loja Coffee", s.titleEn);assertEquals("Complete story", s.bodyEn);assertEquals("Memoria local", s.source)
        assertNull(s.cover);assertEquals(1, s.gallery.size);assertEquals(listOf("a", "b"), s.related)
        assertEquals("https://www.visitaloja.com/audios/Plaza%20santo%20domingo.mp3", s.audio)
        assertEquals("M7lc1UVf-VE", s.video?.youtubeId)
    }
    @Test fun storySearchCombinesAccentsCategorySourceAndWords() {
        val catalogue = stories(story("category" to "Gastronomía"))
        assertEquals(1, CulturePolicy.stories(catalogue, 0, "cafe memoria", "Gastronomía").size)
        assertTrue(CulturePolicy.stories(catalogue, 0, "cafe", "Arquitectura").isEmpty())
        assertTrue(CulturePolicy.stories(catalogue, 0, "cafe otro", "").isEmpty())
    }
    @Test fun noDocumentsOrEmptyItemsNeverCreateExamplesOrContactNumbers() {
        assertTrue(CulturePolicy.stories(emptyMap()).items.isEmpty())
        assertTrue(CulturePolicy.enterprises(emptyMap()).isEmpty())
        assertTrue(CulturePolicy.enterprises(mapOf("items" to emptyList<Any>())).isEmpty())
    }
    @Test fun enterprisesRejectHiddenRowsAndNormalizeConfiguredContact() {
        val row = mapOf("id" to "a", "name" to "Café local", "category" to "Alimentos", "desc" to "Granos de altura", "phone" to "0987654321", "img" to "javascript:bad")
        val items = CulturePolicy.enterprises(mapOf("items" to listOf(row, row + mapOf("id" to "b", "active" to false))))
        assertEquals(1, items.size);assertNull(items.single().image);assertEquals("593987654321", items.single().phone)
        assertNull(CulturePolicy.enterprises(mapOf("items" to listOf(row + mapOf("phone" to "12")))).single().phone)
    }
    @Test fun enterpriseSearchCombinesCategoryAccentsAndDescription() {
        val items = CulturePolicy.enterprises(mapOf("items" to listOf(mapOf("id" to "a", "name" to "Café", "category" to "Alimentos", "desc" to "Granos locales"))))
        assertEquals(1, CulturePolicy.enterprises(items, "cafe granos", "Alimentos").size)
        assertTrue(CulturePolicy.enterprises(items, "cafe", "Arte").isEmpty())
    }
    @Test fun unpublishedAndReplacedStoryNarrationsStopMatchingCurrentPlayback() {
        val catalogue = stories(story("audioUrl" to "https://media.example/old.mp3"));val key = CulturePolicy.storyAudioKey("one", false)
        assertEquals("https://media.example/old.mp3", CulturePolicy.audio(catalogue, 0, key))
        assertNull(CulturePolicy.audio(StoryCatalogue(active = false), 0, key))
        assertNull(CulturePolicy.audio(stories(story("status" to "draft", "audioUrl" to "https://media.example/old.mp3")), 0, key))
        assertEquals("https://media.example/new.mp3", CulturePolicy.audio(stories(story("audioUrl" to "https://media.example/new.mp3")), 0, key))
    }
    @Test fun notificationsOpenTheNewSectionsNatively() {
        assertEquals("stories", PushPolicy.route("/#historias"))
        assertEquals("enterprises", PushPolicy.route("/#emprendedores"))
    }
}
