package com.visitaloja.app

import java.time.LocalDate
import org.junit.Assert.*
import org.junit.Test
import org.json.JSONObject

class MenuPolicyTest {
    private val today = LocalDate.of(2026, 10, 27)
    private val base = mapOf<String, Any?>("name" to "Sport Burger", "active" to true, "menuImageUrl" to "https://i.imgur.com/menu.jpg", "targetUrl" to "/menu-digital.html?id=menu-sport-burger")
    private fun read(patch: Map<String, Any?> = emptyMap()) = MenuPolicy.read("menu-sport-burger", base + patch, today)
    private val extras = mapOf<String, Any?>("menuBenefits" to mapOf("logo" to true, "whatsapp" to true, "instagram" to true), "menuBusinessLogo" to "https://i.imgur.com/logo.png", "menuWhatsapp" to "593999999999", "menuInstagram" to "https://www.instagram.com/sportburger/")
    @Test fun publishedImageAndCanonicalTargetAreAccepted() {
        assertEquals("Sport Burger", read()?.title)
        assertNotNull(read(mapOf("targetUrl" to "https://www.visitaloja.com/menu-digital.html?id=menu-sport-burger")))
        assertNotNull(read(mapOf("targetUrl" to "https://visitaloja-5dnry0emh-dinamostudio3d.vercel.app/menu-digital.html?id=menu-sport-burger")))
    }
    @Test fun inactiveMissingAndVisitOnlyQrNeverBecomeMenus() {
        assertNull(MenuPolicy.read("menu-sport-burger", null, today))
        assertNull(read(mapOf("active" to false)))
        assertNull(read(mapOf("visit" to mapOf("placeId" to "place-1"))))
        assertNull(read(mapOf("menuImageUrl" to "")))
    }
    @Test fun untrustedUrlsAndWrongBindingsAreRejected() {
        for (url in listOf("http://i.imgur.com/a.jpg", "https://i.imgur.com@evil.test/a.jpg", "https://evil.test/a.jpg", "javascript:alert(1)", "https://i.imgur.com:8080/a.jpg")) assertNull(url, read(mapOf("menuImageUrl" to url)))
        for (url in listOf("https://evil.test/menu-digital.html?id=menu-sport-burger", "/menu-digital.html?id=other", "/other?id=menu-sport-burger", "https://www.visitaloja.com@evil.test/menu-digital.html?id=menu-sport-burger")) assertNull(url, read(mapOf("targetUrl" to url)))
    }
    @Test fun benefitsUseInclusiveEcuadorCalendarBoundaries() {
        val menu = read(extras + mapOf("menuPlanStarts" to today.toString(), "menuPlanExpires" to today.toString()))!!
        assertNotNull(menu.logo); assertNotNull(menu.whatsapp); assertNotNull(menu.instagram)
    }
    @Test fun expiredAndFutureBenefitsKeepTheMenuImage() {
        for (dates in listOf(mapOf("menuPlanStarts" to "2026-10-28"), mapOf("menuPlanExpires" to "2026-10-26"), mapOf("menuPlanExpires" to "2026-02-31"))) {
            val menu = read(extras + dates)!!
            assertNotNull(menu.image); assertNull(menu.logo); assertNull(menu.whatsapp); assertNull(menu.instagram)
        }
    }
    @Test fun socialAndLogoBenefitsNeedExplicitBooleanAndSafeValues() {
        assertNull(read(extras + mapOf("menuBenefits" to mapOf("whatsapp" to "true")))!!.whatsapp)
        assertNull(read(extras + mapOf("menuInstagram" to "https://instagram.com.evil.test/a"))!!.instagram)
        assertNull(read(extras + mapOf("menuWhatsapp" to "javascript:alert(1)"))!!.whatsapp)
        assertNull(read(extras + mapOf("menuBusinessLogo" to "https://evil.test/a.jpg"))!!.logo)
    }
    @Test fun invalidIdsAreRejected() {
        for (id in listOf("", "../menu", "menu/other", "a".repeat(101))) assertFalse(MenuPolicy.validId(id))
    }
    @Test fun placeCacheKeepsMenuBindingAndAcceptsOldEntries() {
        val place = Place("place", "Sport Burger", listOf("restaurante"), "Loja", "", null, menuQrId = "menu-sport-burger")
        assertEquals("menu-sport-burger", PlaceJson.cached(PlaceJson.cachePlace(place))?.menuQrId)
        val old = JSONObject().put("id", "old").put("title", "Old place")
        assertNull(PlaceJson.cached(old)?.menuQrId)
    }
}
