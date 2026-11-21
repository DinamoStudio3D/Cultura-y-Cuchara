package com.visitaloja.app

import java.net.URI

/** Read-only projections of the same public documents used by the website. */
data class LojaPhoto(val id: String, val section: String, val title: String, val url: String,
    val credit: String, val creditUrl: String?, val description: String, val alt: String)
data class TimePlace(val id: String, val title: String, val past: String?, val present: String?,
    val pastLabel: String, val presentLabel: String, val description: String, val audio: String?)
data class LojaPodcast(val title: String, val label: String, val cover: String?, val audio: String?)

object DiscoveryPolicy {
    val sections = listOf("Loja en imágenes", "Loja, en cada mirada", "Portada principal")
    /** Relative website assets are resolved only against the canonical HTTPS origin. */
    fun media(value: String): String? = try {
        val text = value.trim()
        if (text.isEmpty() || text.length > 4096 || text.startsWith("//") || text.any { it.isWhitespace() || it.isISOControl() || it == '\\' }) null
        else URI("https://www.visitaloja.com/").resolve(text).normalize().takeIf {
            it.scheme == "https" && !it.host.isNullOrBlank() && it.userInfo == null && it.port in listOf(-1, 443)
        }?.toASCIIString()
    } catch (_: Exception) { null }
    fun photoUrl(value: String): String? {
        val url = media(value) ?: return null
        val uri = URI(url)
        val image = Regex(".*\\.(jpe?g|png|webp)$", RegexOption.IGNORE_CASE).matches(uri.path ?: "")
        return url.takeIf {
            (uri.host.equals("www.visitaloja.com", true) && uri.path.startsWith("/assets/photos/") && image) ||
                (uri.host.equals("i.imgur.com", true) && image) ||
                (uri.host.equals("res.cloudinary.com", true) && uri.path.contains("/image/upload/"))
        }
    }
    private fun visible(raw: Map<String, Any?>): Boolean = raw["active"] != false && raw["visible"] != false && raw["hidden"] != true && raw["published"] != false && raw.text("status").lowercase() !in setOf("draft", "hidden", "archived", "deleted") && raw.text("publicationStatus").lowercase() in setOf("", "published")
    fun photos(raw: Map<String, Any?>, defaults: List<LojaPhoto>): List<LojaPhoto> {
        val rows = raw["photoManagerItems"] as? List<*> ?: emptyList<Any>()
        if (raw["photoManagerInitialized"] != true && rows.isEmpty()) return defaults
        return rows.mapNotNull { item ->
            val row = (item as? Map<*, *>)?.entries?.associate { it.key.toString() to it.value } ?: return@mapNotNull null
            val id = row.text("id").take(100).takeIf { it.isNotBlank() } ?: return@mapNotNull null
            val section = row.text("section").takeIf { it in sections } ?: return@mapNotNull null
            val url = photoUrl(row.text("url")) ?: return@mapNotNull null
            if (!visible(row)) return@mapNotNull null
            val title = row.text("title").trim().take(120).ifBlank { "Fotografía de Loja" }
            LojaPhoto(id, section, title, url, row.text("credit").trim().take(100).ifBlank { "Autor no indicado" },
                row.text("creditUrl").takeIf { it.startsWith("https://") }?.let(::media), row.text("description").take(240), row.text("alt").take(240).ifBlank { title })
        }.distinctBy { it.id }
    }
    fun time(id: String, raw: Map<String, Any?>): TimePlace? {
        if (!visible(raw)) return null
        val title = raw.text("title").trim().take(180).takeIf { it.isNotBlank() } ?: return null
        fun image(key: String) = media(raw.text(key))?.takeUnless { URI(it).path.endsWith(".svg", true) }
        return TimePlace(id, title, image("imgPast"), image("imgPresent"), raw.text("labelPast").take(70).ifBlank { "Ayer" },
            raw.text("labelPresent").take(70).ifBlank { "Hoy" }, raw.text("desc").replace(Regex("<[^>]*>"), "").trim().take(30000), media(raw.text("audioUrl")))
    }
    fun podcast(raw: Map<String, Any?>): LojaPodcast? {
        if (!visible(raw)) return null
        val audioText = raw.text("audioUrl")
        return LojaPodcast(raw.text("title").trim().take(180).ifBlank { "Visita Loja — El Podcast de Loja" },
            raw.text("label").take(100).ifBlank { "Canción de muestra" }, media(raw.text("coverUrl")),
            if (audioText.isBlank()) "https://www.visitaloja.com/cancion-muestra-vive-loja.mp3" else media(audioText))
    }
    fun filter(photos: List<LojaPhoto>, section: String, query: String): List<LojaPhoto> {
        val tokens = PlacePolicy.normalize(query).split(' ').filter { it.isNotBlank() }
        return photos.filter { it.section == section && tokens.all { token -> token in PlacePolicy.normalize("${it.title} ${it.credit} ${it.description}") } }
    }
}
