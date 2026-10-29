package com.visitaloja.app

import java.net.URI

data class ReceivedNotice(val id: String, val title: String, val body: String, val url: String, val receivedAt: Long)

object PushPolicy {
    /** Notifications can only point at the public canonical website, never arbitrary external intents. */
    fun link(value: String): String? = try {
        if (value.length > 500 || !value.startsWith('/') || value.startsWith("//") || value.any { it.isWhitespace() || it.isISOControl() || it == '\\' }) null
        else URI("https://www.visitaloja.com").resolve(value).takeIf { it.scheme == "https" && it.host == "www.visitaloja.com" && it.userInfo == null && it.port == -1 &&
            (it.path in setOf("/", "/cantones.html", "/fidelidad.html", "/agenda.html", "/loja-en-el-tiempo.html", "/mesa-turistica.html", "/aliados.html", "/que-hacer-en-loja", "/hoteles-en-loja", "/restaurantes-en-loja", "/cafeterias-en-loja", "/huecas-en-loja", "/panaderias-en-loja", "/heladerias-en-loja", "/bares-en-loja", "/entretenimiento-en-loja", "/artesanias-en-loja") || Regex("/parada/[a-zA-Z0-9_-]+/?").matches(it.path)) }?.let { it.rawPath + (it.rawQuery?.let { q -> "?$q" } ?: "") + (it.rawFragment?.let { f -> "#$f" } ?: "") }
    } catch (_: Exception) { null }
    fun notice(data: Map<String, String>, id: String, now: Long): ReceivedNotice? {
        val title = data["title"]?.trim()?.takeIf { it.isNotBlank() && it.length <= 80 && it.none(Char::isISOControl) } ?: return null
        val body = data["body"]?.trim()?.takeIf { it.isNotBlank() && it.length <= 240 && it.none { c -> c.isISOControl() && c != '\n' } } ?: return null
        val url = link(data["url"] ?: "/") ?: return null
        return ReceivedNotice(id.take(200), title, body, url, now)
    }
    fun eligible(owner: String?, currentUid: String?, consent: Boolean, active: Boolean): Boolean = !owner.isNullOrBlank() && owner == currentUid && consent && active
    fun fresh(sentAt: Long, now: Long, tag: String): Boolean {
        val ttl = if (tag.startsWith("prueba-")) 300_000L else 3_600_000L
        return sentAt > 0 && sentAt <= now + 300_000L && now - sentAt <= ttl
    }
    fun deviceId(value: String?): Boolean = value != null && Regex("[a-f0-9]{64}").matches(value)
    fun history(old: List<ReceivedNotice>, next: ReceivedNotice): List<ReceivedNotice> = (listOf(next) + old.filter { it.id != next.id }).take(20)
    fun route(url: String): String? {
        val safe = link(url) ?: return null
        val uri = URI(safe)
        return when (uri.path) {
            "/cantones.html" -> "cantons"
            "/agenda.html" -> "agenda"
            "/loja-en-el-tiempo.html" -> "time"
            "/fidelidad.html" -> "passport"
            "/" -> when (uri.fragment) {
                "mapa" -> "map"; "agenda", "fiavl" -> "agenda"; "misiones" -> "missions"; "pasaporte" -> "passport"
                "historias" -> "stories"; "emprendedores" -> "enterprises"; "loja-en-video" -> "videos"; "loja-tiempo" -> "time"; "loja-en-imagenes" -> "photos"; null, "", "inicio" -> "home"; else -> null
            }
            else -> null
        }
    }
}
