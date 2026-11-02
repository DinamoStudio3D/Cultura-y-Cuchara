package com.visitaloja.app
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant
class MerchantScanPolicyTest {
    @Test fun acceptsOnlyActualVisitFormats() {
        assertEquals("123456", MerchantScanPolicy.code("VISITALOJA:123456"))
        assertEquals("012345", MerchantScanPolicy.code(" 012345 "))
        listOf("https://visitaloja.com/?code=123456", "PREMIO:123456", "VISITALOJA:12345", "1234567", "visitaloja:123456", "１２３４５６", "VISITALOJA:123456\nother").forEach { assertNull(it, MerchantScanPolicy.code(it)) }
        assertNull(MerchantScanPolicy.code(null))
        assertNull(MerchantScanPolicy.scanned("123456"))
        assertEquals("123456", MerchantScanPolicy.scanned("VISITALOJA:123456"))
    }
    @Test fun codeIdMatchesExistingEcuadorDayAcrossUtcMidnight() {
        val time = Instant.parse("2026-11-02T02:00:00Z").toEpochMilli()
        assertEquals("2026-11-01_loc_123_012345", MerchantScanPolicy.requestId("loc_123", "012345", time))
        assertFalse(MerchantScanPolicy.placeId("../another"))
    }
    @Test fun expiredProcessedAndUnassignedRequestsCannotConfirm() {
        assertTrue(MerchantScanPolicy.confirmable("pending", 101, true, 100))
        assertFalse(MerchantScanPolicy.confirmable("pending", 100, true, 100))
        assertFalse(MerchantScanPolicy.confirmable("pending", 101, false, 100))
        listOf("confirmed", "reversed", "review", "rejected", "").forEach { assertFalse(MerchantScanPolicy.confirmable(it, 101, true, 100)) }
    }
    @Test fun purchaseRequiresActualAmountAndNormalizesDecimalComma() {
        assertEquals(2.35, MerchantScanPolicy.consumption(false,"purchase","2,35",""," note ").getDouble("purchaseAmount"),0.0)
        listOf("", "0", "-1", "2.345", "100000.01", "NaN", "Infinity").forEach { amount ->
            try { MerchantScanPolicy.consumption(false,"purchase",amount,"",""); fail(amount) } catch (_: IllegalArgumentException) { }
        }
    }
    @Test fun courtesyRequiresReasonAndTourismCannotBypassPurchase() {
        assertEquals(0.0,MerchantScanPolicy.consumption(false,"courtesy","","Invitado del negocio","").getDouble("purchaseAmount"),0.0)
        assertEquals("tourism",MerchantScanPolicy.consumption(true,"tourism","","","").getString("recordKind"))
        listOf(Triple(false,"tourism",""),Triple(true,"purchase",""),Triple(false,"courtesy","no")).forEach { (tourist,kind,reason) ->
            try { MerchantScanPolicy.consumption(tourist,kind,"1",reason,"");fail() } catch (_: IllegalArgumentException) { }
        }
    }
    @Test fun unknownNetworkOutcomeDemandsRecoveryRatherThanAnotherStamp() {
        assertTrue(MerchantScanPolicy.error("timeout").contains("mismo código"))
        assertTrue(MerchantScanPolicy.error("Daily visit limit reached").contains("mañana"))
        assertTrue(MerchantScanPolicy.error("Visit code is not pending").contains("ya fue procesada"))
    }
}
