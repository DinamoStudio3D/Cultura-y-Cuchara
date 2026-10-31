package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test

class VideoPolicyTest {
    private val id = "M7lc1UVf-VE"
    private val video = mapOf("id" to "loja", "title" to "Loja en imágenes", "url" to "https://youtu.be/M7lc1UVf-VE", "credit" to "María Muñoz", "published" to true)
    private fun gallery(vararg rows: Map<String, Any?>, active: Boolean = true) = mapOf("active" to active, "items" to rows.toList())
    @Test fun supportedYouTubeFormatsResolveToOneCanonicalId() {
        listOf("https://youtu.be/$id?t=20", "https://www.youtube.com/watch?v=$id&feature=share", "https://m.youtube.com/watch?v=$id", "https://www.youtube.com/shorts/$id", "https://www.youtube.com/live/$id", "https://www.youtube-nocookie.com/embed/$id").forEach {
            assertEquals(it, id, VideoPolicy.source(it)?.youtubeId)
            assertEquals("https://www.youtube.com/watch?v=$id", VideoPolicy.source(it)?.url)
        }
    }
    @Test fun unsafeAndImpersonatingLinksCannotBecomeAnEmbed() {
        listOf("http://youtu.be/$id", "//youtu.be/$id", "javascript:alert(1)", "https://youtube.com.evil.test/watch?v=$id", "https://user:password@youtu.be/$id", "https://youtu.be:8443/$id", "https://www.youtube.com/embed/invalid", "https://youtu.be/$id/extra", "https://www.youtube.com/embed/$id\nmore", "file:///data/secret.mp4").forEach { assertNull(it, VideoPolicy.source(it)) }
    }
    @Test fun hiddenDraftAndEmptyGalleriesNeverInventSampleVideos() {
        assertTrue(VideoPolicy.read(emptyMap()).items.isEmpty())
        assertTrue(VideoPolicy.read(gallery(video, active = false)).items.isEmpty())
        listOf(mapOf("published" to false), mapOf("status" to "draft"), mapOf("active" to false), mapOf("hidden" to true)).forEach { assertTrue(VideoPolicy.read(gallery(video + it)).items.isEmpty()) }
        assertTrue(VideoPolicy.read(gallery()).items.isEmpty())
    }
    @Test fun editorOrderAndCreditsArePreservedAndSearchIgnoresAccents() {
        val result = VideoPolicy.read(gallery(video + ("id" to "second"), video))
        assertEquals(listOf("second", "loja"), result.items.map { it.id })
        assertEquals("María Muñoz", result.items.first().credit)
        assertEquals(2, VideoPolicy.filter(result,"maria munoz").size)
        assertTrue(VideoPolicy.filter(result,"ausente").isEmpty())
    }
    @Test fun duplicateRowsAndInvalidThumbnailsDoNotBreakCards() {
        val result = VideoPolicy.read(gallery(video + ("thumbnail" to "javascript:alert(1)"), video))
        assertEquals(1, result.items.size)
        assertNull(result.items.first().thumbnail)
        assertEquals("https://i.ytimg.com/vi/$id/hqdefault.jpg", result.items.first().source.thumbnail)
    }
    @Test fun existingPublishedFilesRemainPlayableWithoutACloudUpload() {
        val source = VideoPolicy.source("https://example.com/loja.mp4?version=2")!!
        assertNull(source.youtubeId)
        assertNull(VideoPolicy.source("https://www.youtube.com/loja.mp4"))
        assertNotNull(VideoPolicy.source("https://example.com/loja.webm"))
    }
    @Test fun referrerIdentifiesTheInstalledAppRatherThanTheWebsite() {
        assertEquals("https://com.visitaloja.app.preview",VideoPolicy.appOrigin("com.visitaloja.app.preview"))
        assertTrue(VideoPolicy.youtubeFrame("https://www.youtube-nocookie.com/embed/$id"))
        assertFalse(VideoPolicy.youtubeFrame("https://www.youtube.com.evil.test/embed/$id"))
        assertFalse(VideoPolicy.youtubeFrame("https://example.com"))
    }
    @Test fun trustedWrapperDoesNotInjectAdminTextOrAutoPlay() {
        val html = YouTubePlayer.html(id, VideoPolicy.appOrigin("com.visitaloja.app.preview"), 0)
        assertTrue(html.contains("autoplay:0"))
        assertTrue(html.contains("https://www.youtube-nocookie.com"))
        assertTrue(html.contains("origin:'https://com.visitaloja.app.preview'"))
        assertTrue(VideoPolicy.playerMessage(150).contains("no permite"))
        assertThrows(IllegalArgumentException::class.java) { YouTubePlayer.html("bad'payload", "https://example.com",0) }
    }
}
