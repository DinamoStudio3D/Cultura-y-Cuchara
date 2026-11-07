package com.visitaloja.app

import java.time.Instant
import java.util.Locale

data class MissionBadge(val title: String, val description: String, val icon: String, val image: String?, val rarity: String)
data class LojaMission(val id: String, val title: String, val description: String, val type: String, val target: Int,
    val categories: List<String>, val places: List<String>, val cantons: List<String>, val badge: MissionBadge,
    val starts: Long?, val ends: Long?, val physical: Boolean)
data class MissionProgress(val missionId: String, val current: Int, val target: Int, val completed: Boolean, val updated: Long)
data class EarnedMissionBadge(val missionId: String, val badge: MissionBadge, val unlocked: Long?)
data class ExplorerProfile(val xp: Long, val places: Int, val cantons: Int, val joined: Boolean, val alias: String)
data class ExplorerLevel(val number: Int, val title: String, val fraction: Float, val remaining: Long, val maximum: Boolean)
data class ExplorerRank(val id: String, val alias: String, val xp: Long, val level: Int)

object MissionPolicy {
    val types = setOf("category_visits", "place_visits", "canton_visits", "unique_places", "total_visits")
    private val thresholds = listOf(0L,500L,1500L,3000L,5000L,8000L,12000L,20000L)
    private val levelTitles = listOf("Viajero Curioso", "Caminante de Loja", "Aventurero Lojano", "Explorador de Loja", "Conocedor de Loja", "Guardián de Loja", "Maestro Explorador", "Leyenda de Loja")
    private fun List<String>.lower() = map { it.trim().lowercase(Locale.ROOT) }
    private fun strings(raw: Map<String, Any?>, key: String): List<String> = (raw[key] as? List<*>)?.filterIsInstance<String>()?.map { it.trim().take(120) }?.filter { it.isNotEmpty() }?.distinct()?.take(100) ?: emptyList()
    private fun integer(value: Any?, max: Long): Long? = (value as? Number)?.toDouble()?.takeIf { it.isFinite() && it >= 0 && it <= max && it % 1.0 == 0.0 }?.toLong()
    private fun millis(value: Any?): Long? = when(value) { is Number -> value.toLong(); is String -> runCatching { Instant.parse(value).toEpochMilli() }.getOrNull(); else -> null }
    fun badge(raw: Map<String, Any?>): MissionBadge = MissionBadge(raw.text("title").trim().take(80).ifBlank { "Insignia" },raw.text("description").take(240),raw.text("icon").take(16).ifBlank { "🏅" },DiscoveryPolicy.media(raw.text("imageUrl")),raw.text("rarity").takeIf { it in setOf("common","uncommon","rare","epic","legendary") } ?: "common")
    fun mission(id: String, raw: Map<String, Any?>): LojaMission? {
        if (id.isBlank() || raw.text("status") != "active" || raw["active"] == false || raw["hidden"] == true) return null
        val title = raw.text("title").trim().take(100).takeIf(String::isNotBlank) ?: return null
        val type = raw.text("type").takeIf { it in types } ?: return null
        val target = integer(raw["targetCount"],500)?.toInt()?.takeIf { it >= 1 } ?: return null
        val categories = strings(raw,"categoryIds"); val places = strings(raw,"placeIds"); val cantons = strings(raw,"cantonIds")
        if ((type == "category_visits" && categories.isEmpty()) || (type == "place_visits" && places.isEmpty()) || (type == "canton_visits" && cantons.isEmpty())) return null
        val start = millis(raw["startsAt"]); val end = millis(raw["endsAt"])
        if ((raw["startsAt"] != null && start == null) || (raw["endsAt"] != null && end == null) || (start != null && end != null && start >= end)) return null
        return LojaMission(id,title,raw.text("description").take(500),type,target,categories,places,cantons,badge(raw.map("badge")),start,end,raw.text("rewardType")=="digital_physical")
    }
    fun window(mission: LojaMission, now: Long): String = when { mission.starts != null && now < mission.starts -> "upcoming"; mission.ends != null && now > mission.ends -> "ended"; else -> "available" }
    fun progress(raw: Map<String, Any?>, uid: String): MissionProgress? {
        if (uid.isBlank() || raw.text("userId") != uid) return null
        val id = raw.text("missionId").takeIf(String::isNotBlank) ?: return null
        val target = integer(raw["target"],500)?.toInt()?.takeIf { it >= 1 } ?: return null
        val count = integer(raw["current"],target.toLong())?.toInt() ?: return null
        return MissionProgress(id,count,target,raw["completed"] == true && count == target,millis(raw["updatedAt"]) ?: Long.MIN_VALUE)
    }
    fun progressIndex(rows: List<MissionProgress>): Map<String,MissionProgress> = rows.groupBy { it.missionId }.mapValues { (_, values) ->
        values.sortedWith(compareByDescending<MissionProgress> { it.updated }.thenBy { it.current }.thenBy { it.completed }).first()
    }
    fun reward(raw: Map<String, Any?>, uid: String): EarnedMissionBadge? {
        if (uid.isBlank() || raw.text("userId") != uid || raw.text("missionId").isBlank() || raw.text("source") != "chabaquito_mission_v2" || raw["revoked"] == true) return null
        return EarnedMissionBadge(raw.text("missionId"),badge(raw.map("badge")),millis(raw["unlockedAt"]))
    }
    fun profile(raw: Map<String, Any?>): ExplorerProfile = ExplorerProfile(integer(raw["validatedXp"],1_000_000_000) ?: 0, (integer(raw["discoveredPlaces"],1_000_000) ?: 0).toInt(),(integer(raw["discoveredCantons"],1_000_000) ?: 0).toInt(),raw["participateInRanking"]==true,raw.text("publicAlias").take(40))
    fun level(xp: Long): ExplorerLevel {
        val safe = xp.coerceAtLeast(0); val index = thresholds.indexOfLast { safe >= it }.coerceAtLeast(0)
        val next = thresholds.getOrNull(index+1)
        return ExplorerLevel(index+1,levelTitles[index],if(next==null) 1f else ((safe-thresholds[index]).toFloat()/(next-thresholds[index])).coerceIn(0f,1f),if(next==null) 0 else next-safe,next==null)
    }
    fun rank(id: String, raw: Map<String, Any?>): ExplorerRank? {
        val alias = raw.text("alias").trim().takeIf { validAlias(it) } ?: return null
        val xp = integer(raw["xp"],1_000_000_000) ?: return null
        return ExplorerRank(id,alias,xp,(integer(raw["level"],8)?.toInt()?.takeIf { it >= 1 }) ?: level(xp).number)
    }
    fun validAlias(value: String): Boolean = value.trim().isNotEmpty() && value.trim().length <= 40 && value.none { it == '<' || it == '>' || it.code < 32 }
    fun eligible(mission: LojaMission, places: List<Place>): List<Place> = places.filter { place ->
        PlacePolicy.published(place) && when(mission.type) {
            "place_visits" -> place.id in mission.places
            "category_visits" -> place.missionCategory?.lowercase(Locale.ROOT) in mission.categories.lower()
            "canton_visits" -> place.missionCanton?.lowercase(Locale.ROOT) in mission.cantons.lower()
            else -> true
        }
    }.distinctBy { it.id }.sortedBy { PlacePolicy.normalize(it.title) }
    fun unit(type: String): String = when(type) { "total_visits" -> "visitas confirmadas"; "canton_visits" -> "cantones distintos"; else -> "paradas distintas" }
    fun typeLabel(type: String): String = when(type) { "category_visits" -> "Sabores y experiencias"; "place_visits" -> "Paradas por descubrir"; "canton_visits" -> "Explora la provincia"; "unique_places" -> "Nuevos descubrimientos"; else -> "Cada visita cuenta" }
}
