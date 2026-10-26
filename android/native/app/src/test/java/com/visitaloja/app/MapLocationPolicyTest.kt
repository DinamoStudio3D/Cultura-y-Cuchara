package com.visitaloja.app

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import kotlin.math.*

class MapLocationPolicyTest {
    private val now = 100000L
    private fun fix(accuracy: Float = 10f, time: Long = now) = MapFix(-3.99, -79.2, accuracy, time)
    @Test fun staleFutureAndInvalidFixesNeverReachMap() {
        assertTrue(MapLocationPolicy.valid(fix(), now))
        assertFalse(MapLocationPolicy.valid(fix(time = now - 30001), now))
        assertFalse(MapLocationPolicy.valid(fix(time = now + 1), now))
        assertFalse(MapLocationPolicy.valid(fix(Float.NaN), now))
        assertFalse(MapLocationPolicy.valid(fix(0f), now))
        assertFalse(MapLocationPolicy.valid(fix().copy(latitude = 91.0), now))
    }
    @Test fun goodGpsIsNotReplacedByAnInaccurateNetworkJump() {
        val gps = fix(time = now - 3000)
        assertFalse(MapLocationPolicy.accept(fix(2000f), gps, now))
        assertTrue(MapLocationPolicy.accept(fix(12f), gps, now))
        assertTrue(MapLocationPolicy.accept(fix(5f), gps, now))
    }
    @Test fun stalePositionCanRecoverAndOutOfOrderCallbacksAreRejected() {
        assertTrue(MapLocationPolicy.accept(fix(500f), fix(time = now - 16000), now))
        assertTrue(MapLocationPolicy.accept(fix(500f), fix(time = now - 40000), now))
        assertFalse(MapLocationPolicy.accept(fix(1f, now - 2000), fix(time = now - 1000), now))
    }
    @Test fun accuracyAreaIsClosedAndUsesRealMeters() {
        val f = fix(125f)
        val ring = MapLocationPolicy.accuracyRing(f)
        assertEquals(65, ring.size)
        assertEquals(ring.first(), ring.last())
        ring.forEach { point ->
            val lat1 = Math.toRadians(f.latitude); val lat2 = Math.toRadians(point[1])
            val dlat = lat2 - lat1; val dlng = Math.toRadians(point[0] - f.longitude)
            val h = sin(dlat / 2).pow(2) + cos(lat1) * cos(lat2) * sin(dlng / 2).pow(2)
            val meters = 6371008.8 * 2 * atan2(sqrt(h), sqrt(1 - h))
            assertEquals(125.0, meters, 0.02)
        }
        val geometry = JSONObject(MapPolicy.accuracyJson(f)).getJSONArray("features").getJSONObject(0).getJSONObject("geometry")
        assertEquals("Polygon", geometry.getString("type"))
        assertEquals(65, geometry.getJSONArray("coordinates").getJSONArray(0).length())
    }
    @Test fun coarseAccuracyDoesNotZoomToStreetPrecision() {
        assertTrue(MapLocationPolicy.zoom(10f) > MapLocationPolicy.zoom(2000f))
        assertTrue(MapLocationPolicy.zoom(5000f) < 14)
    }
    @Test fun fitPaddingAlwaysLeavesSpaceOnShortOrNarrowMaps() {
        assertEquals(7, MapLocationPolicy.fitPadding(300, 30, 3f))
        assertEquals(5, MapLocationPolicy.fitPadding(20, 400, 3f))
        assertEquals(144, MapLocationPolicy.fitPadding(1080, 600, 3f))
        assertEquals(0, MapLocationPolicy.fitPadding(0, 400, 3f))
    }
    @Test fun approximationAndFreshnessRemainSeparate() {
        assertTrue(MapLocationPolicy.valid(fix(5000f), now))
        assertFalse(MapLocationPolicy.valid(fix(5f, now - 31000), now))
    }
}
