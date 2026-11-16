package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test

class WalletRewardPolicyTest {
    private val now = 1000L
    private fun reward(id: String, passport: Boolean = false, vararg fields: Pair<String, Any?>) = WalletReward(mapOf("id" to id, "status" to "pending", "expiresAt" to 2000L) + fields, passport)
    @Test fun deliveryAndCancellationNeverBecomeRedeemable() {
        assertEquals("delivered", WalletRewardPolicy.status(reward("a", false, "status" to "delivered", "expiresAt" to 500L), now))
        assertEquals("unavailable", WalletRewardPolicy.status(reward("b", false, "status" to "cancelled", "expiresAt" to 500L), now))
        assertEquals("expired", WalletRewardPolicy.status(reward("c", false, "expiresAt" to now), now))
        assertEquals("expired", WalletRewardPolicy.status(reward("d", false, "expiresAt" to null), now))
        assertEquals("pending", WalletRewardPolicy.status(reward("e", true, "expiresAt" to null), now))
    }
    @Test fun customerCanFindTheirRewardByItsCode() {
        val loyalty = reward("a", false, "claimCode" to "FID-ABC123")
        val passport = reward("b", true, "claimCode" to "PAS-012345ABCDEF")
        assertEquals(listOf(loyalty), WalletRewardPolicy.filter(listOf(loyalty, passport), "fid-abc123", "all", "all", now))
        assertEquals(listOf(passport), WalletRewardPolicy.filter(listOf(loyalty, passport), "pas-012345abcdef", "passport", "all", now))
    }
    @Test fun deliveredRewardsUseTheirDeliveryDateWithoutChangingPendingExpiryPriority() {
        val old = reward("old", false, "status" to "delivered", "createdAt" to 10L, "deliveredAt" to 900L)
        val recent = reward("recent", false, "status" to "delivered", "createdAt" to 500L, "deliveredAt" to 600L)
        assertEquals(listOf("old", "recent"), WalletRewardPolicy.filter(listOf(recent, old), "", "all", "all", now).map { it.row["id"] })
        assertEquals(800L, WalletRewardPolicy.activityMoment(WalletReward(mapOf("status" to "delivered", "processedAt" to 800L), true)))
    }
    @Test fun filtersTypesAndAllSearchWordsAndSortsUrgentPendingFirst() {
        val late = reward("late", false, "rewardTitle" to "Café especial", "placeName" to "Expreso al Sur", "expiresAt" to 4000L)
        val soon = reward("soon", false, "rewardTitle" to "Café gratis", "placeName" to "Expreso al Sur")
        val passport = reward("passport", true, "rewardTitle" to "Café especial", "placeName" to "Expreso al Sur", "expiresAt" to null)
        val delivered = reward("delivered", false, "status" to "delivered", "rewardTitle" to "Café", "placeName" to "Expreso al Sur")
        val rows = listOf(delivered, late, passport, soon)
        assertEquals(listOf("soon", "late"), WalletRewardPolicy.filter(rows, "cafe expreso", "loyalty", "pending", now).map { it.row["id"] })
        assertEquals(listOf("passport"), WalletRewardPolicy.filter(rows, "especial", "passport", "all", now).map { it.row["id"] })
        assertEquals(listOf("soon", "late", "passport", "delivered"), WalletRewardPolicy.filter(rows, "", "all", "all", now).map { it.row["id"] })
        assertTrue(WalletRewardPolicy.filter(rows, "cafe inexistente", "all", "all", now).isEmpty())
        assertNotEquals(reward("same").key, reward("same", true).key)
    }
}
