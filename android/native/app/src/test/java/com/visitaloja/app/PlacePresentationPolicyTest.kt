package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test

class PlacePresentationPolicyTest {
    private val cafe = Place("cafe", "Expreso al Sur", listOf("cafe"), "Loja", "Café lojano", null)
    @Test fun englishSearchFindsConfiguredCategoriesAndKeepsPublicationAndFilterRules() {
        assertTrue(PlacePolicy.matches(cafe, "coffee"))
        assertTrue(PlacePolicy.matches(cafe.copy(categories = listOf("hostal")), "lodging"))
        assertTrue(PlacePolicy.matches(cafe.copy(categories = listOf("turismo")), "tourism"))
        assertFalse(PlacePolicy.matches(cafe.copy(publicationStatus = "draft"), "coffee"))
        assertFalse(PlacePolicy.matches(cafe, "coffee", "hotel"))
        assertFalse(PlacePolicy.matches(cafe, "coffee nonexistent"))
        assertFalse(PlacePolicy.matches(cafe, "lodging"))
    }
    @Test fun labelsNeverChangeBusinessContentOrCategoryIds() {
        assertEquals("Coffee shop", PlacePresentationPolicy.category(cafe, true))
        assertEquals(cafe.categoryLabel, PlacePresentationPolicy.category(cafe, false))
        assertEquals("Expreso al Sur", cafe.title)
        assertEquals(listOf("cafe"), cafe.categories)
        assertEquals("All", PlacePresentationPolicy.filterCategory("all", "Todo", true))
    }
    @Test fun publishedHoursUseChosenLanguageWithOriginalTextFallback() {
        val info = PlaceInfo(hours = "Martes a domingo", hoursEn = "Tuesday to Sunday")
        assertEquals("Tuesday to Sunday", PlacePresentationPolicy.hours(info, true))
        assertEquals("Martes a domingo", PlacePresentationPolicy.hours(info, false))
        assertEquals("Martes a domingo", PlacePresentationPolicy.hours(info.copy(hoursEn = ""), true))
        assertEquals("Tuesday to Sunday", PlacePresentationPolicy.hours(info.copy(hours = ""), false))
        assertEquals("Parking", PlacePresentationPolicy.amenity("parking", true))
        assertEquals("Efectivo", PlacePresentationPolicy.payment("cash", false))
        assertNull(PlacePresentationPolicy.amenity("invented", true))
    }
    @Test fun savedEmptySearchDoesNotPretendUserHasNoFavourites() {
        assertTrue(PlacePresentationPolicy.savedSearchEmpty(true, "not found", true))
        assertFalse(PlacePresentationPolicy.savedSearchEmpty(true, "", true))
        assertFalse(PlacePresentationPolicy.savedSearchEmpty(true, "not found", false))
        assertFalse(PlacePresentationPolicy.savedSearchEmpty(false, "not found", true))
    }
}
