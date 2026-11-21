package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test

class AdminRewardResultPolicyTest {
    @Test fun transitionsMatchEachExistingModuleAndRejectUnknownStatuses() {
        assertTrue(AdminRewardResultPolicy.allowed("classic", "pending", "delivered")); assertTrue(AdminRewardResultPolicy.allowed("classic", "delivered", "cancelled"))
        assertTrue(AdminRewardResultPolicy.allowed("passport", "delivered", "pending")); assertFalse(AdminRewardResultPolicy.allowed("passport", "pending", "cancelled"))
        assertFalse(AdminRewardResultPolicy.allowed("classic", "unknown", "delivered")); assertFalse(AdminRewardResultPolicy.allowed("passport", "delivered", "delivered"))
    }
    @Test fun filtersOnlyLoadedRowsAndKeepsMissingDates() {
        val rows = listOf(AdminRewardResult("a", mapOf("claimCode" to "PAS-ABCD", "status" to "pending", "mode" to "turista", "rewardSnapshot" to mapOf("title" to "Café"))), AdminRewardResult("b", mapOf("status" to "delivered", "mode" to "lojano")))
        assertEquals(listOf("a"), AdminRewardResultPolicy.filtered(rows, "cafe", "pending", "turista").map { it.id })
        assertEquals(2, AdminRewardResultPolicy.filtered(rows, "", "", "").size)
        assertTrue(AdminRewardResultPolicy.filtered(rows, "", "pending", "lojano").isEmpty())
    }
    @Test fun csvQuotesFieldsAndPreventsSpreadsheetFormulaEvaluation() {
        val row = AdminRewardResult("a", mapOf("userName" to " =HYPERLINK(\"bad\")", "userEmail" to "a,b@example.test", "claimCode" to "CHABA-123456", "status" to "pending", "createdAt" to "2026-11-21T15:00:00Z"))
        val csv = AdminRewardResultPolicy.csv("classic", "campaign-01", listOf(row))
        assertTrue(csv.startsWith("\uFEFF")); assertTrue(csv.contains("\"' =HYPERLINK(\"\"bad\"\")\"")); assertTrue(csv.contains("\"a,b@example.test\""))
        assertTrue(csv.contains("2026-11-21 10:00:00")); assertTrue(csv.contains("CHABA-123456"))
    }
    @Test fun collectionSelectionAndCampaignIdsAreBounded() {
        assertEquals("passportCompletions", AdminRewardResultPolicy.collection("passport"))
        assertTrue(AdminRewardResultPolicy.validCampaign("misiones-2026")); assertFalse(AdminRewardResultPolicy.validCampaign("a/b")); assertFalse(AdminRewardResultPolicy.validCampaign(""))
    }
}
