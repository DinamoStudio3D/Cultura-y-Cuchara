package com.visitaloja.app

import java.time.Instant
import org.junit.Assert.*
import org.junit.Test

class AdminSubscriptionPolicyTest {
    private val now = Instant.parse("2026-11-21T15:00:00Z").toEpochMilli()
    @Test fun derivedStatusesRespectPendingSuspensionExpiryAndDateOnlyLojaBoundary() {
        fun place(vararg values: Pair<String, Any?>) = mapOf("subscription" to mapOf(*values))
        assertEquals("paused", AdminSubscriptionPolicy.state(place("status" to "suspended"), now))
        assertEquals("pending", AdminSubscriptionPolicy.state(place("status" to "pending", "endAt" to "2020-01-01"), now))
        assertEquals("expired", AdminSubscriptionPolicy.state(place("endAt" to "2026-11-20"), now))
        assertEquals("expiring", AdminSubscriptionPolicy.state(place("endAt" to "2026-11-21"), now))
        assertEquals("scheduled", AdminSubscriptionPolicy.state(place("startAt" to "2026-12-01"), now))
        assertEquals("review", AdminSubscriptionPolicy.state(place("endAt" to "invalid"), now))
    }
    @Test fun removingLegacyEndActuallyRemovesItsFallbackAndPreservesHistoryAndUnknownBenefits() {
        val history = listOf(mapOf("amount" to 10, "paidAt" to "2026-10-01T10:00:00Z"))
        val place = mapOf<String, Any?>("subscription" to mapOf("plan" to "impulse", "endDate" to "2026-11-30", "paymentHistory" to history, "benefits" to mapOf("future" to true), "metadata" to "keep"))
        val d = AdminSubscriptionPolicy.read("place-01", place)
        val result = AdminSubscriptionPolicy.patch(d.copy(text = d.text + ("endAt" to "")), emptyList())
        assertEquals("", result["endAt"]); assertFalse(result.containsKey("endDate")); assertEquals(history, result["paymentHistory"])
        assertEquals(true, AdminPlatformPolicy.map(result["benefits"])["future"]); assertEquals("keep", result["metadata"])
    }
    @Test fun changingPlanRequiresAnAvailablePlanAndDoesNotRecordAPayment() {
        val d = AdminSubscriptionPolicy.read("place-01", mapOf("subscription" to mapOf("plan" to "free", "monthlyAmount" to 0)))
        val next = d.copy(text = d.text + ("plan" to "premium"))
        assertThrows(IllegalArgumentException::class.java) { AdminSubscriptionPolicy.patch(next, emptyList()) }
        val result = AdminSubscriptionPolicy.patch(next, listOf(mapOf("id" to "premium", "active" to true)))
        assertEquals("premium", result["plan"]); assertEquals(0, result["monthlyAmount"]); assertFalse(result.containsKey("paymentHistory"))
    }
    @Test fun renewalClampsCalendarMonthsAndPreservesAmountAndHistoryFields() {
        val jan = Instant.parse("2026-01-31T17:00:00Z").toEpochMilli()
        val result = AdminSubscriptionPolicy.renew(mapOf("endAt" to "", "startAt" to "", "monthlyAmount" to "10.00"), 1, jan)
        assertEquals("2026-02-28T12:00", result["endAt"]); assertEquals("active", result["status"]); assertEquals("10.00", result["monthlyAmount"])
    }
}
