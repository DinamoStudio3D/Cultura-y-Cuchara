package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test

class AdminPlacePolicyTest {
    @Test fun businessOwnerDoesNotBecomeGlobalAdministrator() {
        assertFalse(AdminPlacePolicy.allowed("owner@example.com", emptyMap(), mapOf("active" to true, "role" to "owner")))
        assertFalse(AdminPlacePolicy.allowed("owner@example.com", mapOf("admin" to "true"), emptyMap()))
        assertFalse(AdminPlacePolicy.allowed("old@example.com", emptyMap(), mapOf("active" to false, "role" to "admin")))
        assertTrue(AdminPlacePolicy.allowed("admin@example.com", emptyMap(), mapOf("active" to true, "role" to "admin")))
        assertTrue(AdminPlacePolicy.allowed("admin@example.com", mapOf("role" to "admin"), emptyMap()))
    }
    @Test fun publicationPatchPreservesPlansPermissionsAndSuspensions() {
        val patch = AdminPlacePolicy.patch("  Cafetería  ", "Descripción", "Loja", "hidden")
        assertEquals("Cafetería", patch["title"])
        assertEquals("hidden", patch["publicationStatus"])
        assertEquals(setOf("title", "description", "desc", "address", "publicationStatus"), patch.keys)
        assertFalse(patch.containsKey("active"))
        assertFalse(patch.containsKey("subscription"))
    }
    @Test(expected = IllegalArgumentException::class) fun unknownPublicationIsRejected() {
        AdminPlacePolicy.patch("Cafetería", "", "", "deleted")
    }
}
