package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test

class AdminRewardAccessPolicyTest {
    private val request = mapOf<String, Any?>("uid" to "account-01", "email" to "owner@example.test", "displayName" to "Responsable", "status" to "pending")
    @Test fun newApprovalCreatesOnlyBusinessAccessFields() {
        val patch = AdminRewardAccessPolicy.approve("account-01", request, null, "Café", "campaign-01")
        assertEquals(listOf("campaign-01"), patch["campaignIds"]); assertEquals(true, patch["active"])
        assertEquals("account-01", patch["uid"]); assertFalse(patch.containsKey("role")); assertFalse(patch.containsKey("passportGrants"))
    }
    @Test fun approvingAnotherCampaignPreservesExistingPermissionsIdentityAndSuspension() {
        val existing = mapOf<String, Any?>("uid" to "account-01", "email" to "stored@example.test", "active" to false, "campaignIds" to listOf("old-campaign"), "passportGrants" to listOf("passport-01:turista"), "placeIds" to listOf("place-01"), "createdAt" to "old")
        val patch = AdminRewardAccessPolicy.approve("account-01", request, existing, "Café", "campaign-01")
        assertEquals(listOf("old-campaign", "campaign-01"), patch["campaignIds"]); assertEquals(false, patch["active"])
        assertEquals(false, AdminRewardAccessPolicy.approve("account-01", request, existing - "active", "Café", "campaign-01")["active"])
        assertFalse(patch.containsKey("email")); assertFalse(patch.containsKey("passportGrants")); assertFalse(patch.containsKey("createdAt")); assertFalse(patch.containsKey("placeIds"))
    }
    @Test fun accountMismatchesAndResolvedRequestsCannotBeApproved() {
        assertThrows(IllegalArgumentException::class.java) { AdminRewardAccessPolicy.approve("other-uid", request, null, "Café", "campaign-01") }
        assertThrows(IllegalArgumentException::class.java) { AdminRewardAccessPolicy.approve("account-01", request + ("status" to "approved"), null, "Café", "campaign-01") }
        assertThrows(IllegalArgumentException::class.java) { AdminRewardAccessPolicy.approve("account-01", request, mapOf("campaignIds" to "invalid"), "Café", "campaign-01") }
        assertThrows(IllegalArgumentException::class.java) { AdminRewardAccessPolicy.approve("account-01", request, null, "", "campaign-01") }
    }
    @Test fun duplicateGrantsAreNotAddedAndCampaignPathsAreValidated() {
        val patch = AdminRewardAccessPolicy.approve("account-01", request, mapOf("campaignIds" to listOf("campaign-01")), "Café", "campaign-01")
        assertEquals(listOf("campaign-01"), patch["campaignIds"])
        assertThrows(IllegalArgumentException::class.java) { AdminRewardAccessPolicy.campaign("a/b") }
    }
}
