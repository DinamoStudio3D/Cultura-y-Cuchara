package com.visitaloja.app

internal data class WalletReward(val row: Map<String, Any?>, val passport: Boolean) {
    val key: String get() = (if (passport) "passport:" else "loyalty:") + row.text("id")
    val title: String get() = row.text("rewardTitle").ifBlank { row.map("rewardSnapshot").text("title").ifBlank { "Tu recompensa" } }
}
internal object WalletRewardPolicy {
    fun status(reward: WalletReward, now: Long): String = when {
        reward.row.text("status") == "delivered" -> "delivered"
        reward.row.text("status") == "expired" -> "expired"
        reward.row.text("status") != "pending" -> "unavailable"
        timeMillis(reward.row["expiresAt"])?.let { it <= now } ?: !reward.passport -> "expired"
        else -> "pending"
    }
    fun label(status: String): String = when(status) {
        "delivered" -> "Entregada"; "expired" -> "Vencida"; "pending" -> "Pendiente de canje"; else -> "No disponible"
    }
    fun filter(rewards: List<WalletReward>, query: String, type: String, statusFilter: String, now: Long): List<WalletReward> {
        val words = PlacePolicy.normalize(query).trim().split(Regex("\\s+")).filter(String::isNotBlank)
        return rewards.filter { reward ->
            (type == "all" || (type == "passport") == reward.passport) &&
                (statusFilter == "all" || status(reward, now) == statusFilter) &&
                words.all { it in PlacePolicy.normalize("${reward.title} ${reward.row.text("placeName")} ${reward.row.text("campaignId")}") }
        }.sortedWith(compareBy<WalletReward> { if (status(it, now) == "pending") 0 else 1 }
            .thenBy { if (status(it, now) == "pending") timeMillis(it.row["expiresAt"]) ?: Long.MAX_VALUE else Long.MAX_VALUE }
            .thenByDescending { timeMillis(it.row["createdAt"]) ?: 0 })
    }
}
