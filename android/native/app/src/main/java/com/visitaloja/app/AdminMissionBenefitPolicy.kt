package com.visitaloja.app

import java.time.Instant

internal object AdminMissionBenefitPolicy {
    fun id(value: String): String = value.takeIf { it.matches(Regex("[A-Za-z0-9_-]{3,60}")) } ?: error("Identificador de campaña incompatible. Revísalo en la web.")
    fun counter(value: Any?): Long {
        if (value == null) return 0
        return requireNotNull((value as? Number)?.toDouble()?.takeIf { it.isFinite() && it >= 0 && it % 1.0 == 0.0 && it < Long.MAX_VALUE.toDouble() }?.toLong()) { "El contador de códigos es incompatible. Revísalo antes de editar." }
    }
    fun version(raw: Map<String, Any?>?) = raw?.filterKeys { it !in setOf("issuedCount", "updatedAt") }
    fun validate(draft: Map<String, String>, initial: Map<String, String>) {
        require(draft["n|benefit|campaignId"] == initial["n|benefit|campaignId"]) { "Este editor conserva la campaña actual. Actualiza antes de recuperar un borrador de otra campaña." }
        id(draft["n|benefit|campaignId"].orEmpty())
        val active = draft["n|benefit|active"] == "true"
        if (active) require(draft["n|benefit|title"].orEmpty().isNotBlank() && draft["n|benefit|description"].orEmpty().isNotBlank()) { "Completa el premio y sus instrucciones antes de activar." }
        val start = AdminMissionPolicy.date(draft["n|benefit|startAt"].orEmpty()); val end = AdminMissionPolicy.date(draft["n|benefit|endAt"].orEmpty())
        require(start == null || end == null || Instant.parse(end).isAfter(Instant.parse(start))) { "El fin debe ser posterior al inicio." }
    }
    fun campaign(benefit: Map<String, Any?>, current: Map<String, Any?>, countedClaims: Int): Map<String, Any?> {
        val issued = maxOf(counter(current["issuedCount"]), countedClaims.toLong())
        val stock = counter(benefit["stock"]); require(stock in 1..10000) { "El cupo total debe estar entre 1 y 10000." }
        require(benefit["active"] != true || stock >= issued) { "Ya hay $issued códigos emitidos. El cupo de una campaña activa no puede ser menor." }
        return mapOf("campaignId" to id(benefit.text("campaignId")), "active" to (benefit["active"] == true), "stock" to stock, "issuedCount" to issued,
            "startAt" to benefit.text("startAt"), "endAt" to benefit.text("endAt"), "rewardTitle" to benefit.text("title").ifBlank { "Beneficio de Explorador" }, "sponsorName" to benefit.text("sponsorName"))
    }
}
