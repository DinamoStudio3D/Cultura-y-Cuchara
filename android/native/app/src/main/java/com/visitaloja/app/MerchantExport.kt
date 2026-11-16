package com.visitaloja.app

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/** Exports only the visible, authorized rows; never implies a complete server export. */
object MerchantExport {
    private val date = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(ZoneId.of("America/Guayaquil"))
    private fun stamp(value: Any?) = timeMillis(value)?.let { date.format(Instant.ofEpochMilli(it)) }.orEmpty()
    private fun cell(value: String): String {
        val safe = if (value.trimStart().firstOrNull() in setOf('=', '+', '-', '@')) "'$value" else value
        return "\"${safe.replace("\"", "\"\"")}\""
    }
    fun csv(tab: String, place: String, rows: List<Map<String, Any?>>, now: Long): String {
        val common = listOf("Parada", "Cliente", "Correo protegido")
        val columns = common + when (tab) {
            "clients" -> listOf("Visitas acumuladas", "Consumo acumulado USD", "Última visita (Loja)")
            "visits" -> listOf("Estado", "Sellado (Loja)", "Consumo registrado USD", "Comprobante", "Pasaporte", "Anulación (Loja)", "Motivo de anulación")
            else -> listOf("Premio", "Código de canje", "Estado", "Creado (Loja)", "Vence (Loja)", "Entregado (Loja)")
        }
        val lines = rows.map { row ->
            val base = listOf(place, row.text("userName"), MerchantBusinessPolicy.maskedEmail(row.text("userEmail")))
            base + when (tab) {
                "clients" -> listOf(row.count("visitCount").toString(), MerchantBusinessPolicy.amount(row["totalSpend"]).toString(), stamp(row["lastVisitAt"]))
                "visits" -> listOf(when (row.text("status")) { "confirmed" -> "Confirmada"; "reversed" -> "Anulada"; else -> "Sin confirmar" }, stamp(row["confirmedAt"]), MerchantBusinessPolicy.amount(row["purchaseAmount"]).toString(), row.text("receiptRef"), if (row["passportAdded"] == true) "Sí" else "No", stamp(row["reversedAt"]), row.text("reversalReason"))
                else -> listOf(MerchantBusinessPolicy.rewardTitle(row), row.text("claimCode"), MerchantBusinessPolicy.rewardStatus(row, now), stamp(row["createdAt"]), stamp(row["expiresAt"]), stamp(row["deliveredAt"]))
            }
        }
        return "\uFEFF" + (listOf(columns) + lines).joinToString("\r\n") { it.joinToString(",", transform = ::cell) }
    }
}
