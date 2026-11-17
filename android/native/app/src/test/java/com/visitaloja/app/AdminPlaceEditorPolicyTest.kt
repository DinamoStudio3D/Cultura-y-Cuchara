package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test

class AdminPlaceEditorPolicyTest {
    private val id = "loc_test_12345678"
    private fun raw(category: Any = "turismo") = mapOf<String, Any?>("title" to "Lugar Loja", "desc" to "Un lugar de Loja",
        "address" to "Centro", "lat" to -3.99, "lng" to -79.2, "category" to category, "cantonId" to "loja",
        "publicationStatus" to "published", "active" to true)
    private fun fields(raw: Map<String, Any?>, draft: AdminPlaceDraft, create: Boolean = false, limit: Int = 3, hasPin: Boolean = false) =
        AdminPlaceEditorPolicy.publicFields(id, raw, draft, create, limit, hasPin)
    private fun rejects(work: () -> Unit) {
        try { work(); fail("La operación debía rechazarse.") } catch (_: Exception) { }
    }
    @Test fun creationStartsAsDraftAndNeverCreatesCommercialGrants() {
        val draft = AdminPlaceEditorPolicy.read(raw(), true)
        assertEquals("draft", draft.publication)
        val result = fields(emptyMap(), draft, true)
        assertEquals("merchant_confirmation", result["validationMode"])
        assertEquals(false, (result["discovery"] as Map<*, *>)["enabled"])
        assertTrue((result["slug"] as String).endsWith("12345678"))
        assertFalse(result.containsKey("subscription"))
        assertFalse(result.containsKey("loyaltyPrograms"))
        assertFalse(result.containsKey("pin"))
    }
    @Test fun pinIsRequiredForBusinessCreationAndNeverLeaksToPublicFields() {
        val draft = AdminPlaceEditorPolicy.read(raw("cafe"), true)
        rejects { fields(emptyMap(), draft, true, hasPin = true) }
        val result = fields(emptyMap(), draft.copy(pin = "6789"), true)
        assertFalse(result.containsKey("pin"))
        rejects { fields(emptyMap(), draft.copy(pin = "123"), true) }
        assertFalse(fields(raw("cafe"), draft.copy(publication = "published"), hasPin = true).containsKey("pin"))
    }
    @Test fun galleryReorderingKeepsCreditsMetadataAndOversizedLegacyCollections() {
        val one = mapOf("img" to "https://example.com/one.jpg", "credit" to "Autor", "license" to "Conservar")
        val two = mapOf("img" to "https://example.com/two.jpg", "caption" to "Otra imagen", "custom" to 10L)
        val raw = raw() + ("gallery" to listOf(one, two))
        val draft = AdminPlaceEditorPolicy.read(raw, false)
        val result = fields(raw, draft.copy(photos = draft.photos.reversed()), limit = 1)
        assertEquals(listOf(two, one), result["gallery"])
        rejects { fields(raw, draft.copy(photos = draft.photos + AdminPlacePhoto("new", "https://example.com/three.jpg")), limit = 1) }
    }
    @Test fun nestedProfileAndAdditionalCategoriesSurviveUnrelatedEdits() {
        val raw = raw(listOf("cafe", "aliado")) + mapOf("businessProfile" to mapOf("custom" to "conservar",
            "amenities" to mapOf("special" to true)), "subscription" to mapOf("plan" to "premium"))
        val draft = AdminPlaceEditorPolicy.read(raw, false)
        val result = fields(raw, draft, hasPin = true)
        assertEquals(listOf("cafe", "aliado"), result["category"])
        assertEquals("conservar", (result["businessProfile"] as Map<*, *>)["custom"])
        assertEquals(true, ((result["businessProfile"] as Map<*, *>)["amenities"] as Map<*, *>)["special"])
        assertFalse(result.containsKey("subscription"))
    }
    @Test fun archivedVisibilityIsPreservedUntilExplicitReactivation() {
        val raw = raw() + ("status" to "archived")
        val draft = AdminPlaceEditorPolicy.read(raw, false)
        assertFalse(draft.active)
        val unchanged = fields(raw, draft)
        assertFalse(unchanged.containsKey("active"))
        assertFalse(unchanged.containsKey("status"))
        val activated = fields(raw, draft.copy(active = true))
        assertEquals("active", activated["status"])
        assertEquals(true, activated["active"])
        val legacy = raw() - "publicationStatus" + mapOf("status" to "draft", "hidden" to true, "published" to false)
        val published = fields(legacy, AdminPlaceEditorPolicy.read(legacy, false).copy(publication = "published"))
        assertEquals("active", published["status"])
        assertEquals(false, published["hidden"])
        assertEquals(true, published["published"])
    }
    @Test fun invalidCoordinatesCantonsAndLinksAreRejected() {
        val raw = raw()
        val draft = AdminPlaceEditorPolicy.read(raw, false)
        rejects { fields(raw, draft.copy(text = draft.text + ("lat" to "NaN"))) }
        rejects { fields(raw, draft.copy(canton = "otra-provincia")) }
        rejects { fields(raw, draft.copy(text = draft.text + ("website" to "javascript:alert(1)"))) }
        rejects { fields(raw, draft.copy(photos = listOf(AdminPlacePhoto("x", "http://example.com/photo.jpg")))) }
    }
    @Test fun planGalleryLimitAndCreationRecoveryRequireTheirExactIdentity() {
        val plans = mapOf("plans" to listOf(mapOf("id" to "premium", "features" to mapOf("maxGalleryImages" to 20L))))
        assertEquals(20, AdminPlaceEditorPolicy.galleryLimit(raw() + ("subscription" to mapOf("plan" to "premium")), plans))
        assertEquals(3, AdminPlaceEditorPolicy.galleryLimit(raw(), emptyMap()))
        val created = mapOf<String, Any?>("createdBy" to "actor", "creationRequestId" to id)
        assertTrue(AdminPlaceEditorPolicy.recoveredCreation(created, "actor", id))
        assertFalse(AdminPlaceEditorPolicy.recoveredCreation(created, "other", id))
        assertFalse(AdminPlaceEditorPolicy.recoveredCreation(created, "actor", "other-place"))
    }
}
