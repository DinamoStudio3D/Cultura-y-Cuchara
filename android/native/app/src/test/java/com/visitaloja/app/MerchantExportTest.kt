package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class MerchantExportTest {
    private val now = Instant.parse("2026-11-07T02:00:00Z").toEpochMilli()
    @Test fun exportProtectsContactAndSpreadsheetCellsAndKeepsLojaTime() {
        val csv = MerchantExport.csv("visits", "Local", listOf(mapOf("userName" to "  =SUM(1)", "userEmail" to "cliente@example.com", "status" to "reversed", "confirmedAt" to now, "purchaseAmount" to 2.5, "receiptRef" to "A,\"B\"", "reversalReason" to "Corrección\nmanual")), now)
        assertTrue(csv.startsWith("\uFEFF"))
        assertFalse(csv.contains("cliente@example.com"))
        assertTrue(csv.contains("cl***@example.com"))
        assertTrue(csv.contains("\"'  =SUM(1)\""))
        assertTrue(csv.contains("2026-11-06 21:00:00"))
        assertTrue(csv.contains("\"A,\"\"B\"\"\""))
        assertTrue(csv.contains("\"Anulada\""))
    }
    @Test fun monthlyFilterStartsAtLocalMidnightAndExcludesFuture() {
        fun row(moment: String) = mapOf("confirmedAt" to Instant.parse(moment).toEpochMilli())
        assertTrue(MerchantBusinessPolicy.visitMatches(row("2026-11-01T05:00:00Z"), null, "month", now))
        assertFalse(MerchantBusinessPolicy.visitMatches(row("2026-11-01T04:59:59Z"), null, "month", now))
        assertFalse(MerchantBusinessPolicy.visitMatches(mapOf("confirmedAt" to now + 1), null, "month", now))
    }
}
