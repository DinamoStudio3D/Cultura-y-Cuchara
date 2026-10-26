package com.visitaloja.app

import java.time.Instant

internal fun Map<String, Any?>.text(key: String) = this[key] as? String ?: ""
internal fun Map<String, Any?>.map(key: String): Map<String, Any?> = (this[key] as? Map<*, *>)?.entries?.associate { it.key.toString() to it.value } ?: emptyMap()
internal fun Map<String, Any?>.count(key: String) = ((this[key] as? Number)?.toLong() ?: 0).coerceIn(0, 1000000).toInt()
internal fun timeMillis(value: Any?): Long? = when (value) { is Number -> value.toLong(); is String -> try { Instant.parse(value).toEpochMilli() } catch (_: Exception) { null }; else -> null }

data class LoyaltyCard(val id: String, val placeId: String, val placeName: String, val title: String, val visits: Int,
    val target: Int, val reward: String, val description: String, val state: String, val dailyBlocked: Boolean) {
    val progress get() = if (visits > 0 && visits % target == 0) target else visits % target
}
data class PassportProgress(val slots: List<Place?>, val campaignId: String, val active: Boolean, val title: String,
    val description: String, val rewards: List<Pair<String, String>>) { val count get() = slots.count { it != null } }

object WalletPolicy {
    private val food = setOf("hueca", "cafe", "urbana", "heladeria", "panaderia", "bar")
    fun passport(config: Map<String, Any?>, stamps: List<Map<String, Any?>>, places: List<Place>, mode: String, now: Long): PassportProgress {
        val campaign = config.text("campaignId").ifBlank { "pasaporte-2026" }
        val ids = stamps.filter { it.text("campaignId") == campaign }.map { it.text("placeId") }.toSet()
        val visited = places.filter { it.id in ids && PlacePolicy.published(it) }
        val meals = visited.filter { it.categories.firstOrNull() in food }
        val hotels = visited.filter { it.categories.firstOrNull() == "hotel" }
        val slots = if (mode == "turista") listOf(hotels.firstOrNull()) + (0..4).map { meals.getOrNull(it) } else (0..5).map { meals.getOrNull(it) }
        val benefit = config.map(if (mode == "turista") "tourist" else "local")
        val active = config["active"] != false && (config["startAt"].let(::timeMillis)?.let { now >= it } ?: true) &&
            (config["endAt"].let(::timeMillis)?.let { now <= it } ?: true)
        val choices = benefit.map("choices").values.mapNotNull { value ->
            val reward = (value as? Map<*, *>) ?: return@mapNotNull null
            if (reward["active"] != true) null else (reward["title"] as? String ?: "Recompensa") to (reward["description"] as? String ?: "")
        }
        return PassportProgress(slots, campaign, active, config.text("campaignName").ifBlank { "Tu pasaporte de Loja" },
            config.text("introText"), if (benefit["active"] == false) emptyList() else if (benefit["choices"] is Map<*, *>) choices else run {
                benefit.text("title").takeIf { it.isNotBlank() }?.let { listOf(it to benefit.text("description")) } ?: emptyList()
            })
    }

    fun cards(programs: List<Map<String, Any?>>, counters: List<Map<String, Any?>>, places: List<Place>, now: Long, today: String): List<LoyaltyCard> {
        val byId = counters.associateBy { it.text("placeId") }
        return programs.flatMap { base ->
            if (base["active"] == false || base["enabled"] == false || base.text("status") !in setOf("", "active", "activo", "published", "publicado")) return@flatMap emptyList()
            val id = base.text("placeId").ifBlank { base.text("localId") }.ifBlank { base.text("businessId") }.ifBlank { base.text("id") }
            val place = places.find { it.id == id && PlacePolicy.published(it) } ?: return@flatMap emptyList()
            val counter = byId[id] ?: emptyMap()
            val seasons = (base["seasons"] as? List<*>)?.mapNotNull { (it as? Map<*, *>)?.entries?.associate { it.key.toString() to it.value } } ?: emptyList()
            val season = seasons.firstOrNull { it["active"] == true && (timeMillis(it["startAt"])?.let { now >= it } == true) && (timeMillis(it["endAt"])?.let { now < it } == true) }
            val history = counter.map("seasonalCards")
            val blocked = counter.text("lastVisitDay") == today && counter.count("dailyVisitCount") >= 1
            fun card(policy: Map<String, Any?>, progress: Map<String, Any?>, cardId: String, label: String, state: String) = LoyaltyCard(
                "$id:$cardId", id, place.title, label, progress.count("visitCount"), policy.count("targetVisits").coerceAtLeast(10),
                policy.text("rewardTitle").ifBlank { "Beneficio de fidelidad" }, policy.text("rewardDescription"), state, blocked)
            val result = mutableListOf<LoyaltyCard>()
            if (season != null) {
                val progress = history.map(season.text("id"))
                result += card(progress.map("policy").ifEmpty { season }, progress, season.text("id"), season.text("title"), "Temporada activa")
            }
            result += card(base + counter.map("permanentPolicy"), counter, "permanent", "Tarjeta habitual", if (season == null) "Activa" else "En pausa durante la temporada")
            for ((key, value) in history) {
                val progress = (value as? Map<*, *>)?.entries?.associate { it.key.toString() to it.value } ?: continue
                if (key == season?.text("id")) continue
                val policy = progress.map("policy")
                if (policy.isNotEmpty()) result += card(policy, progress, key, policy.text("title"), "Temporada finalizada")
            }
            result
        }.sortedWith(compareByDescending<LoyaltyCard> { it.visits > 0 }.thenBy { it.placeName })
    }
}
