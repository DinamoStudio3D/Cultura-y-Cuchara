package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test

class AdminMissionPolicyTest {
    private fun valid(base: Map<String, Any?>? = null): MissionEdit {
        val d = AdminMissionPolicy.draft("test-mission", base)
        return d.copy(text = d.text + mapOf("title" to "Explora Loja", "description" to "Visita lugares distintos", "badge.title" to "Explorador", "badge.description" to "Exploraste Loja"))
    }
    @Test fun newMissionStartsInDraftAndDoesNotCreatePhysicalRewards() {
        val patch = AdminMissionPolicy.patch(valid())
        assertEquals("draft", patch["status"]); assertEquals("digital", patch["rewardType"]); assertNull(patch["physicalCampaignId"])
        assertEquals(1, patch["targetCount"])
    }
    @Test fun scopeMustContainEnoughUniquePlacesOrCantons() {
        val d = valid().copy(text = valid().text + mapOf("type" to "place_visits", "scope" to "a\na\nb", "targetCount" to "3"))
        assertThrows(IllegalArgumentException::class.java) { AdminMissionPolicy.patch(d) }
        val patch = AdminMissionPolicy.patch(d.copy(text = d.text + ("targetCount" to "2")))
        assertEquals(listOf("a", "b"), patch["placeIds"])
        assertThrows(IllegalArgumentException::class.java) { AdminMissionPolicy.patch(d.copy(text = d.text + mapOf("scope" to "", "targetCount" to "1"))) }
    }
    @Test fun editingDoesNotRewriteExistingPhysicalCampaignOrUntouchedDates() {
        val base = mapOf<String, Any?>("id" to "test-mission", "type" to "unique_places", "targetCount" to 2L, "status" to "paused", "rewardType" to "digital_physical", "physicalCampaignId" to "campaign-01", "startsAt" to "2026-11-21T14:00:00Z", "badge" to mapOf("custom" to "keep"))
        val patch = AdminMissionPolicy.patch(valid(base))
        assertFalse(patch.containsKey("physicalCampaignId")); assertFalse(patch.containsKey("rewardType")); assertFalse(patch.containsKey("startsAt"))
        assertEquals("keep", (patch["badge"] as Map<*, *>)["custom"])
        assertFalse(patch.containsKey("active")); assertFalse(patch.containsKey("hidden"))
    }
    @Test fun explicitActivationClearsLegacyFlagsAndArchivingDoesNotDeleteDefinition() {
        val d = valid(mapOf("status" to "paused", "active" to false, "hidden" to true))
        val patch = AdminMissionPolicy.patch(d.copy(text = d.text + ("status" to "active")))
        assertEquals(true, patch["active"]); assertEquals(false, patch["hidden"])
        assertEquals("archived", AdminMissionPolicy.patch(d.copy(text = d.text + ("status" to "archived")))["status"])
    }
    @Test fun datesUseEcuadorTimeAndRejectReversedWindows() {
        assertEquals("2026-11-21T14:30:00Z", AdminMissionPolicy.date("2026-11-21T09:30"))
        assertEquals("2026-11-21T09:30", AdminMissionPolicy.dateInput("2026-11-21T14:30:00Z"))
        val d = valid().copy(text = valid().text + mapOf("startsAt" to "2026-11-22T10:00", "endsAt" to "2026-11-21T10:00"))
        assertThrows(IllegalArgumentException::class.java) { AdminMissionPolicy.patch(d) }
        assertThrows(IllegalArgumentException::class.java) { AdminMissionPolicy.draft("test-mission", mapOf("targetCount" to 2.5)) }
    }
    @Test fun passportPatchCannotChangeCampaignIdentityOrMerchantGrants() {
        val groups = listOf(PlatformGroup("passport", "Pasaporte", true, listOf(
            PlatformField("r|campaignName", "Nombre"), PlatformField("r|introText", "Mensaje"), PlatformField("r|active", "Activo", "true", "bool"),
            PlatformField("r|startAt", "Inicio", type = "schedule"), PlatformField("r|endAt", "Fin", type = "schedule"))))
        val base = mapOf<String, Any?>("campaignId" to "campaign-01", "campaignName" to "Campaña", "introText" to "Visita Loja", "active" to true, "tourist" to mapOf("merchantUid" to "owner-1"), "local" to mapOf("choices" to mapOf("primary" to mapOf("merchantUid" to "owner-2"))))
        val initial = AdminPlatformPolicy.read(base, groups)
        val patch = AdminPlatformPolicy.patch("passport", base, initial, initial + ("r|campaignName" to "Campaña nueva"), groups)
        assertEquals(mapOf("campaignName" to "Campaña nueva"), patch)
        assertFalse(patch.containsKey("campaignId")); assertFalse(patch.containsKey("tourist")); assertFalse(patch.containsKey("local"))
    }
}
