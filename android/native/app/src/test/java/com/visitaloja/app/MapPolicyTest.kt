package com.visitaloja.app

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class MapPolicyTest {
    private fun place(id: String = "cafe1", lat: Double? = -3.99, lng: Double? = -79.2) =
        Place(id, "Café Loja", listOf("cafe"), "Centro", "", null, latitude = lat, longitude = lng)
    @Test fun invalidOrMissingCoordinatesNeverBecomeMarkers() {
        assertFalse(MapPolicy.located(place(lat = null)))
        assertFalse(MapPolicy.located(place(lng = Double.NaN)))
        assertFalse(MapPolicy.located(place(lat = 91.0)))
        assertFalse(MapPolicy.located(place(lat = 0.0, lng = 0.0)))
        assertTrue(MapPolicy.located(place(lat = 0.0, lng = -79.2)))
    }
    @Test fun filtersCannotExposeDraftsAndRespectAccountFavourites() {
        val live = place()
        val draft = place("draft").copy(publicationStatus = "draft")
        val result = MapPolicy.filtered(listOf(live, draft, place("other")), "cafeterías", "cafe", true, setOf(live.id, draft.id))
        assertEquals(listOf(live), result)
        assertTrue(MapPolicy.filtered(listOf(live), "", "hotel", false, emptySet()).isEmpty())
    }
    @Test fun geoJsonUsesLongitudeFirstAndOnlyPublicProjection() {
        val json = JSONObject(MapPolicy.geoJson(listOf(place(), place(), place("missing", lat = null))))
        val features = json.getJSONArray("features")
        assertEquals(1, features.length())
        val feature = features.getJSONObject(0)
        val coordinates = feature.getJSONObject("geometry").getJSONArray("coordinates")
        assertEquals(-79.2, coordinates.getDouble(0), 0.000001)
        assertEquals(-3.99, coordinates.getDouble(1), 0.000001)
        assertEquals(setOf("id", "title", "pin"), feature.getJSONObject("properties").keySet())
        assertEquals("cafe", feature.getJSONObject("properties").getString("pin"))
    }
    @Test fun hiddenPlacesNeverEnterGeoJson() {
        val json = JSONObject(MapPolicy.geoJson(listOf(place().copy(active = false), place("draft").copy(publicationStatus = "draft"))))
        assertEquals(0, json.getJSONArray("features").length())
    }
    @Test fun approximatePositionIsSeparateFromPublishedPlaces() {
        val position = JSONObject(MapPolicy.locationJson(-3.99, -79.2)).getJSONArray("features").getJSONObject(0)
        assertEquals(0, position.getJSONObject("properties").length())
        assertThrows(IllegalArgumentException::class.java) { MapPolicy.locationJson(Double.NaN, -79.2) }
    }
}
