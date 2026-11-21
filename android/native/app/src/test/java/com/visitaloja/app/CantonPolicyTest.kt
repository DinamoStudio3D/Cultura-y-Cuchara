package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test

class CantonPolicyTest {
    private fun place(id: String, canton: String, category: String = "cafe") = Place(id, id, listOf(category), "", "", null, cantonId = canton)
    @Test fun configuredRoutesPreserveOrderAndRejectPartialOrCrossCantonRoutes() {
        val a = place("a", "saraguro")
        val b = place("b", "saraguro")
        val route = CantonRoute("r", "Recorrido", "2 horas", "Camina", listOf("b", "a"))
        assertEquals(listOf("b", "a"), CantonPolicy.routeStops("saraguro", route, listOf(a, b)).map { it.id })
        assertTrue(CantonPolicy.routeStops("saraguro", route, listOf(a)).isEmpty())
        assertTrue(CantonPolicy.routeStops("saraguro", route, listOf(a, b.copy(cantonId = "loja"))).isEmpty())
        assertTrue(CantonPolicy.routeStops("saraguro", route, listOf(a, b.copy(publicationStatus = "draft"))).isEmpty())
        assertTrue(CantonPolicy.routeStops("saraguro", route.copy(placeIds = listOf("a", "a")), listOf(a)).isEmpty())
    }
    @Test fun guideCleansAndBoundsRouteConfigurationWithoutInventingStops() {
        val route = mapOf("title" to "<b>Paseo</b>", "duration" to "2 horas", "notes" to "<i>Trae agua</i>", "placeIds" to listOf("a", "a", "bad/id", 5, "b"))
        val guide = CantonPolicy.guide(mapOf("routes" to listOf(route, mapOf("title" to ""))))
        assertEquals(1, guide.routes.size)
        assertEquals("Paseo", guide.routes.single().title)
        assertEquals("Trae agua", guide.routes.single().notes)
        assertEquals(listOf("a", "b"), guide.routes.single().placeIds)
        assertEquals(8, CantonPolicy.guide(mapOf("routes" to List(10) { route })).routes.size)
        assertTrue(CantonPolicy.guide(emptyMap()).routes.isEmpty())
    }
    @Test fun directionsRequireFiniteCoordinatesWithinWorldBounds() {
        val a = place("a", "loja").copy(latitude = -4.0, longitude = -79.2)
        assertTrue(CantonPolicy.directions(a)!!.contains("destination=-4.0,-79.2"))
        assertNull(CantonPolicy.directions(a.copy(latitude = null)))
        assertNull(CantonPolicy.directions(a.copy(latitude = Double.NaN)))
        assertNull(CantonPolicy.directions(a.copy(longitude = 181.0)))
    }
    @Test fun catalogueMatchesAllSixteenWebCantonsAndSearchIgnoresAccents() {
        assertEquals(16, CantonPolicy.catalogue.size)
        assertEquals(16, CantonPolicy.catalogue.map { it.id }.toSet().size)
        assertEquals("gonzanama", CantonPolicy.search("gonzanamá").single().id)
        assertEquals("Espíndola", CantonPolicy.search("espindola").single().name)
    }
    @Test fun explicitAssignmentNeverLeaksIntoLojaAndLegacyBlanksOnlyBelongToLoja() {
        val records = listOf(place("a", "saraguro"), place("b", "loja"), place("old", ""), place("unknown", "other"))
        assertEquals(setOf("b", "old"), CantonPolicy.places("loja", records).map { it.id }.toSet())
        assertEquals(listOf("a"), CantonPolicy.places("saraguro", records).map { it.id })
    }
    @Test fun hiddenAndInactivePlacesAreExcludedEvenWhenFeatured() {
        val records = listOf(place("draft", "loja").copy(publicationStatus = "draft"), place("off", "loja").copy(active = false), place("motel-central", "loja"), place("ok", "loja"))
        assertEquals(listOf("ok"), CantonPolicy.places("loja", records, CantonGuide(featured = listOf("draft", "off"))).map { it.id })
    }
    @Test fun featuredOrderingCannotPullPlacesFromAnotherCantonAndFiltersStayScoped() {
        val records = listOf(place("a", "loja"), place("z", "loja"), place("h", "loja", "hotel"), place("x", "paltas"))
        val guide = CantonGuide(featured = listOf("x", "z"))
        assertEquals(listOf("z", "a"), CantonPolicy.places("loja", records, guide, category = "food").map { it.id })
        assertEquals(listOf("h"), CantonPolicy.places("loja", records, guide, category = "hotel").map { it.id })
    }
    @Test fun guideOnlyIncludesRealTextSafeImagesAndValidFeaturedIds() {
        val guide = CantonPolicy.guide(mapOf("description" to "<b>Cultura</b>", "cover" to "javascript:bad", "history" to "Historia publicada", "featuredIds" to listOf("a", "a", "bad/id", 1)))
        assertEquals("Cultura", guide.description); assertNull(guide.cover)
        assertEquals(listOf("a"), guide.featured)
        assertEquals(listOf("Historia" to "Historia publicada"), guide.sections)
        assertTrue(CantonPolicy.guide(emptyMap()).sections.isEmpty())
    }
}
