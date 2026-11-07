package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test

class NearbyPolicyTest {
    private val elapsed = 100000L
    private val wall = 1800000000000L
    private val fix = MapFix(-4.0, -79.2, 10f, elapsed)
    private fun place(meters: Double = 0.0) = Place("a", "Codeproim", listOf("aliado"), "", "", null,
        latitude = fix.latitude + Math.toDegrees(meters / 6371008.8), longitude = fix.longitude)
    private fun can(p: Place = place(), f: MapFix = fix, catalog: Long = wall, last: Long? = null) = NearbyPolicy.canNotify(p, f, elapsed, wall, catalog, last)
    @Test fun actualSixtyMeterBoundaryUsesDistanceNotRoundedLabel() {
        assertTrue(can(place(59.9)))
        assertFalse(can(place(60.1)))
        assertEquals(60.0, NearbyPolicy.distance(fix, place(60.0)), 0.001)
    }
    @Test fun badStaleAndFutureGpsNeverNotify() {
        assertFalse(can(f = fix.copy(accuracy = Float.NaN)))
        assertFalse(can(f = fix.copy(accuracy = 61f)))
        assertFalse(can(f = fix.copy(accuracy = 0f)))
        assertFalse(can(f = fix.copy(elapsedMillis = elapsed - 120001)))
        assertFalse(can(f = fix.copy(elapsedMillis = elapsed + 1)))
        assertFalse(can(f = fix.copy(latitude = 91.0)))
    }
    @Test fun hiddenDraftAndUnlocatedStopsNeverNotify() {
        assertFalse(can(place().copy(active = false)))
        assertFalse(can(place().copy(publicationStatus = "draft")))
        assertFalse(can(place().copy(status = "deleted")))
        assertFalse(can(place().copy(latitude = null)))
        assertFalse(can(place().copy(latitude = 0.0, longitude = 0.0)))
    }
    @Test fun duplicateAlertsHaveThirtyMinuteCooldownAndClockRollbackIsConservative() {
        assertTrue(can())
        assertFalse(can(last = wall - NearbyPolicy.COOLDOWN + 1))
        assertTrue(can(last = wall - NearbyPolicy.COOLDOWN))
        assertFalse(can(last = wall + 100))
    }
    @Test fun staleCatalogAndFutureCatalogCannotSendOldStopAlerts() {
        assertFalse(can(catalog = wall - NearbyPolicy.CATALOG_AGE - 1))
        assertFalse(can(catalog = wall + 1))
        assertTrue(can(catalog = wall - NearbyPolicy.CATALOG_AGE))
    }
    @Test fun catalogHonorsAndroidLimitAndPublicationBeforeTruncating() {
        val rows = (1..110).map { place().copy(id = "%03d".format(it)) }
        val eligible = NearbyPolicy.eligible(rows.reversed() + rows + place().copy(id = "hidden", active = false))
        assertEquals(100, eligible.size)
        assertEquals(100, eligible.map { it.id }.distinct().size)
        assertEquals("001", eligible.first().id)
        assertEquals("100", eligible.last().id)
    }
}
