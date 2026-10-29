package com.visitaloja.app

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class PlaceInfoPolicyTest {
    private fun at(value: String) = Instant.parse(value).toEpochMilli()
    @Test fun usesEcuadorTimeAndFractionalHoursAtBoundaries() {
        val info = PlaceInfo(openHour = 8.5, closeHour = 9.25)
        assertEquals(false, PlaceInfoPolicy.open(info, at("2026-10-20T13:29:00Z")))
        assertEquals(true, PlaceInfoPolicy.open(info, at("2026-10-20T13:30:00Z")))
        assertEquals(false, PlaceInfoPolicy.open(info, at("2026-10-20T14:15:00Z")))
        assertEquals("08:30 – 09:15", PlaceInfoPolicy.range(info))
    }
    @Test fun overnightRangesIncludeTheFollowingMorningButExcludeClosingTime() {
        val info = PlaceInfo(openHour = 22.0, closeHour = 2.0)
        assertEquals(true, PlaceInfoPolicy.open(info, at("2026-10-20T04:00:00Z")))
        assertEquals(true, PlaceInfoPolicy.open(info, at("2026-10-20T06:00:00Z")))
        assertEquals(false, PlaceInfoPolicy.open(info, at("2026-10-20T07:00:00Z")))
        assertEquals(false, PlaceInfoPolicy.open(info, at("2026-10-20T20:00:00Z")))
    }
    @Test fun explicit24HoursOverrideLegacyHoursInBothLanguages() {
        for (text in listOf("Atención 24/7", "Abierto 24 horas", "Open 24 hours")) {
            assertEquals(true, PlaceInfoPolicy.open(PlaceInfo(hours = text, openHour = 9.0, closeHour = 20.0), at("2026-10-20T05:30:00Z")))
        }
        assertTrue(PlaceInfoPolicy.alwaysOpen(PlaceInfo(hoursEn = "Open 24 hours")))
    }
    @Test fun unknownInvalidAndOfflineHoursNeverPretendTheBusinessIsOpen() {
        val now = at("2026-10-20T13:30:00Z")
        assertNull(PlaceInfoPolicy.open(PlaceInfo(), now))
        assertNull(PlaceInfoPolicy.open(PlaceInfo(openHour = Double.NaN, closeHour = 20.0), now))
        assertNull(PlaceInfoPolicy.open(PlaceInfo(openHour = 9.0, closeHour = 25.0), now))
        assertNull(PlaceInfoPolicy.open(PlaceInfo(hours = "24/7"), now, false))
        assertEquals(false, PlaceInfoPolicy.open(PlaceInfo(openHour = 8.0, closeHour = 8.0), now))
    }
    @Test fun socialLinksRejectOtherPlatformsAndCredentials() {
        assertEquals("https://www.instagram.com/cafe/", PlaceInfoPolicy.url("instagram", "https://www.instagram.com/cafe/"))
        for (url in listOf("javascript:bad", "http://instagram.com/cafe", "https://instagram.com.evil.test/cafe", "https://user@instagram.com/cafe", "https://instagram.com:123/cafe")) assertNull(PlaceInfoPolicy.url("instagram", url))
        assertNull(PlaceInfoPolicy.url("facebook", "https://example.test/facebook"))
        assertEquals("https://cafe.example/menu", PlaceInfoPolicy.url("website", "https://cafe.example/menu"))
    }
    @Test fun documentAndCacheKeepOnlyConfiguredPublicServices() {
        val f = JSONObject("""{"hours":{"stringValue":"Lunes a viernes"},"openHour":{"doubleValue":8.5},"closeHour":{"integerValue":"20"},"businessProfile":{"mapValue":{"fields":{"priceRange":{"stringValue":"$$"},"privateNote":{"stringValue":"secret"},"paymentMethods":{"arrayValue":{"values":[{"stringValue":"cash"},{"stringValue":"unknown"},{"stringValue":"cash"}]}},"amenities":{"mapValue":{"fields":{"wifi":{"booleanValue":true},"parking":{"booleanValue":false},"delivery":{"stringValue":"true"}}}},"instagram":{"stringValue":"https://instagram.com/cafe"}}}}}""")
        val info = PlaceInfoPolicy.read(f)
        assertEquals(listOf("wifi"), info.amenities);assertEquals(listOf("cash"), info.payments)
        assertEquals("$$", info.priceRange);assertEquals(1, info.links.size)
        val cache = PlaceInfoPolicy.cache(info);assertFalse(cache.toString().contains("secret"))
        assertEquals(info, PlaceInfoPolicy.cached(cache))
    }
    @Test fun oldPlaceCacheKeepsUnknownHoursAndNoInventedServices() {
        val place = PlaceJson.cached(JSONObject("""{"id":"p","title":"Café","categories":["cafe"]}"""))!!
        assertEquals(PlaceInfo(), place.info)
        assertNull(PlaceInfoPolicy.open(place.info, 0))
        val source = place.copy(info = PlaceInfo(hours = "24 horas", amenities = listOf("wifi")))
        assertEquals(source.info, PlaceJson.cached(PlaceJson.cachePlace(source))!!.info)
    }
}
