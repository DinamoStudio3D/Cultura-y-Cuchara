package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test

class AdminAccessPolicyTest {
    @Test fun selfAndPrimaryAccessRemainProtected() {
        assertFalse(AdminAccessPolicy.canEdit("actor", "actor", "self@example.com"))
        assertFalse(AdminAccessPolicy.canEdit("actor", "other", " SUKOGAMES1996@gmail.com "))
        assertFalse(AdminAccessPolicy.canEdit("actor", "bad/id", "other@example.com"))
        assertTrue(AdminAccessPolicy.canEdit("actor", "other", "other@example.com"))
    }
    @Test fun permissionDoesNotAssignBusinessesOrChangeCredentials() {
        val grant = AdminAccessPolicy.grant("actor", "other", "other@example.com", "Nombre", "owner", true)
        assertEquals(setOf("email", "displayName", "role", "active"), grant.keys)
        assertEquals("owner", grant["role"])
        assertFalse(grant.containsKey("placeIds"))
        assertFalse(grant.containsKey("password"))
    }
    @Test(expected = IllegalArgumentException::class) fun unsupportedRoleIsRejected() {
        AdminAccessPolicy.grant("actor", "other", "other@example.com", "Nombre", "merchant", true)
    }
    @Test(expected = IllegalArgumentException::class) fun malformedEmailIsRejected() {
        AdminAccessPolicy.grant("actor", "other", "invalid", "Nombre", "admin", true)
    }
}
