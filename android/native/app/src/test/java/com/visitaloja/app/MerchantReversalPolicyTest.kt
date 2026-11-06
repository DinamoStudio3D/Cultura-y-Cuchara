package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test

class MerchantReversalPolicyTest {
    private val confirmedAt = 1_000_000L
    @Test fun closesExactlyAfterTheAllowedWindow() {
        assertTrue(MerchantScanPolicy.reversible("confirmed", confirmedAt, "staff", "staff", true, false, confirmedAt + 900_000))
        assertFalse(MerchantScanPolicy.reversible("confirmed", confirmedAt, "staff", "staff", true, false, confirmedAt + 900_001))
        assertFalse(MerchantScanPolicy.reversible("confirmed", confirmedAt, "staff", "staff", true, false, confirmedAt - 1))
    }
    @Test fun cannotUndoAnotherOperatorsVisitOrAnOlderVisit() {
        assertFalse(MerchantScanPolicy.reversible("confirmed", confirmedAt, "staff", "other", true, false, confirmedAt))
        assertFalse(MerchantScanPolicy.reversible("confirmed", confirmedAt, "staff", "staff", false, false, confirmedAt))
    }
    @Test fun alreadyReversedAndPassportClaimsAreProtected() {
        assertFalse(MerchantScanPolicy.reversible("reversed", confirmedAt, "staff", "staff", true, false, confirmedAt))
        assertFalse(MerchantScanPolicy.reversible("confirmed", confirmedAt, "staff", "staff", true, true, confirmedAt))
    }
    @Test fun reversalRequiresAValidIdAndReason() {
        val payload = MerchantScanPolicy.reversalPayload("2026-11-06_stop_123456", "  Código equivocado  ")
        assertEquals("Código equivocado", payload.getString("reversalReason"))
        for ((id, reason) in listOf("../visit" to "Motivo válido", "visit" to " no ", "visit" to "a".repeat(241))) {
            try { MerchantScanPolicy.reversalPayload(id, reason); fail() } catch (_: IllegalArgumentException) { }
        }
    }
}
