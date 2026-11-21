package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test

class AdminPassportRewardPolicyTest {
    private val base = mapOf<String, Any?>("campaignId" to "passport-2026", "tourist" to mapOf("merchantUid" to "shop-a", "metadata" to mapOf("keep" to true)), "local" to mapOf("merchantUid" to "shop-b"))
    private val merchants = mapOf("shop-a" to mapOf<String, Any?>("active" to true), "shop-b" to mapOf<String, Any?>("active" to true))
    @Test fun assignmentsOnlyChangeCurrentCampaignGrants() {
        val draft = AdminPassportRewardPolicy.read(base)
        AdminPassportRewardPolicy.validate(draft, base, merchants)
        assertEquals(listOf("other:turista", "passport-2026:future", "passport-2026:turista"), AdminPassportRewardPolicy.grants(mapOf("passportGrants" to listOf("other:turista", "passport-2026:lojano", "passport-2026:future")), "shop-a", "passport-2026", draft))
        assertEquals(emptyList<String>(), AdminPassportRewardPolicy.grants(mapOf("passportGrants" to listOf("passport-2026:turista")), "removed-shop", "passport-2026", draft))
    }
    @Test fun choicesRequireAnActiveMerchantAndKnownRewardFields() {
        val draft = AdminPassportRewardPolicy.read(base)
        val mode = draft.getValue("tourist"); val choice = mapOf("active" to "true", "title" to "Café", "description" to "Un café", "merchantUid" to "missing")
        val next = draft + ("tourist" to mode.copy(choices = mapOf("reward-1" to choice)))
        assertThrows(IllegalArgumentException::class.java) { AdminPassportRewardPolicy.validate(next, base, merchants) }
        assertThrows(IllegalArgumentException::class.java) { AdminPassportRewardPolicy.validate(draft, base, merchants + ("shop-a" to mapOf("active" to false))) }
        AdminPassportRewardPolicy.validate(next + ("tourist" to mode.copy(choices = mapOf("reward-1" to (choice + ("merchantUid" to "shop-b"))))), base, merchants)
    }
    @Test fun replacementPatchRemovesChoicesButPreservesUnknownMetadata() {
        val stored = base + ("tourist" to mapOf("merchantUid" to "shop-a", "metadata" to "keep", "choices" to mapOf("primary" to mapOf("active" to true, "title" to "Principal", "merchantUid" to "shop-a", "custom" to "keep"), "reward-1" to mapOf("active" to true, "title" to "Otro", "merchantUid" to "shop-b"))))
        val draft = AdminPassportRewardPolicy.read(stored)
        val patch = AdminPassportRewardPolicy.patch(draft + ("tourist" to draft.getValue("tourist").copy(choices = emptyMap())), stored)
        val tourist = patch["tourist"] as Map<*, *>; val choices = tourist["choices"] as Map<*, *>
        assertEquals("keep", tourist["metadata"]); assertFalse(choices.containsKey("reward-1")); assertEquals("keep", (choices["primary"] as Map<*, *>)["custom"])
        assertEquals(setOf("tourist", "local"), patch.keys)
    }
    @Test fun inactiveAlternativeDoesNotGrantAccessAndHttpsIsRequired() {
        val draft = AdminPassportRewardPolicy.read(base); val mode = draft.getValue("tourist")
        val next = draft + ("tourist" to mode.copy(choices = mapOf("reward-1" to mapOf("active" to "false", "title" to "Oculto", "description" to "", "merchantUid" to "shop-b"))))
        assertEquals(listOf("passport-2026:lojano"), AdminPassportRewardPolicy.grants(emptyMap(), "shop-b", "passport-2026", next))
        assertThrows(IllegalArgumentException::class.java) { AdminPassportRewardPolicy.validate(draft + ("tourist" to mode.copy(primary = mode.primary + ("url" to "javascript:alert(1)"))), base, merchants) }
    }
}
