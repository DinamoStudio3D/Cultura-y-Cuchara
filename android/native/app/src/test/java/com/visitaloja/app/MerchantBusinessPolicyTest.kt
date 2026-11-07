package com.visitaloja.app
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant
class MerchantBusinessPolicyTest {
    private val now=Instant.parse("2026-11-02T12:00:00Z").toEpochMilli()
    private fun place(plan:String="premium",vararg extra:Pair<String,Any?>)=mapOf("subscription" to (mapOf("plan" to plan)+extra))
    @Test fun freeExpiredFutureAndDisabledSubscriptionsHaveNoAnalytics(){
        assertEquals(0,MerchantBusinessPolicy.months(place("free"),emptyMap(),now))
        assertEquals(0,MerchantBusinessPolicy.months(place(""),emptyMap(),now))
        listOf("status" to "expired","startAt" to now+1,"endAt" to now-1,"endDate" to "invalid").forEach { assertEquals(0,MerchantBusinessPolicy.months(place("premium",it),emptyMap(),now)) }
    }
    @Test fun mirrorsWebAliasesAndLegacyOfferUpgrade(){
        assertEquals(1,MerchantBusinessPolicy.months(place("emprendo"),emptyMap(),now))
        assertEquals(3,MerchantBusinessPolicy.months(place("activo"),emptyMap(),now))
        val settings=mapOf("plans" to listOf(mapOf("id" to "premium","features" to mapOf("analyticsPeriodMonths" to 2))))
        assertEquals(12,MerchantBusinessPolicy.months(place(),settings,now))
    }
    @Test fun respectsConfiguredHistoryAndDisabledPlans(){
        fun settings(active:Boolean,months:Int)=mapOf("plans" to listOf(mapOf("id" to "premium","active" to active,"offerVersion" to 1,"features" to mapOf("analyticsPeriodMonths" to months))))
        assertEquals(2,MerchantBusinessPolicy.months(place(),settings(true,2),now))
        assertEquals(0,MerchantBusinessPolicy.months(place(),settings(false,12),now))
        assertEquals(0,MerchantBusinessPolicy.months(place(),settings(true,0),now))
        assertEquals(36,MerchantBusinessPolicy.months(place(),settings(true,99),now))
    }
    @Test fun historyFilteringDoesNotTruncateAccumulatedClientProgress(){
        val old=mapOf("createdAt" to now-1000,"confirmedAt" to now-1000)
        assertFalse(MerchantBusinessPolicy.inPeriod(old,"visits",now))
        assertFalse(MerchantBusinessPolicy.inPeriod(old,"rewards",now))
        assertTrue(MerchantBusinessPolicy.inPeriod(old,"clients",now))
    }
    @Test fun rewardStatusSeparatesDeliveredExpiredAndCancelled(){
        assertEquals("Entregada",MerchantBusinessPolicy.rewardStatus(mapOf("status" to "delivered","expiresAt" to 1L),now))
        assertEquals("Vencida",MerchantBusinessPolicy.rewardStatus(mapOf("expiresAt" to 1L),now))
        assertEquals("Anulada",MerchantBusinessPolicy.rewardStatus(mapOf("status" to "cancelled"),now))
        assertEquals("Anulada",MerchantBusinessPolicy.rewardStatus(mapOf("status" to "cancelled", "expiresAt" to now - 1),now))
        assertEquals("Vencida",MerchantBusinessPolicy.rewardStatus(mapOf("status" to "pending", "expiresAt" to now),now))
        assertEquals("Pendiente",MerchantBusinessPolicy.rewardStatus(emptyMap(),now))
    }
    @Test fun contactAndMoneyProjectionAvoidsPrivateAndInvalidOutput(){
        assertEquals("di***@gmail.com",MerchantBusinessPolicy.maskedEmail("dinamo@gmail.com"))
        assertEquals("",MerchantBusinessPolicy.maskedEmail("invalid"))
        assertEquals(0.0,MerchantBusinessPolicy.amount(Double.NaN),0.0)
        assertEquals(0.0,MerchantBusinessPolicy.amount(-2),0.0)
        assertEquals(2.5,MerchantBusinessPolicy.amount(2.5),0.0)
    }
    @Test fun visitFiltersUseTheLojaDayAndKeepReversalTimeSeparate() {
        val clock = Instant.parse("2026-11-07T02:00:00Z").toEpochMilli()
        val today = mapOf("status" to "confirmed", "confirmedAt" to Instant.parse("2026-11-06T06:00:00Z").toEpochMilli())
        val yesterday = today + ("confirmedAt" to Instant.parse("2026-11-06T04:59:59Z").toEpochMilli())
        assertTrue(MerchantBusinessPolicy.visitMatches(today, "confirmed", "today", clock))
        assertFalse(MerchantBusinessPolicy.visitMatches(yesterday, null, "today", clock))
        assertTrue(MerchantBusinessPolicy.visitMatches(yesterday, null, "week", clock))
        val reversed = yesterday + mapOf("status" to "reversed", "reversedAt" to clock)
        assertFalse(MerchantBusinessPolicy.visitMatches(reversed, "reversed", "today", clock))
        assertTrue(MerchantBusinessPolicy.visitMatches(reversed, "reversed", "all", clock))
        assertFalse(MerchantBusinessPolicy.visitMatches(reversed, "confirmed", "all", clock))
    }
}
