package com.visitaloja.app

import java.net.URI
import java.net.URLDecoder

data class VideoSource(val url: String, val youtubeId: String? = null) {
    val thumbnail: String? get() = youtubeId?.let { "https://i.ytimg.com/vi/$it/hqdefault.jpg" }
}
data class LojaVideo(val id: String, val title: String, val description: String, val credit: String,
    val source: VideoSource, val thumbnail: String?)
data class VideoGallery(val title: String = "Loja en video", val description: String = "Historias, sabores y lugares para descubrir desde otra mirada.", val items: List<LojaVideo> = emptyList())

/** Mirrors settings/videoGallery; no YouTube API key, scraping or downloaded streams. */
object VideoPolicy {
    private val youtubeHosts = setOf("youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com")
    fun source(value: String): VideoSource? = try {
        val text = value.trim()
        val uri = URI(text)
        if (text.isBlank() || text.length > 2000 || text.any { it.isWhitespace() || it.isISOControl() || it == '\\' } || uri.scheme != "https" || uri.userInfo != null || uri.port !in setOf(-1, 443) || uri.host.isNullOrBlank()) null
        else {
            val host = uri.host.lowercase(java.util.Locale.ROOT)
            val path = uri.path.orEmpty()
            val id = when {
                host == "youtu.be" -> path.removePrefix("/").removeSuffix("/")
                host in youtubeHosts && path == "/watch" -> uri.rawQuery.orEmpty().split('&').map { it.split('=', limit = 2) }.firstOrNull { it.first() == "v" }?.getOrNull(1)?.let { URLDecoder.decode(it, "UTF-8") }
                host in youtubeHosts -> Regex("^/(?:embed|shorts|live)/([A-Za-z0-9_-]{11})/?$").matchEntire(path)?.groupValues?.get(1)
                else -> null
            }
            when {
                id != null && Regex("[A-Za-z0-9_-]{11}").matches(id) -> VideoSource("https://www.youtube.com/watch?v=$id", id)
                host !in youtubeHosts && host != "youtu.be" && !host.endsWith(".youtube.com") && !host.endsWith(".youtube-nocookie.com") && !host.endsWith(".youtu.be") && Regex(".*\\.(mp4|webm)$", RegexOption.IGNORE_CASE).matches(path) -> VideoSource(uri.toASCIIString())
                else -> null
            }
        }
    } catch (_: Exception) { null }
    fun read(raw: Map<String, Any?>): VideoGallery {
        val title = raw.text("title").trim().take(100).ifBlank { "Loja en video" }
        val description = raw.text("description").trim().take(350).ifBlank { VideoGallery().description }
        if (raw["active"] != true) return VideoGallery(title, description)
        val rows = raw["items"] as? List<*> ?: emptyList<Any>()
        val items = rows.take(30).mapIndexedNotNull { index, value ->
            val row = (value as? Map<*, *>)?.entries?.associate { it.key.toString() to it.value } ?: return@mapIndexedNotNull null
            if (row["published"] != true || row["active"] == false || row["hidden"] == true || row.text("status").lowercase() in setOf("draft", "hidden", "archived", "deleted")) return@mapIndexedNotNull null
            val name = row.text("title").trim().take(160).takeIf { it.isNotBlank() } ?: return@mapIndexedNotNull null
            val source = source(row.text("url")) ?: return@mapIndexedNotNull null
            LojaVideo(row.text("id").trim().take(80).ifBlank { "video-$index" }, name, row.text("description").trim().take(350), row.text("credit").trim().take(140), source, DiscoveryPolicy.media(row.text("thumbnail")))
        }.distinctBy { it.id }
        return VideoGallery(title, description, items)
    }
    fun filter(gallery: VideoGallery, query: String): List<LojaVideo> {
        val words = PlacePolicy.normalize(query).split(' ').filter { it.isNotBlank() }
        return gallery.items.filter { video -> words.all { it in PlacePolicy.normalize("${video.title} ${video.description} ${video.credit}") } }
    }
    fun appOrigin(packageName: String): String {
        require(Regex("[a-zA-Z][a-zA-Z0-9_]*(?:\\.[a-zA-Z0-9_]+)+").matches(packageName))
        return "https://${packageName.lowercase(java.util.Locale.ROOT)}"
    }
    fun playerMessage(code: Int): String = when (code) {
        100 -> "El video ya no está disponible o es privado."
        101, 150 -> "YouTube no permite reproducir este video aquí. Puede requerir iniciar sesión o tener restricciones de su autor."
        153 -> "YouTube no pudo verificar el reproductor de esta app."
        2 -> "El enlace del video no es válido."
        else -> "No se pudo cargar el video. Comprueba tu conexión e inténtalo de nuevo."
    }
    fun youtubeFrame(url: String): Boolean = runCatching {
        val uri = URI(url); val host = uri.host.orEmpty().lowercase(java.util.Locale.ROOT)
        uri.scheme == "https" && uri.userInfo == null && uri.port in setOf(-1, 443) && (host in youtubeHosts || host.endsWith(".youtube.com") || host.endsWith(".youtube-nocookie.com"))
    }.getOrDefault(false)
}
