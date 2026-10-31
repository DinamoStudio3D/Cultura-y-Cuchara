package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test

class ItineraryPolicyTest {
    private fun place(id: String, status: String = "published") = Place(id, id, listOf("cafe"), "Loja", "", null, publicationStatus = status)
    @Test fun withdrawnAndUnpublishedStopsNeverEnterRoute() {
        assertEquals(listOf("a"), ItineraryPolicy.reconcile(listOf("hidden", "missing", "a"), setOf("a", "hidden", "missing"), listOf(place("a"), place("hidden", "draft"))))
    }
    @Test fun existingOrderSurvivesNewFavourite() {
        assertEquals(listOf("b", "a", "c"), ItineraryPolicy.reconcile(listOf("b", "a"), linkedSetOf("a", "b", "c"), listOf(place("a"), place("b"), place("c"))))
    }
    @Test fun unfavouritedStopsDisappearWithoutDuplicates() {
        assertEquals(listOf("a"), ItineraryPolicy.reconcile(listOf("b", "a", "a"), setOf("a"), listOf(place("a"), place("b"))))
    }
    @Test fun movePreservesMembershipAndAdjacentOrder() {
        assertEquals(listOf("b", "a", "c"), ItineraryPolicy.move(listOf("a", "b", "c"), "b", -1))
        assertEquals(listOf("a", "c", "b"), ItineraryPolicy.move(listOf("a", "b", "c"), "b", 1))
    }
    @Test fun invalidMovesAreNoOps() {
        val order = listOf("a", "b")
        assertEquals(order, ItineraryPolicy.move(order, "a", -1))
        assertEquals(order, ItineraryPolicy.move(order, "b", 1))
        assertEquals(order, ItineraryPolicy.move(order, "missing", 1))
        assertEquals(order, ItineraryPolicy.move(order, "a", 2))
    }
}
