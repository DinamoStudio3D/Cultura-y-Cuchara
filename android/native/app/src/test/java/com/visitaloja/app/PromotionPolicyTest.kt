package com.visitaloja.app

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class PromotionPolicyTest {
    private fun text(value: String) = JSONObject().put("stringValue", value)
    private fun bool(value: Boolean) = JSONObject().put("booleanValue", value)
    private fun map(fields: JSONObject) = JSONObject().put("mapValue", JSONObject().put("fields", fields))
    private fun fields(): JSONObject = JSONObject().put("title", text("Cafetería del centro")).put("subscription", map(JSONObject().put("plan", text("premium")).put("status", text("active")).put("benefits", map(JSONObject().put("promo", bool(true)))).put("promotion", map(JSONObject().put("active", bool(true)).put("title", text("Dos cafés")).put("description", text("Comparte un desayuno")).put("buttonUrl", text("https://example.com/oferta"))))))
    private fun sub(fields: JSONObject) = fields.getJSONObject("subscription").getJSONObject("mapValue").getJSONObject("fields")
    private fun promo(fields: JSONObject) = sub(fields).getJSONObject("promotion").getJSONObject("mapValue").getJSONObject("fields")
    private fun place(fields: JSONObject = fields()) = PlaceJson.document(JSONObject().put("name", "projects/p/databases/(default)/documents/locales/cafe").put("fields", fields))!!
    private fun at(value: String) = Instant.parse(value).toEpochMilli()
    @Test fun requiresPublishedPlaceActivePromotionAndExplicitPaidBenefit() {
        val f = fields(); val p = place(f)
        assertTrue(PromotionPolicy.visible(p, 0, true)); assertFalse(PromotionPolicy.visible(p.copy(active = false), 0, true));assertFalse(PromotionPolicy.visible(p.copy(publicationStatus = "draft"), 0, true))
        for (status in listOf("paused", "pending", "expired", "suspended")) { sub(f).put("status", text(status)); assertFalse(PromotionPolicy.visible(place(f), 0, true)) }
        sub(f).put("status", text("active")).put("plan", text("free"));assertFalse(PromotionPolicy.visible(place(f), 0, true))
        sub(f).put("plan", text("premium")).getJSONObject("benefits").getJSONObject("mapValue").getJSONObject("fields").put("promo", text("true"));assertFalse(PromotionPolicy.visible(place(f), 0, true))
        val disabled = fields(); promo(disabled).put("active", bool(false)); assertFalse(PromotionPolicy.visible(place(disabled), 0, true))
    }
    @Test fun effectiveWindowIsIntersectionOfPlanAndPromotionInEcuador() {
        val f=fields();sub(f).put("startDate",text("2026-10-28")).put("endDate",text("2026-10-30"));promo(f).put("startDate",text("2026-10-29")).put("endDate",text("2026-10-29"));val p=place(f)
        assertFalse(PromotionPolicy.visible(p,at("2026-10-29T04:59:59Z"),true));assertTrue(PromotionPolicy.visible(p,at("2026-10-29T05:00:00Z"),true))
        assertTrue(PromotionPolicy.visible(p,at("2026-10-30T04:59:59.999Z"),true));assertFalse(PromotionPolicy.visible(p,at("2026-10-30T05:00:00Z"),true))
        assertTrue(PromotionPolicy.validity(p.promotion).contains("29"));assertFalse(PromotionPolicy.validity(p.promotion).contains("23:59"))
    }
    @Test fun malformedAndNonoverlappingWindowsCannotPublish() {
        val f=fields();promo(f).put("endAt",text("invalid"));assertFalse(place(f).promotion.valid)
        val g=fields();sub(g).put("endDate",text("2026-10-27"));promo(g).put("startDate",text("2026-10-29"));assertFalse(place(g).promotion.valid)
    }
    @Test fun earlierPlanExpiryControlsDisplayAndTimestampIncludesEcuadorTime() {
        val f=fields();sub(f).put("endAt",text("2026-10-29T17:30:00Z"));promo(f).put("endDate",text("2026-11-10"));val p=place(f)
        assertTrue(PromotionPolicy.validity(p.promotion).contains("12:30 (Ecuador)"));assertFalse(PromotionPolicy.visible(p,at("2026-10-29T17:30:00.001Z"),true))
    }
    @Test fun unsafeActionsAreRemovedAndEnglishOnlyContentIsPreserved() {
        val f=fields();promo(f).remove("title");promo(f).put("titleEn",text("Coffee for two")).put("buttonUrl",text("javascript:alert(1)"));val p=place(f)
        assertEquals("Coffee for two",p.promotion.title);assertNull(p.promotion.url)
    }
    @Test fun offlineAndCachedDirectoriesNeverAdvertiseCurrentOffers() {
        val p=place();assertFalse(PromotionPolicy.visible(p,0,false));assertTrue(PromotionPolicy.filter(listOf(p),"",0,false).isEmpty())
        val cached=PlaceJson.cached(PlaceJson.cachePlace(p))!!;assertEquals(PlacePromotion(),cached.promotion);assertFalse(PromotionPolicy.visible(cached,0,true))
    }
    @Test fun searchMatchesAllWordsAcrossOfferAndBusinessIgnoringAccents() {
        val p=place();assertEquals(listOf(p),PromotionPolicy.filter(listOf(p),"CAFES centro",0,true));assertTrue(PromotionPolicy.filter(listOf(p),"cafes helado",0,true).isEmpty())
        assertEquals("Consulta la vigencia con el negocio",PromotionPolicy.validity(p.promotion))
    }
}
