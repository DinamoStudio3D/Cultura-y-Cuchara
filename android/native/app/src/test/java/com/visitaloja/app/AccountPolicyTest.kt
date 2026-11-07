package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test

class AccountPolicyTest {
    @Test fun favouriteChangesPreserveTheWebItineraryAgendaAndMode() {
        val old = mapOf("uid" to "ana", "favorites" to listOf("a"), "savedAgendaEvents" to listOf("event1"),
            "savedFestivalEvents" to listOf("festival1"), "routeLocationIds" to listOf("route1"), "passportMode" to "lojano", "updatedAt" to "old")
        val next = AccountPolicy.update("ana", old, setOf("b"), "new")
        for (key in listOf("uid", "savedAgendaEvents", "savedFestivalEvents", "routeLocationIds", "passportMode")) assertEquals(old[key], next[key])
        assertEquals(listOf("b"), next["favorites"]); assertEquals("new", next["updatedAt"])
    }
    @Test fun newProgressMatchesExistingWebRules() {
        val next = AccountPolicy.update("ana", null, setOf("a"), "server")
        assertEquals(setOf("uid", "favorites", "savedAgendaEvents", "savedFestivalEvents", "routeLocationIds", "passportMode", "updatedAt"), next.keys)
        assertEquals("turista", next["passportMode"])
    }
    @Test fun aDifferentAccountCannotReuseAnotherUsersProgress() {
        assertThrows(IllegalArgumentException::class.java) { AccountPolicy.update("b", mapOf("uid" to "a"), emptySet(), "server") }
    }
    @Test fun limitsAreEnforcedWithoutSilentlyDroppingPlaces() {
        assertThrows(IllegalArgumentException::class.java) { AccountPolicy.update("a", null, (1..151).map { "p$it" }.toSet(), "server") }
        assertEquals(150, (AccountPolicy.update("a", null, (1..150).map { "p$it" }.toSet(), "server")["favorites"] as List<*>).size)
    }
    @Test fun projectionRejectsUnexpectedTypesAndEmptyIds() {
        assertEquals(setOf("a"), AccountPolicy.favourites(mapOf("favorites" to listOf("a", "a", 1, ""))))
        assertEquals(emptySet<String>(), AccountPolicy.favourites(null))
    }
}
