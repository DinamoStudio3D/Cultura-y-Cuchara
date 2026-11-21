package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class PersonalVisitsPolicyTest {
    private val now = Instant.parse("2026-11-13T02:00:00Z").toEpochMilli()
    @Test fun combinesLojaDatesStatusAndAccentInsensitiveSearch() {
        val confirmed = mapOf("id" to "a", "status" to "confirmed", "placeName" to "Café Bolívar", "confirmedAt" to now - 1000, "purchaseAmount" to 5.0)
        val reversed = mapOf("id" to "b", "status" to "reversed", "placeName" to "Café Bolívar", "confirmedAt" to now - 2000, "reversedAt" to now, "purchaseAmount" to 100.0, "reversalReason" to "Visita duplicada")
        val old = mapOf("id" to "c", "status" to "confirmed", "placeName" to "Café Bolívar", "confirmedAt" to now - 86400000, "purchaseAmount" to 8.0)
        val rows = listOf(old, reversed, confirmed)
        val today = PersonalVisitsPolicy.filter(rows, "cafe bolivar", null, "today", now)
        assertEquals(listOf("a", "b"), today.map { it["id"] })
        assertEquals(5.0, PersonalVisitsPolicy.confirmedSpend(today), 0.001)
        assertEquals(listOf("b"), PersonalVisitsPolicy.filter(rows, "duplicada", "reversed", "all", now).map { it["id"] })
        assertTrue(PersonalVisitsPolicy.filter(rows, "otro", null, "all", now).isEmpty())
    }
    @Test fun totalsIgnoreUnconfirmedAndInvalidConsumption() {
        val rows = listOf(mapOf("status" to "pending", "purchaseAmount" to 20), mapOf("status" to "confirmed", "purchaseAmount" to -5), mapOf("status" to "confirmed", "purchaseAmount" to Double.NaN), mapOf("status" to "confirmed", "purchaseAmount" to 3))
        assertEquals(3.0, PersonalVisitsPolicy.confirmedSpend(rows), 0.001)
    }
}
