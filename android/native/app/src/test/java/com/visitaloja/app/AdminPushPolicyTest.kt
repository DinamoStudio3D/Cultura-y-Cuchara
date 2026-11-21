package com.visitaloja.app
import org.junit.Assert.*
import org.junit.Test

class AdminPushPolicyTest {
    @Test fun dispatchNeedsExactAudienceAndObservedTest() {
        assertFalse(AdminPushPolicy.confirmation(30, "ENVIAR 30", false))
        assertFalse(AdminPushPolicy.confirmation(30, "ENVIAR 31", true))
        assertFalse(AdminPushPolicy.confirmation(401, "ENVIAR 401", true))
        assertTrue(AdminPushPolicy.confirmation(30, "ENVIAR 30", true))
    }
    @Test fun publicDestinationsAcceptQueryAndPlace() {
        AdminPushPolicy.validate("Loja", "Una novedad", "/agenda.html?view=all")
        AdminPushPolicy.validate("Loja", "Una novedad", "/parada/expreso-al-sur")
    }
    @Test(expected = IllegalArgumentException::class) fun offsiteDestinationIsRejected() {
        AdminPushPolicy.validate("Loja", "Una novedad", "//example.com/agenda.html")
    }
    @Test(expected = IllegalArgumentException::class) fun administrativeDestinationIsRejected() {
        AdminPushPolicy.validate("Loja", "Una novedad", "/admin.html")
    }
    @Test fun uncertainDispatchCountIsVisibleSeparately() {
        val campaign = AdminPushCampaign.read(org.json.JSONObject("""{"id":"sample-campaign","title":"Loja","total":30,"status":"sending","counts":{"accepted":20,"pending":5,"uncertain":5}}"""))
        assertEquals(5, campaign.counts["uncertain"])
        assertEquals(20, campaign.counts["accepted"])
        assertEquals(5, campaign.counts["pending"])
    }
}
