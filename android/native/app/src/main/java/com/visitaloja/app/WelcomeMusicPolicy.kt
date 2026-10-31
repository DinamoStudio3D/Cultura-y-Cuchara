package com.visitaloja.app

data class WelcomeMusicConfig(val enabled: Boolean = false, val url: String? = null, val volume: Float = .2f)

/** Same public settings/main fields and fallback recording as the website. */
object WelcomeMusicPolicy {
    const val KEY = "welcome-music"
    const val DEFAULT_URL = "https://www.visitaloja.com/audios/cancion-visita-loja-v1.mp3"
    fun read(raw: Map<String, Any?>): WelcomeMusicConfig {
        val source = when (val value = raw["welcomeMusicUrl"]) {
            null, "" -> DEFAULT_URL
            is String -> value.trim()
            else -> ""
        }
        val url = DiscoveryPolicy.media(source)
        val number = when (val value = raw["welcomeMusicVolume"]) { is Number -> value.toFloat(); is String -> value.toFloatOrNull(); else -> null }
        val volume = number?.takeIf { it.isFinite() }?.coerceIn(0f, 1f) ?: .2f
        return WelcomeMusicConfig(raw["welcomeMusicEnabled"] != false && url != null, url, volume)
    }
    fun confirmed(content: PublicContent<WelcomeMusicConfig>) = !content.loading && !content.cached && !content.error && content.value.enabled && content.value.url != null
    fun blocked(tab: String, overlay: Boolean) = overlay || tab in setOf("map", "videos", "time", "podcast", "stories")
}
