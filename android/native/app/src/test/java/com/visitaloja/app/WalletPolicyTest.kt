package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test

class WalletPolicyTest {
    private fun place(id: String, category: String) = Place(id, id, listOf(category), "", "", null)
    private val places = listOf(place("h", "hotel")) + (1..6).map { place("f$it", "cafe") } + place("x", "turismo")
    private fun stamp(id: String, campaign: String = "c") = mapOf<String, Any?>("placeId" to id, "campaignId" to campaign)
    private val config = mapOf<String, Any?>("campaignId" to "c", "active" to true)
    @Test fun repeatedVisitsNeverAddPassportSlotsAndOtherCampaignsAreExcluded() {
        val result = WalletPolicy.passport(config, listOf(stamp("f1"), stamp("f1"), stamp("f2", "old"), stamp("x")), places, "lojano", 100)
        assertEquals(1, result.count)
    }
    @Test fun touristRequiresOneHotelAndFiveFoodPlacesWhileLocalDoesNotCountHotels() {
        val food = (1..6).map { stamp("f$it") }
        assertEquals(5, WalletPolicy.passport(config, food, places, "turista", 100).count)
        assertEquals(6, WalletPolicy.passport(config, food + stamp("h"), places, "turista", 100).count)
        assertEquals(6, WalletPolicy.passport(config, food + stamp("h"), places, "lojano", 100).count)
    }
    @Test fun hiddenPlacesDoNotAddProgress() {
        val hidden = place("f1", "cafe").copy(publicationStatus = "draft")
        assertEquals(0, WalletPolicy.passport(config, listOf(stamp("f1")), listOf(hidden), "lojano", 100).count)
    }
    @Test fun inactiveChoicesNeverFallBackToAnotherReward() {
        val c = config + ("local" to mapOf("title" to "Legacy", "choices" to mapOf("a" to mapOf("active" to false, "title" to "Hidden"))))
        assertTrue(WalletPolicy.passport(c, emptyList(), places, "lojano", 100).rewards.isEmpty())
    }
    @Test fun endedCampaignIsMarkedInactive() {
        assertFalse(WalletPolicy.passport(config + ("endAt" to 99L), emptyList(), places, "lojano", 100).active)
    }
    @Test fun seasonUsesItsOwnCounterAndPermanentPolicySurvivesTheEnd() {
        val season = mapOf("id" to "summer", "active" to true, "startAt" to 100L, "endAt" to 200L, "title" to "Verano", "targetVisits" to 12, "rewardTitle" to "Bebida")
        val program = mapOf("id" to "f1", "targetVisits" to 15, "rewardTitle" to "Nuevo", "seasons" to listOf(season))
        val counter = mapOf("placeId" to "f1", "visitCount" to 7, "permanentPolicy" to mapOf("targetVisits" to 10, "rewardTitle" to "Original"), "seasonalCards" to mapOf("summer" to mapOf("visitCount" to 3, "policy" to season)))
        val active = WalletPolicy.cards(listOf(program), listOf(counter), places, 150, "2026-01-01")
        assertEquals(3, active.first().visits); assertEquals(12, active.first().target)
        assertEquals("En pausa durante la temporada", active.last().state)
        val ended = WalletPolicy.cards(listOf(program), listOf(counter), places, 200, "2026-01-01")
        assertEquals(7, ended.first().visits); assertEquals("Original", ended.first().reward)
        assertEquals("Activa", ended.first().state); assertEquals("Temporada finalizada", ended.last().state)
    }
    @Test fun dailyLimitUsesEcuadorDayAndOnlyAnActualRecordedVisit() {
        val p = mapOf("id" to "f1", "targetVisits" to 10)
        val c = mapOf("placeId" to "f1", "visitCount" to 10, "lastVisitDay" to "2026-01-01", "dailyVisitCount" to 1)
        assertTrue(WalletPolicy.cards(listOf(p), listOf(c), places, 100, "2026-01-01").single().dailyBlocked)
        assertFalse(WalletPolicy.cards(listOf(p), listOf(c), places, 100, "2026-01-02").single().dailyBlocked)
        assertEquals(10, WalletPolicy.cards(listOf(p), listOf(c), places, 100, "2026-01-01").single().progress)
    }
}
