package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test

class AdminAssignmentPolicyTest {
    private fun record(place: String, role: String = "owner", active: Boolean = true, scope: String = role) =
        mapOf<String, Any?>("uid" to "target", "placeId" to place, "role" to role, "active" to active, "assignmentScope" to scope)
    private fun rejects(work: () -> Unit) {
        try { work(); fail("Debía rechazar la asignación.") } catch (_: Exception) { }
    }
    @Test fun legacyOwnerAndExplicitStaffKeepTheirEffectiveScope() {
        val merchant = mapOf<String, Any?>("active" to true, "placeIds" to listOf("legacy", "staff"))
        val records = mapOf("target_staff" to record("staff", "staff"))
        assertEquals(mapOf("legacy" to "owner", "staff" to "staff"), AdminAssignmentPolicy.configured(merchant, records))
        val suspended = mapOf<String, Any?>("active" to false, "placeIds" to listOf("legacy", "staff"))
        val denied = mapOf("target_staff" to record("staff", active = false, scope = "none"))
        assertEquals("staff", AdminAssignmentPolicy.configured(suspended, denied)["staff"])
        val paused = mapOf("target_staff" to record("staff", active = false, scope = "owner"))
        assertEquals("owner", AdminAssignmentPolicy.configured(suspended, paused)["staff"])
    }
    @Test fun modernOnlyEditingNeverBecomesOperationalWithoutExplicitChange() {
        val records = mapOf("target_profile" to record("profile"))
        val before = AdminAssignmentPolicy.configured(null, records)
        assertEquals(mapOf("profile" to "profile"), before)
        val fields = AdminAssignmentPolicy.merchantPatch("target", "target@example.com", "Responsable", null, before, true)
        assertEquals(emptyList<String>(), fields["placeIds"])
        AdminAssignmentPolicy.validate(before, emptyMap(), emptySet(), false, setOf("profile"))
        rejects { AdminAssignmentPolicy.validate(emptyMap(), mapOf("profile" to "profile"), setOf("profile"), false, setOf("profile")) }
    }
    @Test fun removalAndPauseDisableModernGrantsInsteadOfDeletingTheFallbackGuard() {
        val removed = AdminAssignmentPolicy.accessPatch("target", "target@example.com", "cafe", null, true, record("cafe"))
        assertEquals(false, removed["active"])
        assertEquals("none", removed["assignmentScope"])
        val paused = AdminAssignmentPolicy.accessPatch("target", "target@example.com", "cafe", "owner", false, record("cafe"))
        assertEquals(false, paused["active"])
        assertEquals("owner", paused["assignmentScope"])
        val staff = AdminAssignmentPolicy.accessPatch("target", "target@example.com", "cafe", "staff", true, record("cafe"))
        assertEquals("staff", staff["role"])
        assertEquals(true, staff["active"])
    }
    @Test fun campaignGrantsCredentialsAndGlobalRolesAreNeverRewritten() {
        val current = mapOf<String, Any?>("campaignIds" to listOf("campaign"), "passportGrants" to listOf("passport:local"), "role" to "owner")
        val patch = AdminAssignmentPolicy.merchantPatch("target", "target@example.com", "Responsable", current, mapOf("cafe" to "staff"), true)
        assertEquals(setOf("placeIds", "active"), patch.keys)
        assertEquals(listOf("campaign"), (current + patch)["campaignIds"])
        assertFalse(patch.containsKey("password"))
        assertFalse(patch.containsKey("role"))
    }
    @Test fun newSelectionsMustExistAndCannotOverflowNativeOperationalCapacity() {
        rejects { AdminAssignmentPolicy.validate(emptyMap(), mapOf("missing" to "owner"), emptySet(), false, setOf("missing")) }
        val many = (1..21).associate { "place" + it to "staff" }
        rejects { AdminAssignmentPolicy.validate(emptyMap(), many, many.keys, false, many.keys) }
        AdminAssignmentPolicy.validate(many, many, many.keys, true, many.keys)
        AdminAssignmentPolicy.validate(mapOf("removed" to "owner"), emptyMap(), emptySet(), true, setOf("removed"))
    }
    @Test fun malformedOrForeignModernRecordsCannotBeOverwritten() {
        rejects { AdminAssignmentPolicy.modern("target", mapOf("wrong-key" to record("cafe"))) }
        rejects { AdminAssignmentPolicy.modern("other", mapOf("target_cafe" to record("cafe"))) }
        rejects { AdminAssignmentPolicy.modern("target", mapOf("target_cafe" to record("cafe", "admin"))) }
        assertEquals("target@example.com", AdminAssignmentPolicy.email(" TARGET@example.com "))
    }
}
