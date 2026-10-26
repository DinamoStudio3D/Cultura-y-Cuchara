package com.visitaloja.app

import org.json.JSONArray
import org.json.JSONObject

object MapPolicy {
    const val DEFAULT_ZOOM = 14.5
    fun styleJson(): String = JSONObject().put("version", 8).put("name", "VisitaLoja · mapa de la web")
        .put("glyphs", "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf")
        .put("sources", JSONObject().put("osm", JSONObject().put("type", "raster").put("tileSize", 256).put("maxzoom", 19)
            .put("tiles", JSONArray(listOf("https://tile.openstreetmap.org/{z}/{x}/{y}.png")))
            .put("attribution", "© <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap contributors</a>")))
        .put("layers", JSONArray().put(JSONObject().put("id", "osm-base").put("type", "raster").put("source", "osm"))).toString()
    const val LOJA_LAT = -3.99313
    const val LOJA_LNG = -79.20422
    fun located(place: Place): Boolean = PlacePolicy.published(place) &&
        PlacePolicy.safeCoordinate(place.latitude, true) != null &&
        PlacePolicy.safeCoordinate(place.longitude, false) != null &&
        !(place.latitude == 0.0 && place.longitude == 0.0)
    fun filtered(places: List<Place>, query: String, category: String, savedOnly: Boolean, favourites: Set<String>): List<Place> =
        places.filter { located(it) && (if (category == "turismo") it.categories.any { c -> c in setOf("turismo", "entretenimiento", "artesania") } && PlacePolicy.matches(it, query) else PlacePolicy.matches(it, query, category)) && (!savedOnly || it.id in favourites) }.distinctBy { it.id }
    fun kind(place: Place): String = when {
        place.categories.any { it in setOf("hotel", "hostal", "hospedaje", "alojamiento") } -> "hotel"
        "cafe" in place.categories -> "cafe"
        place.categories.any { it in setOf("turismo", "entretenimiento", "artesania") } -> "turismo"
        "aliado" in place.categories -> "partner"
        place.categories.any { it in setOf("restaurante", "hueca", "urbana", "asadero", "cevicheria", "panaderia", "heladeria", "bar") } -> "food"
        else -> "other"
    }
    fun color(kind: String): String = when (kind) {
        "cafe", "food" -> "#f97316"; "hotel" -> "#0ea5e9"; "turismo" -> "#10b981"; "partner" -> "#7c3aed"; else -> "#f59e0b"
    }
    fun logoUrl(place: Place, now: Long = System.currentTimeMillis()): String? {
        val brand = place.mapBrand
        val entitled = brand.paidLogo && (brand.start == null || now >= brand.start) && (brand.end == null || now <= brand.end)
        return PlacePolicy.safeImage(brand.logoUrl)?.takeIf { brand.style != "icon" || entitled }
    }
    fun markerKey(place: Place): String = logoUrl(place)?.let { url ->
        "logo-" + place.id + "-" + java.security.MessageDigest.getInstance("SHA-256").digest(url.toByteArray()).take(8).joinToString("") { "%02x".format(it) }
    } ?: ("icon-" + kind(place) + "-" + glyph(place).codePointAt(0))
    fun glyph(place: Place): String = glyphs[place.mapBrand.iconClass] ?: glyphs[when (kind(place)) {
        "cafe" -> "fa-mug-hot"; "hotel" -> "fa-bed"; "turismo" -> "fa-landmark"; "partner" -> "fa-handshake"; else -> "fa-utensils"
    }]!!
    private val glyphs = mapOf(
        "fa-mug-hot" to "\uf7b6", "fa-coffee" to "\uf0f4", "fa-mug-saucer" to "\uf0f4", "fa-utensils" to "\uf2e7", "fa-cutlery" to "\uf2e7",
        "fa-bed" to "\uf236", "fa-hotel" to "\uf594", "fa-landmark" to "\uf66f", "fa-tree" to "\uf1bb", "fa-mountain" to "\uf6fc", "fa-mountain-sun" to "\ue52f",
        "fa-ice-cream" to "\uf810", "fa-bread-slice" to "\uf7ec", "fa-beer-mug-empty" to "\uf0fc", "fa-beer" to "\uf0fc", "fa-martini-glass-citrus" to "\uf561",
        "fa-martini-glass" to "\uf57b", "fa-glass-martini" to "\uf000", "fa-handshake" to "\uf2b5", "fa-handshake-angle" to "\uf4c4", "fa-store" to "\uf54e",
        "fa-pizza-slice" to "\uf818", "fa-burger" to "\uf805", "fa-hamburger" to "\uf805", "fa-fish" to "\uf578", "fa-shrimp" to "\ue448", "fa-drumstick-bite" to "\uf6d7",
        "fa-church" to "\uf51d", "fa-camera" to "\uf030", "fa-camera-retro" to "\uf083", "fa-monument" to "\uf5a6", "fa-water" to "\uf773", "fa-palette" to "\uf53f",
        "fa-heart" to "\uf004", "fa-location-dot" to "\uf3c5", "fa-map-marker-alt" to "\uf3c5", "fa-mortar-pestle" to "\uf5a7", "fa-fire" to "\uf06d",
        "fa-masks-theater" to "\uf630", "fa-theater-masks" to "\uf630", "fa-music" to "\uf001", "fa-ticket" to "\uf145", "fa-star" to "\uf005",
        "fa-suitcase-rolling" to "\uf5c1", "fa-house" to "\uf015", "fa-home" to "\uf015", "fa-map-location-dot" to "\uf5a0", "fa-shop" to "\uf54f"
    )
    fun geoJson(places: List<Place>): String = JSONObject().put("type", "FeatureCollection").put("features",
        JSONArray(places.filter(::located).distinctBy { it.id }.map { place ->
            JSONObject().put("type", "Feature").put("id", place.id)
                .put("geometry", JSONObject().put("type", "Point").put("coordinates", JSONArray(listOf(place.longitude, place.latitude))))
                .put("properties", JSONObject().put("id", place.id).put("title", place.title.take(38)).put("pin", markerKey(place)))
        })).toString()
    fun locationJson(latitude: Double, longitude: Double): String {
        require(PlacePolicy.safeCoordinate(latitude, true) != null && PlacePolicy.safeCoordinate(longitude, false) != null)
        return JSONObject().put("type", "FeatureCollection").put("features", JSONArray().put(JSONObject().put("type", "Feature")
            .put("geometry", JSONObject().put("type", "Point").put("coordinates", JSONArray(listOf(longitude, latitude))))
            .put("properties", JSONObject()))).toString()
    }
}
