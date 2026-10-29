package com.visitaloja.app

import org.json.JSONArray
import org.json.JSONObject
import java.net.URI
import java.time.Instant
import java.time.ZoneId
import java.util.Locale

data class PlaceInfo(val hours: String = "", val hoursEn: String = "", val openHour: Double? = null, val closeHour: Double? = null, val amenities: List<String> = emptyList(), val payments: List<String> = emptyList(), val priceRange: String = "", val links: Map<String, String> = emptyMap())
internal object PlaceInfoPolicy {
    val amenities = linkedMapOf("wifi" to "Wi-Fi", "parking" to "Estacionamiento", "accessible" to "Accesibilidad", "familyFriendly" to "Para familias", "petFriendly" to "Acepta mascotas", "takeaway" to "Para llevar", "delivery" to "Entrega a domicilio", "outdoorSeating" to "Mesas exteriores")
    val payments = linkedMapOf("cash" to "Efectivo", "card" to "Tarjeta", "transfer" to "Transferencia", "qr" to "Pago QR")
    val links = linkedMapOf("website" to "Sitio web", "instagram" to "Instagram", "facebook" to "Facebook", "tiktok" to "TikTok")
    private val zone = ZoneId.of("America/Guayaquil")
    private fun JSONObject.text(key: String) = optJSONObject(key)?.optString("stringValue").orEmpty()
    private fun JSONObject.number(key: String) = optJSONObject(key)?.let { v ->
        when { v.has("doubleValue") -> v.optDouble("doubleValue"); v.has("integerValue") -> v.optString("integerValue").toDoubleOrNull(); v.has("stringValue") -> v.optString("stringValue").toDoubleOrNull(); else -> null }
    }?.let(::hour)
    fun hour(value: Double?) = value?.takeIf { it.isFinite() && it in 0.0..24.0 }
    fun url(kind: String, value: String): String? = runCatching {
        val u = URI(value.trim().takeIf { it.length <= 2048 } ?: return null)
        val host = u.host?.lowercase(Locale.ROOT) ?: return null
        if (u.scheme != "https" || u.userInfo != null || u.port !in setOf(-1, 443) || !host.contains('.') || kind !in links) return null
        val allowed = when (kind) {
            "instagram" -> setOf("instagram.com", "www.instagram.com")
            "facebook" -> setOf("facebook.com", "www.facebook.com", "m.facebook.com", "fb.com", "www.fb.com", "fb.me")
            "tiktok" -> setOf("tiktok.com", "www.tiktok.com", "vm.tiktok.com", "vt.tiktok.com")
            else -> null
        }
        u.toASCIIString().takeIf { allowed == null || host in allowed }
    }.getOrNull()
    fun read(fields: JSONObject): PlaceInfo {
        val profile = fields.optJSONObject("businessProfile")?.optJSONObject("mapValue")?.optJSONObject("fields") ?: JSONObject()
        val flags = profile.optJSONObject("amenities")?.optJSONObject("mapValue")?.optJSONObject("fields") ?: JSONObject()
        val values = profile.optJSONObject("paymentMethods")?.optJSONObject("arrayValue")?.optJSONArray("values") ?: JSONArray()
        return PlaceInfo(fields.text("hours").trim().take(500), fields.text("hoursEn").trim().take(500), fields.number("openHour"), fields.number("closeHour"),
            amenities.keys.filter { flags.optJSONObject(it)?.opt("booleanValue") == true },
            (0 until values.length()).mapNotNull { values.optJSONObject(it)?.optString("stringValue")?.takeIf(payments::containsKey) }.distinct(),
            profile.text("priceRange").takeIf { it.length in 1..4 && it.all { ch -> ch == '$' } }.orEmpty(),
            links.keys.mapNotNull { key -> url(key, profile.text(key))?.let { key to it } }.toMap())
    }
    fun alwaysOpen(info: PlaceInfo) = Regex("\\b24\\s*(?:/\\s*7|horas?|hours?|h)\\b", RegexOption.IGNORE_CASE).containsMatchIn("${info.hours} ${info.hoursEn}")
    fun publishedHours(info: PlaceInfo): String = info.hours.ifBlank { info.hoursEn }
    fun open(info: PlaceInfo, now: Long, fresh: Boolean = true): Boolean? {
        if (!fresh) return null
        if (alwaysOpen(info)) return true
        if (publishedHours(info).isNotBlank()) return null
        val start = hour(info.openHour) ?: return null
        val end = hour(info.closeHour) ?: return null
        val local = Instant.ofEpochMilli(now).atZone(zone)
        val current = local.hour + local.minute / 60.0
        return if (start > end) current >= start || current < end else current >= start && current < end
    }
    private fun clock(value: Double): String {
        val minute = kotlin.math.round(value * 60).toInt()
        return String.format(Locale.ROOT, "%02d:%02d", minute / 60, minute % 60)
    }
    fun range(info: PlaceInfo): String? = if (alwaysOpen(info)) "Atención 24 horas" else if (publishedHours(info).isNotBlank()) null else hour(info.openHour)?.let { start -> hour(info.closeHour)?.let { end -> "${clock(start)} – ${clock(end)}" } }
    fun cache(info: PlaceInfo): JSONObject = JSONObject().put("hours", info.hours).put("hoursEn", info.hoursEn).put("openHour", info.openHour ?: JSONObject.NULL).put("closeHour", info.closeHour ?: JSONObject.NULL)
        .put("amenities", JSONArray(info.amenities)).put("payments", JSONArray(info.payments)).put("priceRange", info.priceRange).put("links", JSONObject(info.links))
    fun cached(raw: JSONObject?): PlaceInfo {
        if (raw == null) return PlaceInfo()
        fun list(key: String, allowed: Set<String>): List<String> = raw.optJSONArray(key)?.let { a -> (0 until a.length()).mapNotNull { a.optString(it).takeIf(allowed::contains) }.distinct() } ?: emptyList()
        return PlaceInfo(raw.optString("hours").take(500), raw.optString("hoursEn").take(500), raw.optDouble("openHour").takeUnless { raw.isNull("openHour") }?.let(::hour), raw.optDouble("closeHour").takeUnless { raw.isNull("closeHour") }?.let(::hour),
            list("amenities", amenities.keys), list("payments", payments.keys), raw.optString("priceRange").takeIf { it.length in 1..4 && it.all { ch -> ch == '$' } }.orEmpty(),
            links.keys.mapNotNull { key -> url(key, raw.optJSONObject("links")?.optString(key).orEmpty())?.let { key to it } }.toMap())
    }
}
