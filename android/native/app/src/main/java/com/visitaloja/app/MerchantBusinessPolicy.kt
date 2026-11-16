package com.visitaloja.app

import java.time.Instant
import java.time.ZoneId
import java.util.Locale

object MerchantBusinessPolicy {
    private val zone = ZoneId.of("America/Guayaquil")
    private fun normalized(value: String): String = when (val key = value.trim().lowercase(Locale.ROOT)) {
        "gratis" -> "free"; "impulso", "emprendo" -> "impulse"; "destacado", "pro", "activo" -> "featured"; else -> key
    }
    fun months(place: Map<String, Any?>, settings: Map<String, Any?>, now: Long): Int {
        val sub = place.map("subscription")
        if (sub.text("status").ifBlank { "active" }.lowercase(Locale.ROOT) !in setOf("active", "trial")) return 0
        fun stamp(value: Any?, end: Boolean): Long? = timeMillis(value) ?: (value as? String)?.let {
            runCatching {
                val day = java.time.LocalDate.parse(it).atStartOfDay(zone)
                (if (end) day.plusDays(1).minusNanos(1) else day).toInstant().toEpochMilli()
            }.getOrNull()
        }
        fun configured(primary: String, legacy: String) = listOf(sub[primary], sub[legacy]).firstOrNull { it != null && !(it is String && it.isBlank()) }
        val start = configured("startAt", "startDate"); val end = configured("endAt", "endDate")
        if (start != null && (stamp(start, false)?.let { it > now } != false)) return 0
        if (end != null && (stamp(end, true)?.let { it < now } != false)) return 0
        val raw = sub.text("plan").ifBlank { sub.text("planId") }.ifBlank { sub.text("id") }
        val id = normalized(raw)
        if (id in setOf("", "free")) return 0
        val default = when(id) { "impulse" -> 1; "featured" -> 3; "premium" -> 12; else -> 1 }
        val plans = (settings["plans"] as? List<*>)?.mapNotNull { (it as? Map<*, *>)?.entries?.associate { x -> x.key.toString() to x.value } }.orEmpty()
        val plan = plans.firstOrNull { p -> listOf("id","key","slug","code","name").any { normalized(p.text(it)) == id } } ?: return default
        if (plan["active"] == false) return 0
        // Same in-memory legacy offer upgrade as plan-offer.js.
        if (id in setOf("impulse","featured","premium") && plan.count("offerVersion") < 1) return default
        val features = plan.map("features")
        val period = features["analyticsPeriodMonths"] ?: features["statsPeriodMonths"] ?: plan["analyticsPeriodMonths"] ?: plan["statsPeriodMonths"]
        return ((period as? Number)?.toInt() ?: (period as? String)?.toIntOrNull() ?: default).coerceIn(0,36)
    }
    fun cutoff(now: Long, months: Int): Long = Instant.ofEpochMilli(now).atZone(zone).minusMonths(months.toLong()).toInstant().toEpochMilli()
    fun inPeriod(row: Map<String, Any?>, tab: String, cutoff: Long): Boolean = tab == "clients" ||
        (if (tab == "rewards") rewardMoment(row) else timeMillis(row["confirmedAt"]) ?: timeMillis(row["reversedAt"]))?.let { it >= cutoff } == true
    fun rewardMoment(row: Map<String, Any?>): Long? =
        (if (row.text("status") == "delivered") timeMillis(row["deliveredAt"]) else null) ?: timeMillis(row["createdAt"])
    fun rewardTitle(row: Map<String, Any?>): String = row.text("rewardTitle").ifBlank { row.map("rewardSnapshot").text("title") }.ifBlank { "Beneficio de fidelidad" }
    fun matchesSearch(row: Map<String, Any?>, query: String): Boolean {
        val key = PlacePolicy.normalize(query.trim())
        return key.isBlank() || listOf(row.text("userName"), maskedEmail(row.text("userEmail")), row.text("rewardTitle").ifBlank { row.map("rewardSnapshot").text("title") }, row.text("claimCode"), row.text("receiptRef"))
            .any { key in PlacePolicy.normalize(it) }
    }
    fun visitMoment(row: Map<String, Any?>): Long? =
        timeMillis(row["confirmedAt"]) ?: timeMillis(row["createdAt"])

    fun visitMatches(row: Map<String, Any?>, status: String?, period: String, now: Long): Boolean {
        if (status != null && row.text("status") != status) return false
        if (period == "all") return true
        val moment = visitMoment(row) ?: return false
        val today = Instant.ofEpochMilli(now).atZone(zone).toLocalDate()
        val start = (when (period) { "week" -> today.minusDays(6); "month" -> today.withDayOfMonth(1); else -> today }).atStartOfDay(zone).toInstant().toEpochMilli()
        return moment in start..now
    }

    fun amount(value: Any?): Double = (value as? Number)?.toDouble()?.takeIf { it.isFinite() && it >= 0 } ?: 0.0
    fun maskedEmail(raw: String): String = raw.split('@').takeIf { it.size == 2 && it.all(String::isNotBlank) }?.let { it[0].take(2) + "***@" + it[1] }.orEmpty()
    fun rewardStatus(row: Map<String, Any?>, now: Long): String = when {
        row.text("status") == "delivered" -> "Entregada"
        row.text("status") in setOf("cancelled","reversed","rejected","void") -> "Anulada"
        row.text("status") == "expired" || timeMillis(row["expiresAt"])?.let { it <= now } == true -> "Vencida"
        else -> "Pendiente"
    }
}
