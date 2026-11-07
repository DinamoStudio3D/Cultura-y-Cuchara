package com.visitaloja.app

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class PlaceMediaPolicyTest {
    private fun document(plan: String = "premium", status: String = "active", benefit: Boolean = true, dates: String = ""): JSONObject = JSONObject("""{"name":"projects/p/databases/(default)/documents/locales/p1","fields":{"title":{"stringValue":"Café"},"youtubeUrl":{"stringValue":"https://youtu.be/M7lc1UVf-VE"},"audioUrl":{"stringValue":"audios/cafe.mp3"},"audioUrlEn":{"stringValue":"https://media.example/cafe-en.mp3"},"subscription":{"mapValue":{"fields":{"plan":{"stringValue":"$plan"},"status":{"stringValue":"$status"},"benefits":{"mapValue":{"fields":{"video":{"booleanValue":$benefit}}}}$dates}}}}}""")
    @Test fun videoRequiresThePublishedPaidVideoBenefit() {
        val p = PlaceJson.document(document())!!
        assertEquals("M7lc1UVf-VE", PlaceMediaPolicy.video(p, 0)?.youtubeId)
        assertNull(PlaceMediaPolicy.video(p.copy(publicationStatus = "draft"), 0))
        for (status in listOf("paused", "pending", "expired", "suspended")) assertNull(PlaceMediaPolicy.video(PlaceJson.document(document(status = status))!!, 0))
        assertNull(PlaceMediaPolicy.video(PlaceJson.document(document(plan = "free"))!!, 0))
        assertNull(PlaceMediaPolicy.video(PlaceJson.document(document(benefit = false))!!, 0))
    }
    @Test fun dateOnlyWindowsUseInclusiveEcuadorDays() {
        val p = PlaceJson.document(document(dates = """, "startDate":{"stringValue":"2026-10-28"}, "endDate":{"stringValue":"2026-10-28"}"""))!!
        fun has(at: String) = PlaceMediaPolicy.video(p, Instant.parse(at).toEpochMilli()) != null
        assertFalse(has("2026-10-28T04:59:59Z"));assertTrue(has("2026-10-28T05:00:00Z"))
        assertTrue(has("2026-10-29T04:59:59.999Z"));assertFalse(has("2026-10-29T05:00:00Z"))
    }
    @Test fun malformedAndInvertedWindowsNeverEnableTheVideo() {
        for (dates in listOf(""", "startAt":{"stringValue":"broken"}""", """, "startDate":{"stringValue":"2027-01-01"}, "endDate":{"stringValue":"2026-01-01"}""")) {
            assertNull(PlaceMediaPolicy.video(PlaceJson.document(document(dates = dates))!!, Instant.parse("2026-10-28T12:00:00Z").toEpochMilli()))
        }
    }
    @Test fun audioNormalizesOnlyConfiguredPublicSourcesAndRemainsAvailableWithoutPaidVideo() {
        val p = PlaceJson.document(document(plan = "free"))!!
        assertEquals("https://www.visitaloja.com/audios/cafe.mp3", p.media.audioEs)
        assertEquals("https://media.example/cafe-en.mp3", p.media.audioEn)
        assertEquals("https://www.visitaloja.com/audios/Plaza%20santo%20domingo.mp3", PlaceMediaPolicy.audio("audios/Plaza santo domingo.mp3"))
        val f = document().getJSONObject("fields");f.put("audioUrl", JSONObject().put("stringValue", "javascript:bad"));f.remove("audioUrlEn")
        assertNull(PlaceMediaPolicy.read(f).audioEs);assertNull(PlaceMediaPolicy.read(f).audioEn)
    }
    @Test fun cacheRoundtripPreservesProjectionAndOldCopiesRemainEmpty() {
        val p = PlaceJson.document(document())!!
        assertEquals(p.media, PlaceJson.cached(PlaceJson.cachePlace(p))!!.media)
        assertEquals(PlaceMedia(), PlaceJson.cached(JSONObject("""{"id":"p","title":"Café"}"""))!!.media)
    }
    @Test fun removedReplacedAndHiddenNarrationsStopMatchingTheActivePlayer() {
        val p = PlaceJson.document(document())!!;val key = PlaceMediaPolicy.audioKey(p, false)
        assertEquals(p.media.audioEs, PlaceMediaPolicy.activeAudio(listOf(p), key))
        assertNull(PlaceMediaPolicy.activeAudio(emptyList(), key))
        assertNull(PlaceMediaPolicy.activeAudio(listOf(p.copy(active = false)), key))
        assertEquals("https://media.example/new.mp3", PlaceMediaPolicy.activeAudio(listOf(p.copy(media = p.media.copy(audioEs = "https://media.example/new.mp3"))), key))
        assertEquals(p.media.audioEn, PlaceMediaPolicy.activeAudio(listOf(p), PlaceMediaPolicy.audioKey(p, true)))
    }
}
