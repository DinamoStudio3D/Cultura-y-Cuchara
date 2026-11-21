package com.visitaloja.app

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class MapBrandTest {
    private fun place(brand: MapBrand = MapBrand()) = Place("cafe1", "Café Loja", listOf("cafe"), "Centro", "", null, latitude = -3.99, longitude = -79.2, mapBrand = brand)
    @Test fun configuredIconIsKeptAndUnknownIconFallsBackToCategory() {
        assertEquals("\uf810", MapPolicy.glyph(place(MapBrand(iconClass = "fa-ice-cream"))))
        assertEquals("\uf7b6", MapPolicy.glyph(place(MapBrand(iconClass = "unsupported"))))
        assertEquals("#f97316", MapPolicy.color(MapPolicy.kind(place())))
        assertEquals("#0ea5e9", MapPolicy.color("hotel"))
        assertEquals("#7c3aed", MapPolicy.color("partner"))
    }
    @Test fun explicitIconModeOnlyYieldsToActivePaidLogoBenefit() {
        val brand = MapBrand("https://example.org/logo.png", style = "icon", paidLogo = true, start = 100, end = 200)
        assertNull(MapPolicy.logoUrl(place(brand), 99))
        assertEquals(brand.logoUrl, MapPolicy.logoUrl(place(brand), 150))
        assertNull(MapPolicy.logoUrl(place(brand), 201))
        assertNull(MapPolicy.logoUrl(place(brand.copy(paidLogo = false)), 150))
        assertEquals(brand.logoUrl, MapPolicy.logoUrl(place(brand.copy(style = "logo", paidLogo = false)), 150))
    }
    @Test fun cacheRoundTripRetainsPublicMarkerConfigurationAndOldCachesWork() {
        val original = place(MapBrand("https://example.org/logo.png", "fa-mug-hot", "icon", true, 100, 200))
        assertEquals(original.mapBrand, PlaceJson.cached(PlaceJson.cachePlace(original))!!.mapBrand)
        val old = PlaceJson.cachePlace(original).apply { remove("mapBrand") }
        assertEquals(MapBrand(), PlaceJson.cached(old)!!.mapBrand)
        val unsafe = place(MapBrand("javascript:alert(1)", style = "logo"))
        assertNull(MapPolicy.logoUrl(unsafe))
    }
    @Test fun logoChangesUseDifferentSpritesAndPhotoDoesNotBecomeLogo() {
        val first = place(MapBrand("https://example.org/a.png"))
        val second = first.copy(mapBrand = first.mapBrand.copy(logoUrl = "https://example.org/b.png"))
        assertNotEquals(MapPolicy.markerKey(first), MapPolicy.markerKey(second))
        assertNull(MapPolicy.logoUrl(place().copy(imageUrl = "https://example.org/hero.jpg")))
    }
    @Test fun firestoreMarkerFieldsRespectPaidWindowAndNeverCacheSubscriptionDetails() {
        fun text(value: String) = JSONObject().put("stringValue", value)
        val subscription = JSONObject().put("plan", text("plan1")).put("status", text("active"))
            .put("startDate", text("2026-10-01")).put("endDate", text("2026-10-31"))
            .put("benefits", JSONObject().put("mapValue", JSONObject().put("fields", JSONObject().put("logoPin", JSONObject().put("booleanValue", true)))))
        val fields = JSONObject().put("title", text("Café Loja")).put("customLogoUrl", text("https://example.org/logo.png"))
            .put("iconClass", text("fa-mug-hot")).put("mapMarkerStyle", text("icon"))
            .put("subscription", JSONObject().put("mapValue", JSONObject().put("fields", subscription)))
        val parsed = PlaceJson.document(JSONObject().put("name", "locales/cafe1").put("fields", fields))!!
        assertTrue(parsed.mapBrand.paidLogo)
        assertNotNull(MapPolicy.logoUrl(parsed, java.time.Instant.parse("2026-10-31T23:00:00Z").toEpochMilli()))
        assertNull(MapPolicy.logoUrl(parsed, java.time.Instant.parse("2026-11-02T00:00:00Z").toEpochMilli()))
        assertFalse(PlaceJson.cachePlace(parsed).has("subscription"))
    }
    @Test fun baseMapUsesWebCartographyAndVisibleAttribution() {
        val style = JSONObject(MapPolicy.styleJson())
        val osm = style.getJSONObject("sources").getJSONObject("osm")
        assertEquals("https://tile.openstreetmap.org/{z}/{x}/{y}.png", osm.getJSONArray("tiles").getString(0))
        assertTrue(osm.getString("attribution").contains("openstreetmap.org/copyright"))
        assertEquals(256, osm.getInt("tileSize"))
    }
}
