package com.visitaloja.app

import org.json.JSONArray
import org.json.JSONObject

object MapPolicy {
    const val STYLE = "https://tiles.openfreemap.org/styles/liberty"
    const val LOJA_LAT = -3.99313
    const val LOJA_LNG = -79.20422
    fun located(place: Place): Boolean = PlacePolicy.published(place) &&
        PlacePolicy.safeCoordinate(place.latitude, true) != null &&
        PlacePolicy.safeCoordinate(place.longitude, false) != null &&
        !(place.latitude == 0.0 && place.longitude == 0.0)
    fun filtered(places: List<Place>, query: String, category: String, savedOnly: Boolean, favourites: Set<String>): List<Place> =
        places.filter { located(it) && PlacePolicy.matches(it, query, category) && (!savedOnly || it.id in favourites) }.distinctBy { it.id }
    fun kind(place: Place): String = when {
        place.categories.any { it in setOf("hotel", "hostal", "hospedaje", "alojamiento") } -> "hotel"
        "cafe" in place.categories -> "cafe"
        "turismo" in place.categories -> "turismo"
        place.categories.any { it in setOf("restaurante", "hueca", "urbana", "asadero", "cevicheria", "panaderia", "heladeria", "bar") } -> "food"
        else -> "other"
    }
    fun color(kind: String): String = when (kind) {
        "cafe" -> "#9A5728"; "hotel" -> "#7253AD"; "food" -> "#D05A2B"; "turismo" -> "#16856B"; else -> "#075BB2"
    }
    fun geoJson(places: List<Place>): String = JSONObject().put("type", "FeatureCollection").put("features",
        JSONArray(places.filter(::located).distinctBy { it.id }.map { place ->
            JSONObject().put("type", "Feature").put("id", place.id)
                .put("geometry", JSONObject().put("type", "Point").put("coordinates", JSONArray(listOf(place.longitude, place.latitude))))
                .put("properties", JSONObject().put("id", place.id).put("title", place.title).put("pin", kind(place)))
        })).toString()
    fun locationJson(latitude: Double, longitude: Double): String {
        require(PlacePolicy.safeCoordinate(latitude, true) != null && PlacePolicy.safeCoordinate(longitude, false) != null)
        return JSONObject().put("type", "FeatureCollection").put("features", JSONArray().put(JSONObject().put("type", "Feature")
            .put("geometry", JSONObject().put("type", "Point").put("coordinates", JSONArray(listOf(longitude, latitude))))
            .put("properties", JSONObject()))).toString()
    }
}
