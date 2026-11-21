package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test

class AdminMissionBenefitPolicyTest {
    private val benefit = mapOf<String, Any?>("campaignId" to "misiones-2026", "active" to true, "stock" to 100L, "title" to "Horchata", "sponsorName" to "Negocio", "startAt" to "", "endAt" to "")
    @Test fun publishingKeepsConcurrentIssuedCountAndReconcilesOlderMissingCounters() {
        assertEquals(12L, AdminMissionBenefitPolicy.campaign(benefit, mapOf("issuedCount" to 12L), 10)["issuedCount"])
        assertEquals(15L, AdminMissionBenefitPolicy.campaign(benefit, mapOf("issuedCount" to 12L), 15)["issuedCount"])
        assertEquals(10L, AdminMissionBenefitPolicy.campaign(benefit, emptyMap(), 10)["issuedCount"])
    }
    @Test fun activeCupsCannotFallBelowCodesAlreadyIssuedAndPauseNeverResetsThem() {
        assertThrows(IllegalArgumentException::class.java) { AdminMissionBenefitPolicy.campaign(benefit + ("stock" to 5L), mapOf("issuedCount" to 10L), 0) }
        val paused = AdminMissionBenefitPolicy.campaign(benefit + mapOf("stock" to 5L, "active" to false), mapOf("issuedCount" to 10L), 0)
        assertEquals(false, paused["active"]); assertEquals(10L, paused["issuedCount"])
        listOf(-1, 1.5, Double.NaN, "10").forEach { value -> assertThrows(IllegalArgumentException::class.java) { AdminMissionBenefitPolicy.counter(value) } }
    }
    @Test fun conflictVersionAllowsOnlyIssuanceCounterAndItsTimestampToAdvance() {
        val before = mapOf<String, Any?>("stock" to 100, "active" to true, "issuedCount" to 2, "updatedAt" to "old")
        assertEquals(AdminMissionBenefitPolicy.version(before), AdminMissionBenefitPolicy.version(before + mapOf("issuedCount" to 3, "updatedAt" to "new")))
        assertNotEquals(AdminMissionBenefitPolicy.version(before), AdminMissionBenefitPolicy.version(before + ("stock" to 200)))
        assertNotEquals(AdminMissionBenefitPolicy.version(before), AdminMissionBenefitPolicy.version(before + ("active" to false)))
    }
    @Test fun currentCampaignIdCannotBeChangedAndDatesUseEcuadorTime() {
        val draft = mapOf("n|benefit|campaignId" to "misiones-2026", "n|benefit|active" to "false", "n|benefit|startAt" to "2026-11-21T10:00", "n|benefit|endAt" to "2026-11-22T10:00")
        AdminMissionBenefitPolicy.validate(draft, draft)
        assertThrows(IllegalArgumentException::class.java) { AdminMissionBenefitPolicy.validate(draft + ("n|benefit|campaignId" to "another-campaign"), draft) }
        assertThrows(IllegalArgumentException::class.java) { AdminMissionBenefitPolicy.validate(draft + ("n|benefit|endAt" to "2026-11-20T10:00"), draft) }
        assertEquals("2026-11-21T15:00:00Z", AdminMissionPolicy.date(draft.getValue("n|benefit|startAt")))
    }
}
