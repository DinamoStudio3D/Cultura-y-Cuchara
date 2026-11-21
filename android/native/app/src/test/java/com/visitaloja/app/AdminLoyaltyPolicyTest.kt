package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test

class AdminLoyaltyPolicyTest {
    private fun normal() = mapOf<String, Any?>("active" to true, "targetVisits" to 10L, "maxVisitsPerDay" to 1L,
        "rewardTitle" to "Café", "rewardDescription" to "Condiciones", "rewardType" to "product",
        "rewardValidityDays" to 30L, "stock" to 10L, "claimedCount" to 3L)
    private fun season(id: String = "navidad", start: String = "2026-12-01T14:00:00Z", end: String = "2026-12-10T14:00:00Z") =
        normal().filterKeys { it != "claimedCount" } + mapOf("id" to id, "title" to "Navidad",
            "startAt" to start, "endAt" to end, "active" to true, "futureField" to "conservar")
    private fun base(used: Boolean = false) = normal() + mapOf("seasons" to listOf(season()),
        "seasonUsage" to mapOf("navidad" to used), "seasonClaimedCounts" to mapOf("navidad" to 2L))
    private fun rejects(work: () -> Unit) {
        try { work(); fail("La operación debía rechazarse.") }
        catch (_: Exception) { }
    }
    @Test fun ordinaryEditDoesNotWriteProgressOrRewriteSeasons() {
        val raw = base()
        val draft = AdminLoyaltyPolicy.read(raw)
        val patch = AdminLoyaltyPolicy.patch(raw, draft.copy(terms = draft.terms.copy(reward = "Otro café")), false)
        assertEquals(setOf("active", "targetVisits", "maxVisitsPerDay", "rewardTitle", "rewardDescription",
            "rewardType", "rewardValidityDays", "stock"), patch.keys)
        assertEquals("Otro café", patch["rewardTitle"])
        assertFalse(patch.containsKey("seasons"))
        assertFalse(patch.containsKey("claimedCount"))
    }
    @Test fun usedSeasonAllowsOnlyStockAndPreservesUnknownFields() {
        val raw = base(true)
        val draft = AdminLoyaltyPolicy.read(raw)
        val old = draft.seasons.single()
        val updated = old.copy(terms = old.terms.copy(stock = "20"))
        val patch = AdminLoyaltyPolicy.patch(raw, draft.copy(seasons = listOf(updated)), true)
        val result = (patch["seasons"] as List<*>).single() as Map<*, *>
        assertEquals(20L, result["stock"])
        assertEquals("conservar", result["futureField"])
        assertEquals(season()["startAt"], result["startAt"])
        rejects { AdminLoyaltyPolicy.patch(raw, draft.copy(seasons = listOf(old.copy(active = false))), true) }
        rejects { AdminLoyaltyPolicy.patch(raw, draft.copy(seasons = listOf(old.copy(title = "Otra"))), true) }
        rejects { AdminLoyaltyPolicy.patch(raw, draft.copy(seasons = emptyList()), true) }
    }
    @Test fun issuedCountProtectsSeasonEvenWhenUsageFlagIsMissing() {
        val raw = base(false)
        assertTrue(AdminLoyaltyPolicy.locked(raw, "navidad"))
        val draft = AdminLoyaltyPolicy.read(raw)
        rejects { AdminLoyaltyPolicy.patch(raw, draft.copy(seasons = listOf(draft.seasons.single().copy(end = "2026-12-20T09:00"))), true) }
    }
    @Test fun neitherNormalNorSeasonStockCanFallBelowIssuedRewards() {
        val raw = base(true)
        val draft = AdminLoyaltyPolicy.read(raw)
        rejects { AdminLoyaltyPolicy.patch(raw, draft.copy(terms = draft.terms.copy(stock = "2")), true) }
        val reduced = draft.seasons.single().copy(terms = draft.seasons.single().terms.copy(stock = "1"))
        rejects { AdminLoyaltyPolicy.patch(raw, draft.copy(seasons = listOf(reduced)), true) }
    }
    @Test fun ecuadorDatesRoundTripAndOverlappingActiveSeasonsAreRejected() {
        val raw = normal() + ("seasons" to listOf(season()))
        val draft = AdminLoyaltyPolicy.read(raw)
        assertEquals("2026-12-01T09:00:00", draft.seasons.single().start)
        val overlapping = draft.seasons.single().copy(id = "otra", start = "2026-12-09T09:00", end = "2026-12-20T09:00")
        rejects { AdminLoyaltyPolicy.patch(raw, draft.copy(seasons = draft.seasons + overlapping), true) }
        val touching = overlapping.copy(start = "2026-12-10T09:00")
        val patch = AdminLoyaltyPolicy.patch(raw, draft.copy(seasons = draft.seasons + touching), true)
        assertEquals(2, (patch["seasons"] as List<*>).size)
        rejects { AdminLoyaltyPolicy.patch(raw, draft.copy(seasons = draft.seasons + touching), false) }
    }
    @Test fun createProgramUsesExplicitConfigurationWithoutCreatingStamps() {
        val draft = AdminLoyaltyDraft(active = false, terms = AdminLoyaltyTerms(reward = "Beneficio"))
        val patch = AdminLoyaltyPolicy.patch(emptyMap(), draft, false)
        assertEquals(false, patch["active"])
        assertNull(patch["stock"])
        assertFalse(patch.containsKey("visitCount"))
        assertFalse(patch.containsKey("seasonUsage"))
        rejects { AdminLoyaltyPolicy.patch(emptyMap(), draft.copy(terms = draft.terms.copy(target = "9")), false) }
    }
    @Test fun invalidDatesAndDuplicateIdsNeverReplaceExistingSeasons() {
        val raw = normal() + ("seasons" to listOf(season()))
        val draft = AdminLoyaltyPolicy.read(raw)
        rejects { AdminLoyaltyPolicy.patch(raw, draft.copy(seasons = draft.seasons + draft.seasons), true) }
        val bad = draft.seasons.single().copy(start = "2026-02-30T09:00")
        rejects { AdminLoyaltyPolicy.patch(raw, draft.copy(seasons = listOf(bad)), true) }
    }
}
