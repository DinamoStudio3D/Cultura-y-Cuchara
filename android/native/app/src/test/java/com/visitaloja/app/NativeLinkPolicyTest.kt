package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test

class NativeLinkPolicyTest {
    @Test fun canonicalAndBareHostsResolvePublicPlacesWithTracking() {
        assertEquals(NativeLinkTarget("explore", "sport-burger"),NativeLinkPolicy.parse("https://www.visitaloja.com/parada/sport-burger?utm_source=whatsapp"))
        assertEquals(NativeLinkTarget("explore", "sport-burger"),NativeLinkPolicy.parse("https://visitaloja.com/parada/sport-burger/"))
    }
    @Test fun sharedCaptionsSupportExactlyOneLinkAndNeverChooseBetweenLinks() {
        assertEquals("videos",NativeLinkPolicy.shared("Mira Loja:\nhttps://www.visitaloja.com/#loja-en-video")?.route)
        assertEquals("stories",NativeLinkPolicy.shared("(https://visitaloja.com/#historias).")?.route)
        assertNull(NativeLinkPolicy.shared("https://evil.example https://visitaloja.com/"))
        assertNull(NativeLinkPolicy.shared("Visita Loja"));assertNull(NativeLinkPolicy.shared("x".repeat(4097)))
    }
    @Test fun hostSpoofingAndNonHttpsIntentsAreRejected() {
        for (url in listOf("http://www.visitaloja.com/", "https://www.visitaloja.com.evil.test/", "https://www.visitaloja.com@evil.test/", "https://evil.test@www.visitaloja.com/", "https://www.visitaloja.com:443/", "intent://visitaloja.com", "file:///etc/passwd", "https://www.visitaloja.com/\\evil", "https://www.visitaloja.com/\n")) assertNull(url,NativeLinkPolicy.parse(url))
    }
    @Test fun administrativeMenusAndEncodedPathsAreNotClaimed() {
        for (path in listOf("/admin.html", "/merchant-dashboard.html", "/api/chabaquito-ranking", "/menu-digital.html?id=test", "/qr.html?qr=test", "/?qr=test", "/parada/%73port-burger", "/parada/../admin.html", "/%2f%2fevil.test", "/#desconocido")) assertNull(path,NativeLinkPolicy.parse("https://www.visitaloja.com$path"))
    }
    @Test fun checkinAndLoyaltyLinksOnlySelectAPlaceNeverClaimOrStamp() {
        for (path in listOf("/?checkin=loc_123", "/?lugar=loc_123", "/fidelidad.html?place=loc_123")) assertEquals(NativeLinkTarget("explore", "loc_123"),NativeLinkPolicy.parse("https://www.visitaloja.com$path"))
        assertNull(NativeLinkPolicy.parse("https://visitaloja.com/?checkin=a&lugar=b"))
        assertNull(NativeLinkPolicy.parse("https://visitaloja.com/?checkin=a&checkin=a"))
        assertNull(NativeLinkPolicy.parse("https://visitaloja.com/?checkin=a%2Fb"))
        assertNull(NativeLinkPolicy.parse("https://visitaloja.com/?checkin=%zz"))
    }
    @Test fun existingSectionsAndCategoryGuidesOpenTheirNativeScreens() {
        for ((fragment,route) in mapOf("promociones" to "promotions", "podcast" to "podcast", "tienda" to "shop", "especias" to "shop", "establecimientos" to "explore", "postales" to "postcards", "pasaporte" to "passport", "loja-en-imagenes" to "photos")) assertEquals(route,NativeLinkPolicy.parse("https://visitaloja.com/#$fragment")?.route)
        assertEquals(NativeLinkTarget("explore",category="cafe"),NativeLinkPolicy.parse("https://visitaloja.com/cafeterias-en-loja"))
        assertEquals("agenda",NativeLinkPolicy.parse("https://visitaloja.com/agenda.html")?.route)
    }
    @Test fun linkWaitsForTheRequestedFetchWithoutComparingWallClockTimestamps() {
        val loaded=PlacesState(fetchedAt=1L,requestVersion=2,fetchedVersion=2)
        assertTrue(NativeLinkPolicy.ready(loaded,2))
        assertFalse(NativeLinkPolicy.ready(loaded,3))
        assertFalse(NativeLinkPolicy.ready(loaded.copy(loading=true),2))
        assertFalse(NativeLinkPolicy.ready(loaded.copy(offline=true),2))
        assertFalse(NativeLinkPolicy.ready(loaded.copy(error="Sin conexión"),2))
        assertFalse(NativeLinkPolicy.ready(PlacesState(),0))
        // Restoring the pending reference in a new process uses the new process's fresh request.
        assertTrue(NativeLinkPolicy.ready(loaded.copy(requestVersion=1,fetchedVersion=1),0))
    }
    @Test fun placeResolutionUsesPublishedIdsOrUniqueSlugsAndRejectsWithdrawnOrAmbiguous() {
        val a=Place("loc_1","Café central",emptyList(),"","",null)
        assertEquals(a,NativeLinkPolicy.place(listOf(a),"loc_1"));assertEquals(a,NativeLinkPolicy.place(listOf(a),"cafe-central"))
        assertNull(NativeLinkPolicy.place(listOf(a.copy(publicationStatus="draft")),"loc_1"))
        assertNull(NativeLinkPolicy.place(listOf(a.copy(active=false)),"cafe-central"))
        assertNull(NativeLinkPolicy.place(listOf(a,a.copy(id="other")),"cafe-central"))
        assertNull(NativeLinkPolicy.place(emptyList(),"loc_1"))
    }
}
