package com.visitaloja.app

import java.time.Instant
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter

internal data class AdminLoyaltyTerms(
    val target: String = "10", val daily: String = "1", val reward: String = "",
    val description: String = "", val type: String = "product", val days: String = "30", val stock: String = ""
)
internal data class AdminLoyaltySeason(
    val id: String, val title: String = "", val active: Boolean = false, val start: String = "",
    val end: String = "", val terms: AdminLoyaltyTerms = AdminLoyaltyTerms()
)
internal data class AdminLoyaltyDraft(
    val active: Boolean = true, val terms: AdminLoyaltyTerms = AdminLoyaltyTerms(),
    val seasons: List<AdminLoyaltySeason> = emptyList()
)

internal object AdminLoyaltyPolicy {
    private val dateFormat = DateTimeFormatter.ofPattern("uuuu-MM-dd'T'HH:mm:ss")
    private fun terms(raw: Map<String, Any?>) = AdminLoyaltyTerms(
        raw["targetVisits"]?.toString() ?: "10", raw["maxVisitsPerDay"]?.toString() ?: "1",
        raw.text("rewardTitle"), raw.text("rewardDescription"), raw.text("rewardType").ifBlank { "product" },
        raw["rewardValidityDays"]?.toString() ?: "30", raw["stock"]?.toString().orEmpty()
    )
    private fun local(value: Any?): String {
        require(value is String) { "Revisa las fechas de temporada en la web." }
        return OffsetDateTime.parse(value).atZoneSameInstant(AgendaPolicy.zone).toLocalDateTime().format(dateFormat)
    }
    private fun instant(value: String): Instant {
        require(value.matches(Regex("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}(:\\d{2})?"))) { "Usa fechas como 2026-12-01T09:00, en hora de Ecuador." }
        val date = LocalDateTime.parse(value)
        require(date.year in 2000..9999) { "Revisa el año de la temporada." }
        return date.atZone(AgendaPolicy.zone).toInstant()
    }
    private fun rawSeasons(raw: Map<String, Any?>): List<Map<String, Any?>> {
        val items = raw["seasons"] ?: return emptyList()
        require(items is List<*> && items.size <= 24) { "Configura hasta 24 temporadas. Revisa el programa en la web." }
        return items.map { value ->
            require(value is Map<*, *> && value.keys.all { it is String }) { "Hay una temporada con formato no compatible." }
            value.entries.associate { it.key.toString() to it.value }
        }
    }
    fun read(raw: Map<String, Any?>): AdminLoyaltyDraft {
        val seasons = rawSeasons(raw).map { row ->
            AdminLoyaltySeason(row.text("id"), row.text("title"), row["active"] == true,
                local(row["startAt"]), local(row["endAt"]), terms(row))
        }
        require(seasons.map { it.id }.distinct().size == seasons.size &&
            seasons.all { it.id.matches(Regex("[A-Za-z0-9_-]{1,60}")) }) { "Revisa los identificadores de temporada en la web." }
        return AdminLoyaltyDraft(raw["active"] != false, terms(raw), seasons)
    }
    private fun count(value: Any?): Long {
        if (value == null) return 0
        require(value is Number && value.toDouble().isFinite() && value.toDouble() >= 0 &&
            value.toDouble() == value.toLong().toDouble()) { "El registro de premios necesita revisión." }
        return value.toLong()
    }
    fun issued(raw: Map<String, Any?>, id: String? = null): Long =
        count(if (id == null) raw["claimedCount"] else raw.map("seasonClaimedCounts")[id])
    fun locked(raw: Map<String, Any?>, id: String) =
        raw.map("seasonUsage")[id] == true || issued(raw, id) > 0
    private fun integer(text: String, min: Long, max: Long, label: String): Long {
        val value = text.toLongOrNull()
        require(value != null && value in min..max) { "Revisa " + label + "." }
        return value
    }
    private fun fields(terms: AdminLoyaltyTerms, seasonal: Boolean): Map<String, Any?> {
        require(terms.reward.trim().length in 1..100 && terms.description.length <= 400) { "Completa el beneficio y sus condiciones." }
        require(terms.type in setOf("product", "discount", "surprise")) { "Elige un tipo de beneficio." }
        return mapOf("targetVisits" to integer(terms.target, 10, 30, "la meta (10–30 sellos)"),
            "maxVisitsPerDay" to integer(terms.daily, 1, 3, "el límite diario (1–3)"),
            "rewardTitle" to terms.reward.trim(), "rewardDescription" to terms.description.trim(),
            "rewardType" to terms.type, "rewardValidityDays" to integer(terms.days, 1, 365, "la vigencia (1–365 días)"),
            "stock" to if (terms.stock.isBlank()) null else integer(terms.stock, 0,
                if (seasonal) 1000000 else 9007199254740991, "los cupos"))
    }
    private fun season(season: AdminLoyaltySeason): Map<String, Any?> {
        require(season.id.matches(Regex("[A-Za-z0-9_-]{1,60}")) && season.title.trim().length in 1..100) { "Completa el nombre de la temporada." }
        val start = instant(season.start)
        val end = instant(season.end)
        require(end > start) { "El fin debe ser posterior al inicio." }
        return fields(season.terms, true) + mapOf("id" to season.id, "title" to season.title.trim(),
            "active" to season.active, "startAt" to start.toString(), "endAt" to end.toString())
    }
    fun patch(raw: Map<String, Any?>, draft: AdminLoyaltyDraft, seasonalService: Boolean): Map<String, Any?> {
        val before = read(raw)
        val normal = fields(draft.terms, false)
        val normalStock = normal["stock"] as? Long
        require(normalStock == null || normalStock >= issued(raw)) { "Los cupos no pueden ser menores que los premios habituales emitidos." }
        val result = normal + ("active" to draft.active)
        if (draft.seasons == before.seasons) return result
        require(seasonalService) { "Comprueba primero que el servicio admite temporadas." }
        require(draft.seasons.size <= 24 && draft.seasons.map { it.id }.distinct().size == draft.seasons.size) { "Usa hasta 24 temporadas con identificadores únicos." }
        val original = rawSeasons(raw).associateBy { it.text("id") }
        val next = draft.seasons.map { candidate ->
            val previous = before.seasons.firstOrNull { it.id == candidate.id }
            val normalized = season(candidate)
            val stock = normalized["stock"] as? Long
            require(stock == null || stock >= issued(raw, candidate.id)) { "Los cupos de temporada no pueden ser menores que los premios emitidos." }
            if (candidate == previous) original.getValue(candidate.id)
            else if (locked(raw, candidate.id)) {
                require(previous != null) { "La temporada usada necesita revisión." }
                require(normalized - "stock" == season(previous) - "stock") { "Esta temporada ya tiene sellos. Conserva sus condiciones y crea otra." }
                original.getValue(candidate.id) + ("stock" to stock)
            } else original[candidate.id].orEmpty() + normalized
        }
        before.seasons.filter { locked(raw, it.id) }.forEach { old ->
            require(draft.seasons.any { it.id == old.id }) { "No puedes quitar una temporada que ya tiene sellos." }
        }
        val enabled = next.filter { it["active"] == true }.sortedBy { OffsetDateTime.parse(it.text("startAt")).toInstant() }
        enabled.zipWithNext().forEach { (a, b) ->
            require(OffsetDateTime.parse(b.text("startAt")).toInstant() >= OffsetDateTime.parse(a.text("endAt")).toInstant()) {
                "Las temporadas activas no pueden coincidir."
            }
        }
        return result + ("seasons" to next)
    }
}
