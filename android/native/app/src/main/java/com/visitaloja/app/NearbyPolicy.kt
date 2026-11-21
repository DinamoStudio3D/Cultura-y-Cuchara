package com.visitaloja.app

import kotlin.math.*

object NearbyPolicy {
    const val RADIUS = 60f
    const val COOLDOWN = 30 * 60 * 1000L
    const val CATALOG_AGE = 7 * 24 * 60 * 60 * 1000L
    const val MAX_PLACES = 100 // Google Play services geofence limit per app/device user.
    const val REFRESH_AFTER = 6 * 60 * 60 * 1000L
    fun registrationFresh(now: Long, registeredAt: Long, expiresAt: Long, sameCatalog: Boolean, force: Boolean): Boolean =
        !force && sameCatalog && now - registeredAt in 0 until REFRESH_AFTER && expiresAt - now > REFRESH_AFTER
    fun distance(fix: MapFix, place: Place): Double {
        if (!MapPolicy.located(place)) return Double.POSITIVE_INFINITY
        val lat = Math.toRadians(fix.latitude); val other = Math.toRadians(place.latitude!!)
        val a = sin((other - lat) / 2).pow(2) + cos(lat) * cos(other) * sin(Math.toRadians(place.longitude!! - fix.longitude) / 2).pow(2)
        return 6371008.8 * 2 * asin(sqrt(a.coerceIn(0.0, 1.0)))
    }
    fun foodStop(place: Place): Boolean = MapPolicy.located(place) && "aliado" !in place.categories && PlacePolicy.matches(place, category = "food")
    fun eligible(places: List<Place>): List<Place> = places.filter(::foodStop).distinctBy { it.id }.sortedBy { it.id }.take(MAX_PLACES)
    fun canNotify(place: Place, fix: MapFix, elapsed: Long, wall: Long, catalogAt: Long, lastAlert: Long?): Boolean =
        foodStop(place) && PlacePolicy.safeCoordinate(fix.latitude, true) != null && PlacePolicy.safeCoordinate(fix.longitude, false) != null &&
        elapsed - fix.elapsedMillis in 0..120000 && fix.accuracy.isFinite() && fix.accuracy > 0 && fix.accuracy <= 60 &&
        distance(fix, place) <= RADIUS && wall - catalogAt in 0..CATALOG_AGE &&
        (lastAlert == null || wall - lastAlert >= COOLDOWN)
}
