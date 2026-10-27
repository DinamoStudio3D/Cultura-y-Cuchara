package com.visitaloja.app

import java.net.URI
import java.time.LocalDate

data class DigitalMenu(val id: String, val title: String, val image: String, val logo: String?, val whatsapp: String?, val instagram: String?)

/** Same published QR document as place-digital-menu.js. Plan dates gate extras, never the menu image. */
object MenuPolicy {
    fun validId(id: String?): Boolean = id != null && Regex("[a-zA-Z0-9_-]{1,100}").matches(id)
    private fun https(value: Any?, hosts: Set<String>): String? = try {
        (value as? String)?.takeIf { it.length <= 4096 && it.none { c -> c.isWhitespace() || c.isISOControl() || c == '\\' } }?.let(::URI)
            ?.takeIf { it.scheme == "https" && it.host in hosts && it.userInfo == null && it.port in setOf(-1, 443) }?.toASCIIString()
    } catch (_: Exception) { null }
    fun read(id: String, data: Map<String, Any?>?, today: LocalDate): DigitalMenu? {
        if (!validId(id) || data == null || data["active"] == false || !(data["visit"] as? Map<*, *>)?.get("placeId").let { it == null || it == "" }) return null
        val image = https(data["menuImageUrl"], setOf("res.cloudinary.com", "i.imgur.com")) ?: return null
        val target = try { URI("https://www.visitaloja.com").resolve(data["targetUrl"] as? String ?: return null) } catch (_: Exception) { return null }
        val host = target.host.orEmpty()
        if (target.scheme != "https" || target.userInfo != null || target.port !in setOf(-1, 443) ||
            !(host in setOf("visitaloja.com", "www.visitaloja.com") || Regex("visitaloja-[a-z0-9]+-dinamostudio3d\\.vercel\\.app").matches(host)) || target.path != "/menu-digital.html") return null
        val query = runCatching { target.rawQuery.orEmpty().split('&').map { it.split('=', limit = 2) }.filter { it.size == 2 }.map { java.net.URLDecoder.decode(it[0], "UTF-8") to java.net.URLDecoder.decode(it[1], "UTF-8") } }.getOrNull() ?: return null
        if (query.firstOrNull { it.first == "id" }?.second != id) return null
        var validDates = true
        fun date(key: String): LocalDate? {
            val value = data[key] as? String ?: return null
            if (value.isBlank()) return null
            return runCatching { LocalDate.parse(value) }.getOrElse { validDates = false; null }
        }
        val start = date("menuPlanStarts"); val end = date("menuPlanExpires")
        val active = validDates && (start == null || today >= start) && (end == null || today <= end)
        val benefits = if (active) data["menuBenefits"] as? Map<*, *> else null
        val logo = if (benefits?.get("logo") == true) https(data["menuBusinessLogo"], setOf("res.cloudinary.com", "i.imgur.com")) else null
        val whatsapp = (data["menuWhatsapp"] as? String)?.takeIf { benefits?.get("whatsapp") == true && Regex("5939[0-9]{8}").matches(it) }
        val instagram = if (benefits?.get("instagram") == true) https(data["menuInstagram"], setOf("instagram.com", "www.instagram.com")) else null
        return DigitalMenu(id, (data["name"] as? String).orEmpty().take(110).ifBlank { "Menú digital" }, image, logo, whatsapp, instagram)
    }
}
