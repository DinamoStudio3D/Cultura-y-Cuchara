package com.visitaloja.app

import kotlin.math.*

data class MapFix(val latitude: Double, val longitude: Double, val accuracy: Float, val elapsedMillis: Long)
enum class MapLocationProblem { NONE, PERMISSION, DISABLED, NO_SIGNAL }
data class MapLocationState(val active: Boolean = false, val precise: Boolean = false, val fix: MapFix? = null, val problem: MapLocationProblem = MapLocationProblem.NONE)

object MapLocationPolicy {
    const val MAX_AGE = 30000L
    fun valid(fix: MapFix, now: Long): Boolean = PlacePolicy.safeCoordinate(fix.latitude, true) != null &&
        PlacePolicy.safeCoordinate(fix.longitude, false) != null && fix.accuracy.isFinite() && fix.accuracy > 0 && fix.accuracy <= 100000 &&
        now - fix.elapsedMillis in 0..MAX_AGE
    fun accept(next: MapFix, previous: MapFix?, now: Long): Boolean {
        if (!valid(next, now)) return false
        if (previous == null || !valid(previous, now)) return true
        if (next.elapsedMillis <= previous.elapsedMillis) return false
        return now - previous.elapsedMillis > 15000 || next.accuracy <= previous.accuracy * 1.5f + 10f
    }
    fun zoom(accuracy: Float): Double = when { accuracy <= 50 -> 17.0; accuracy <= 250 -> 16.0; accuracy <= 2000 -> 14.0; else -> 11.5 }
    /** A geodesic accuracy area in meters, independent of zoom and device density. */
    fun accuracyRing(fix: MapFix): List<List<Double>> {
        val radius = fix.accuracy.toDouble() / 6371008.8
        val latitude = Math.toRadians(fix.latitude); val longitude = Math.toRadians(fix.longitude)
        return (0..64).map { index ->
            val bearing = 2.0 * PI * (index % 64) / 64.0
            val lat = asin((sin(latitude) * cos(radius) + cos(latitude) * sin(radius) * cos(bearing)).coerceIn(-1.0, 1.0))
            val lng = longitude + atan2(sin(bearing) * sin(radius) * cos(latitude), cos(radius) - sin(latitude) * sin(lat))
            listOf((Math.toDegrees(lng) + 540) % 360 - 180, Math.toDegrees(lat))
        }
    }
    fun fitPadding(width: Int, height: Int, density: Float): Int = minOf((48 * density).toInt(), minOf(width, height).coerceAtLeast(0) / 4)
}
