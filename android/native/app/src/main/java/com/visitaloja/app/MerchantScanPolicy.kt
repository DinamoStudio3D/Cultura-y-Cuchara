package com.visitaloja.app

import org.json.JSONObject
import java.math.BigDecimal
import java.time.Instant
import java.time.ZoneId

object MerchantScanPolicy {
    fun initialPlace(allowed: List<String>, preferred: String?): String =
        if (preferred != null) preferred.takeIf { it in allowed }.orEmpty()
        else allowed.singleOrNull().orEmpty()


    const val ENDPOINT = "https://visitaloja-chabaquito.sukogames1996.workers.dev/merchant-confirm-visit"
    const val REVERSE_ENDPOINT = "https://visitaloja-chabaquito.sukogames1996.workers.dev/merchant-reverse-visit"
    const val REVERSE_WINDOW_MS = 15 * 60 * 1000L
    fun reversible(status: String, confirmedAt: Long, confirmedBy: String, uid: String,
        lastVisit: Boolean, hasPassportClaim: Boolean, now: Long): Boolean =
        status == "confirmed" && uid.isNotBlank() && confirmedBy == uid && lastVisit && !hasPassportClaim &&
            confirmedAt > 0 && now >= confirmedAt && now - confirmedAt <= REVERSE_WINDOW_MS

    fun reversalPayload(requestId: String, reason: String): JSONObject {
        require(requestId.matches(Regex("[A-Za-z0-9_-]{1,128}"))) { "No se pudo identificar la visita." }
        val text = reason.trim()
        require(text.length in 5..240) { "Escribe un motivo de entre 5 y 240 caracteres." }
        return JSONObject().put("requestId", requestId).put("reversalReason", text)
    }

    fun reversalError(raw: String): String = when {
        raw.contains("deadline", true) -> "Terminó el plazo de 15 minutos para deshacer este sello."
        raw.contains("most recent", true) -> "Solo se puede deshacer el último sello del visitante en esta parada."
        raw.contains("confirming merchant", true) || raw.contains("not authorized", true) || raw.contains("cannot reverse this place", true) -> "Esta cuenta no puede anular la visita."
        raw.contains("recompensa del pasaporte", true) || raw.contains("requires review", true) -> "Este sello tiene un beneficio asociado que requiere revisión del administrador."
        else -> "No se pudo comprobar el resultado. Consulta el mismo código antes de volver a intentar."
    }
    fun code(raw: String?): String? {
        val value = raw?.trim()?.takeIf { it.length <= 64 } ?: return null
        return value.removePrefix("VISITALOJA:").takeIf { it.matches(Regex("[0-9]{6}")) }
    }
    fun scanned(raw: String?): String? = raw?.trim()?.takeIf { it.startsWith("VISITALOJA:") }?.let(::code)
    fun placeId(value: String) = value.matches(Regex("[A-Za-z0-9_-]{1,180}"))
    fun day(now: Long) = Instant.ofEpochMilli(now).atZone(ZoneId.of("America/Guayaquil")).toLocalDate().toString()
    fun requestId(place: String, code: String, now: Long): String {
        require(placeId(place) && code.matches(Regex("[0-9]{6}")))
        return "${day(now)}_${place}_$code"
    }
    fun confirmable(status: String, expires: Long, assigned: Boolean, now: Long) = assigned && status == "pending" && expires > now
    fun consumption(tourist: Boolean, kind: String, amount: String, reason: String, receipt: String): JSONObject {
        require(kind in setOf("purchase", "courtesy", "tourism")) { "Selecciona el tipo de registro." }
        require((kind == "tourism") == tourist) { "Revisa el tipo de registro para esta parada." }
        val ref = receipt.trim(); require(ref.length <= 80) { "El comprobante admite hasta 80 caracteres." }
        val total = if (kind == "purchase") {
            val parsed = amount.trim().replace(',', '.').toBigDecimalOrNull()
            require(parsed != null && parsed > BigDecimal.ZERO && parsed <= BigDecimal("100000") && parsed.stripTrailingZeros().scale() <= 2) { "Indica un consumo mayor a cero y con máximo dos decimales." }
            parsed.toDouble()
        } else 0.0
        val why = if (kind == "courtesy") reason.trim().also { require(it.length in 5..240) { "Escribe el motivo de cortesía (5 a 240 caracteres)." } } else ""
        return JSONObject().put("recordKind", kind).put("purchaseAmount", total).put("consumptionReason", why).put("receiptRef", ref).put("consumptionPolicyVersion", 1)
    }
    fun error(raw: String): String = when {
        raw.contains("Daily visit limit", true) -> "Regresa mañana para volver a sellar esta tarjeta de fidelidad."
        raw.contains("not pending", true) || raw.contains("already registered", true) -> "Esta visita ya fue procesada. Consulta de nuevo el mismo código para comprobar su estado."
        raw.contains("expired", true) -> "El código venció. Pide al visitante generar otro."
        raw.contains("not authorized", true) || raw.contains("cannot confirm", true) -> "Tu cuenta ya no está autorizada para sellar esta parada."
        raw.contains("not found", true) -> "No encontramos este código de visita."
        raw.contains("consumo", true) || raw.contains("cortesía", true) || raw.contains("turística", true) -> raw.take(250)
        else -> "No se pudo confirmar el resultado. Consulta de nuevo el mismo código antes de intentar otro sello."
    }
}
