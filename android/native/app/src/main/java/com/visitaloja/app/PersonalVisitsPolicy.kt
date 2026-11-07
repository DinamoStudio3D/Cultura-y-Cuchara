package com.visitaloja.app

internal object PersonalVisitsPolicy {
    fun filter(rows: List<Map<String, Any?>>, query: String, status: String?, period: String, now: Long): List<Map<String, Any?>> {
        val words = PlacePolicy.normalize(query).trim().split(Regex("\\s+")).filter(String::isNotBlank)
        return rows.filter { row -> MerchantBusinessPolicy.visitMatches(row, status, period, now) &&
            words.all { it in PlacePolicy.normalize("${row.text("placeName")} ${row.text("receiptRef")} ${row.text("reversalReason")}") }
        }.sortedByDescending { MerchantBusinessPolicy.visitMoment(it) ?: 0 }
    }
    fun confirmedSpend(rows: List<Map<String, Any?>>): Double = rows.filter { it.text("status") == "confirmed" }.sumOf { MerchantBusinessPolicy.amount(it["purchaseAmount"]) }
}
