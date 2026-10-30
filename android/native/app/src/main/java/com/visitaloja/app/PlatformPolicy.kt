package com.visitaloja.app

import java.net.URI

internal data class PlatformContact(val title: String = "Hablemos de Loja", val description: String = "Consultas, alianzas y asistencia sobre la plataforma.", val email: String? = null, val links: List<Pair<String, String>> = emptyList(), val footer: String = "")
internal data class LegalBlock(val kind: String, val html: String)
internal object PlatformPolicy {
    val documents = mapOf("privacy" to "privacidad.html", "terms" to "terminos.html")
    fun documentUrl(key: String) = documents[key]?.let { "https://www.visitaloja.com/$it" }
    fun safeLink(raw: Any?): String? {
        val value = raw as? String ?: return null
        if (value.isEmpty() || value.length > 2000 || value.any { it <= ' ' || it in "\\<>\"'" }) return null
        return runCatching { URI(value).takeIf { it.scheme.equals("https", true) && !it.host.isNullOrBlank() && it.userInfo == null && it.port == -1 }?.toASCIIString() }.getOrNull()
    }
    fun contact(raw: Map<String, Any?>, english: Boolean = false): PlatformContact {
        val homepage = raw["homepageContent"] as? Map<*, *> ?: emptyMap<Any, Any>()
        val blocks = homepage["blocks"] as? Map<*, *> ?: emptyMap<Any, Any>()
        val contact = blocks["footerContact"] as? Map<*, *> ?: emptyMap<Any, Any>()
        val identity = blocks["footerIdentity"] as? Map<*, *> ?: emptyMap<Any, Any>()
        fun text(source: Map<*, *>, key: String, fallback: String): String {
            val es = source[key] as? String ?: fallback
            return ((if (english) source[key + "En"] as? String else null)?.takeIf { it.isNotBlank() } ?: es).take(700)
        }
        val email = (homepage["contactEmail"] as? String)?.takeIf { it.length <= 150 && Regex("^[^\\s@<>]+@[^\\s@<>]+\\.[^\\s@<>]+$").matches(it) && it.none(Char::isISOControl) && it.none { c -> c in "?,;:&#%\\\"'" } }
        val names = listOf("whatsappUrl" to "WhatsApp", "youtubeUrl" to "YouTube", "tiktokUrl" to "TikTok", "instagramUrl" to "Instagram", "facebookUrl" to "Facebook")
        return PlatformContact(text(contact, "footerContactTitle", "Hablemos de Loja"), text(contact, "footerContactHelp", "Consultas, alianzas y asistencia sobre la plataforma."), email, names.mapNotNull { (key, name) -> safeLink(contact[key])?.let { name to it } }, text(identity, "title", ""))
    }
    fun legal(html: String): List<LegalBlock> {
        require(html.length <= 256000)
        val article = Regex("<article\\b[^>]*>([\\s\\S]*?)</article>", RegexOption.IGNORE_CASE).find(html)?.groupValues?.get(1) ?: return emptyList()
        return Regex("<(h1|h2|p)\\b[^>]*>([\\s\\S]*?)</\\1>", RegexOption.IGNORE_CASE).findAll(article).take(100).map { LegalBlock(it.groupValues[1].lowercase(), it.groupValues[2]) }.toList().takeIf { blocks -> blocks.any { it.kind == "h1" } && blocks.any { it.kind == "h2" } }.orEmpty()
    }
}
