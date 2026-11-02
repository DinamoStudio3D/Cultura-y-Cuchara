package com.visitaloja.app
import org.junit.Assert.*
import org.junit.Test
class MerchantRewardPolicyTest{
    @Test fun acceptsRewardCodesButRejectsVisitAndUrlPayloads(){
        assertEquals("FID-AB1234",MerchantRewardPolicy.code(" fid-ab1234 "))
        assertNull(MerchantRewardPolicy.code("VISITALOJA:123456"));assertNull(MerchantRewardPolicy.code("https://www.visitaloja.com"));assertNull(MerchantRewardPolicy.code(null))
        assertFalse(MerchantRewardPolicy.id("../other"))
    }
    @Test fun merchantCannotDeliverAnotherPlaceOrRevokedAccess(){
        val access=mapOf("placeIds" to listOf("a"));val claim=mapOf("placeId" to "a")
        assertTrue(MerchantRewardPolicy.authorized(access,claim,"loyalty","u"))
        assertFalse(MerchantRewardPolicy.authorized(access,claim+ ("placeId" to "b"),"loyalty","u"))
        assertFalse(MerchantRewardPolicy.authorized(access+("active" to false),claim,"loyalty","u"))
    }
    @Test fun missionAndPassportGrantsRemainSeparate(){
        val access=mapOf("campaignIds" to listOf("c"),"passportGrants" to listOf("p:lojano"))
        assertTrue(MerchantRewardPolicy.authorized(access,mapOf("campaignId" to "c"),"mission","u"))
        assertFalse(MerchantRewardPolicy.authorized(access,mapOf("campaignId" to "other"),"mission","u"))
        assertTrue(MerchantRewardPolicy.authorized(access,mapOf("campaignId" to "p","mode" to "lojano"),"passport","u"))
        assertFalse(MerchantRewardPolicy.authorized(access,mapOf("campaignId" to "p","mode" to "turista"),"passport","u"))
    }
    @Test fun passportOptionRequiresItsExactMerchant(){
        val claim=mapOf("optionId" to "gift","merchantUid" to "owner","campaignId" to "p","mode" to "lojano")
        assertTrue(MerchantRewardPolicy.authorized(emptyMap(),claim,"passport","owner"))
        assertFalse(MerchantRewardPolicy.authorized(mapOf("passportGrants" to listOf("p:lojano")),claim,"passport","other"))
    }
    @Test fun deliveredCancelledExpiredAndUnknownCannotDeliver(){
        listOf("delivered","cancelled","reversed","void","expired","unknown").forEach{assertFalse(MerchantRewardPolicy.canDeliver(mapOf("status" to it,"expiresAt" to 200L),"loyalty",100))}
        assertFalse(MerchantRewardPolicy.canDeliver(mapOf("status" to "pending","expiresAt" to 100L),"loyalty",100))
        assertFalse(MerchantRewardPolicy.canDeliver(mapOf("status" to "pending"),"loyalty",100))
        assertTrue(MerchantRewardPolicy.canDeliver(mapOf("status" to "pending","expiresAt" to 101L),"loyalty",100))
    }
    @Test fun matchesWebMissionAndPassportDeliveryFields(){
        assertTrue(MerchantRewardPolicy.canDeliver(mapOf("status" to "pending"),"mission",100))
        assertTrue(MerchantRewardPolicy.canDeliver(mapOf("status" to "pending"),"passport",100))
        assertEquals("loyaltyRewardClaims",MerchantRewardPolicy.collection("loyalty"))
        assertEquals("passportCompletions",MerchantRewardPolicy.collection("passport"))
        assertEquals("missionRewardClaims",MerchantRewardPolicy.collection("mission"))
    }
}
