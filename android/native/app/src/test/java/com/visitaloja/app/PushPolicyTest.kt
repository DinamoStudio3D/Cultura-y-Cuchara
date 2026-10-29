package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test

class PushPolicyTest {
    private val data = mapOf("title" to "Loja te espera", "body" to "Nuevos eventos", "url" to "/#agenda")
    @Test fun canonicalPublicDestinationsOnly() {
        assertEquals("/#agenda", PushPolicy.link("/#agenda"))
        assertEquals("/parada/sport-burger", PushPolicy.link("/parada/sport-burger"))
        for (url in listOf("https://evil.test/", "//evil.test/", "/\\evil.test", "javascript:alert(1)", "/admin.html", "/api/chabaquito-ranking", "/%2f%2fevil.test", "/\n")) assertNull(url, PushPolicy.link(url))
    }
    @Test fun invalidOrOversizedPayloadsNeverBecomeNotices() {
        for (patch in listOf(mapOf("title" to ""),mapOf("title" to "x".repeat(81)),mapOf("body" to "x".repeat(241)),mapOf("title" to "hello\nworld"),mapOf("url" to "https://evil.test"))) assertNull(PushPolicy.notice(data + patch,"id",1))
    }
    @Test fun noticesPreservePlainTextAndValidatedDestination() {
        val notice = PushPolicy.notice(data,"message-1",123)!!
        assertEquals("Loja te espera",notice.title);assertEquals("/#agenda",notice.url);assertEquals(123L,notice.receivedAt)
    }
    @Test fun revokedConsentAndAccountChangesAreRejected() {
        assertTrue(PushPolicy.eligible("alice","alice",true,true))
        assertFalse(PushPolicy.eligible("alice","bob",true,true))
        assertFalse(PushPolicy.eligible("alice",null,true,true))
        assertFalse(PushPolicy.eligible("alice","alice",false,true))
        assertFalse(PushPolicy.eligible("alice","alice",true,false))
        assertFalse(PushPolicy.eligible("","",true,true))
    }
    @Test fun deviceAcknowledgementNeedsCanonicalHash() {
        assertTrue(PushPolicy.deviceId("a".repeat(64)))
        assertFalse(PushPolicy.deviceId("a".repeat(63)));assertFalse(PushPolicy.deviceId("G".repeat(64)));assertFalse(PushPolicy.deviceId(null))
    }
    @Test fun historyIsBoundedAndDoesNotDuplicateTheSameDelivery() {
        val old=(1..25).map { ReceivedNotice("$it","Title","Body","/",it.toLong()) }
        val next=ReceivedNotice("2","Updated","Body","/",40)
        val rows=PushPolicy.history(old,next)
        assertEquals(20,rows.size);assertEquals("Updated",rows.first().title);assertEquals(1,rows.count { it.id=="2" })
    }
    @Test fun linksUseNativeSectionsWhenAvailable() {
        assertEquals("supporters",PushPolicy.route("/#registeredBrands"));assertEquals("agenda",PushPolicy.route("/#agenda"));assertEquals("passport",PushPolicy.route("/fidelidad.html?place=somewhere"))
        assertEquals("missions",PushPolicy.route("/#misiones"));assertEquals("cantons",PushPolicy.route("/cantones.html"));assertNull(PushPolicy.route("/mesa-turistica.html"))
    }
    @Test fun delayedCampaignsRespectTheSameOneHourLifetimeAsWebPush() {
        val now=10_000_000L
        assertTrue(PushPolicy.fresh(now-3_600_000,now,"aviso-abc"))
        assertFalse(PushPolicy.fresh(now-3_600_001,now,"aviso-abc"))
        assertFalse(PushPolicy.fresh(0,now,"aviso-abc"))
        assertFalse(PushPolicy.fresh(now+300_001,now,"aviso-abc"))
    }
    @Test fun serverTestsExpireAfterFiveMinutes() {
        val now=10_000_000L
        assertTrue(PushPolicy.fresh(now-300_000,now,"prueba-abc"))
        assertFalse(PushPolicy.fresh(now-300_001,now,"prueba-abc"))
    }
    @Test fun malformedEscapesAndEncodedProtectedPathsAreRejected() {
        assertNull(PushPolicy.link("/%zz"));assertNull(PushPolicy.link("/admin%2ehtml"));assertNull(PushPolicy.link("/../admin.html"))
    }
}
