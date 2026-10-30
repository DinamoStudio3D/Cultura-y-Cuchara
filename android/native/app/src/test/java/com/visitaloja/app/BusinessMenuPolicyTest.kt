package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class BusinessMenuPolicyTest {
    private val now = Instant.parse("2026-10-30T17:00:00Z").toEpochMilli()
    private val dish = mapOf("name" to "Café lojano", "nameEn" to "Loja coffee", "price" to "$2.25", "category" to "Bebidas", "categoryEn" to "Drinks", "description" to "Café de Loja", "image" to "https://cdn.example/coffee.webp")
    private val raw = mapOf<String, Any?>("title" to "Café Central", "titleEn" to "Central Cafe", "subscription" to mapOf("plan" to "featured", "status" to "active", "benefits" to mapOf("menu" to true)), "menu" to mapOf("active" to true, "dishes" to listOf(dish)), "commerce" to mapOf("whatsapp" to "0991234567", "orderActive" to true, "reservationActive" to true))
    private fun menu(input: Map<String, Any?> = raw, plans: Map<String, Int> = BusinessMenuPolicy.limits(emptyMap()), at: Long = now, fresh: Boolean = true) = BusinessMenuPolicy.catalogue(BusinessMenuPolicy.source("place", input), plans, at, fresh)!!
    @Test fun readsTheExistingAdminFieldsAndBilingualCategories() {
        val menu = menu()
        assertEquals("593991234567", menu.phone);assertTrue(menu.orders);assertTrue(menu.reservations)
        assertEquals("Café lojano", menu.dishes.single().name)
        assertEquals(1, BusinessMenuPolicy.filter(menu.dishes, "CAFE bebidas", "Bebidas", false).size)
        assertEquals(1, BusinessMenuPolicy.filter(menu.dishes, "coffee", "Drinks", true).size)
        assertTrue(BusinessMenuPolicy.filter(menu.dishes, "coffee", "Postres", false).isEmpty())
    }
    @Test fun requiresPublishedPlaceAndValidPaidMenuBenefit() {
        assertNull(BusinessMenuPolicy.catalogue(BusinessMenuPolicy.source("place", raw + mapOf("publicationStatus" to "draft")), emptyMap(), now, true))
        for (sub in listOf(mapOf("plan" to "free", "benefits" to mapOf("menu" to true)), mapOf("plan" to "featured", "status" to "expired", "benefits" to mapOf("menu" to true)), mapOf("plan" to "featured", "benefits" to mapOf("menu" to false)))) assertTrue(menu(raw + mapOf("subscription" to sub)).dishes.isEmpty())
        assertTrue(menu(fresh = false).dishes.isEmpty())
        // Commerce switches are independent of a paid product listing, as on the website.
        assertTrue(menu(raw + mapOf("subscription" to mapOf("plan" to "free"))).orders)
    }
    @Test fun dateOnlyEndIncludesTheWholeEcuadorDayAndMalformedWindowsFailClosed() {
        val sub = mapOf("plan" to "featured", "benefits" to mapOf("menu" to true), "startAt" to "2026-10-30", "endAt" to "2026-10-30")
        val input = raw + mapOf("subscription" to sub)
        assertEquals(1, menu(input, at = Instant.parse("2026-10-31T04:59:59Z").toEpochMilli()).dishes.size)
        assertTrue(menu(input, at = Instant.parse("2026-10-31T05:00:00Z").toEpochMilli()).dishes.isEmpty())
        assertTrue(menu(raw + mapOf("subscription" to sub + mapOf("startAt" to "2026-02-31"))).dishes.isEmpty())
        assertTrue(menu(raw + mapOf("subscription" to sub + mapOf("endAt" to mapOf("bad" to true)))).dishes.isEmpty())
        assertTrue(menu(raw + mapOf("subscription" to sub + mapOf("startAt" to "2026-11-01"))).dishes.isEmpty())
    }
    @Test fun limitsHonorModernConfigurationAndUpgradeLegacyKnownPlans() {
        val legacy = BusinessMenuPolicy.limits(mapOf("plans" to listOf(mapOf("id" to "destacado", "features" to mapOf("maxFeaturedProducts" to 1)))))
        assertEquals(10, legacy["featured"])
        val modern = BusinessMenuPolicy.limits(mapOf("plans" to listOf(mapOf("id" to "featured", "offerVersion" to 1, "features" to mapOf("maxFeaturedProducts" to 2)))))
        val input = raw + mapOf("menu" to mapOf("active" to true, "dishes" to (1..30).map { dish + mapOf("name" to "Plato $it") }))
        assertEquals(10, menu(input).dishes.size);assertEquals(2, menu(input, modern).dishes.size)
        assertEquals(0, menu(input, mapOf("featured" to 0)).dishes.size)
    }
    @Test fun disabledProductsAndUnsafeMediaOrContactsNeverProduceAnOrder() {
        val input = raw + mapOf("menu" to mapOf("active" to true, "dishes" to listOf(dish + mapOf("available" to "false", "image" to "javascript:alert(1)", "recommended" to true))))
        val menu = menu(input);val item = menu.dishes.single()
        assertFalse(item.available);assertNull(item.image);assertEquals(listOf("Recomendado"), item.tags)
        assertNotNull(BusinessMenuPolicy.error(menu, BusinessRequest(dish = item.key), now))
        val noPhone = menu(raw + mapOf("commerce" to mapOf("whatsapp" to "not a number", "orderActive" to true)))
        assertFalse(noPhone.orders);assertNull(noPhone.phone)
    }
    @Test fun reservationRequiresRealFutureEcuadorDateTimeAndBoundedParty() {
        val menu = menu();val valid = BusinessRequest(reservation = true, date = "2026-10-30", time = "13:00", guests = 2)
        assertNull(BusinessMenuPolicy.error(menu, valid, now))
        for (bad in listOf(valid.copy(date = "2026-02-31"), valid.copy(time = "25:00"), valid.copy(time = "11:59"), valid.copy(guests = 0), valid.copy(guests = 31))) assertNotNull(BusinessMenuPolicy.error(menu, bad, now))
        assertNotNull(BusinessMenuPolicy.error(menu.copy(reservations = false), valid, now))
    }
    @Test fun previewUsesExactPublishedPriceAndNeverClaimsPaymentOrConfirmation() {
        val menu = menu();val draft = BusinessRequest(dish = "0", quantity = 3, notes = "Sin azúcar", english = true)
        assertNull(BusinessMenuPolicy.error(menu, draft, now))
        val text = BusinessMenuPolicy.message(menu, draft)
        assertTrue(text.contains("3 × Loja coffee"));assertTrue(text.contains("$2.25"));assertTrue(text.contains("Sin azúcar"));assertTrue(text.contains("Central Cafe"));assertTrue(text.contains("Please confirm availability"))
        assertFalse(text.contains("$6.75"))
        assertNotNull(BusinessMenuPolicy.error(menu, draft.copy(quantity = 21), now))
        assertNotNull(BusinessMenuPolicy.error(menu, draft.copy(notes = "x".repeat(1001)), now))
    }
    @Test fun withdrawalPhonePriceAndAvailabilityChangesInvalidateReviewedCatalogue() {
        val before = menu()
        for (change in listOf(raw + mapOf("commerce" to mapOf("whatsapp" to "0981234567", "orderActive" to true)), raw + mapOf("menu" to mapOf("active" to true, "dishes" to listOf(dish + mapOf("price" to "$3.00")))), raw + mapOf("menu" to mapOf("active" to false)))) assertNotEquals(before, menu(change))
        assertEquals(before, menu())
    }
    @Test fun reservationRemovesOnlyLegacyEmptyDateTimePartyBoilerplate() {
        val draft = BusinessRequest(reservation = true, date = "2026-11-01", time = "19:00", guests = 3)
        val base = menu().copy(reservationEs = "Hola, reservo en {negocio}. Fecha: ___ Hora: ___ Personas: ___", reservationEn = "Hello {negocio}. Date: ___ Time: ___ Guests: ___")
        for (english in listOf(false, true)) {
            val message = BusinessMenuPolicy.message(base, draft.copy(english = english))
            assertFalse(message.contains("___"));assertTrue(message.contains("2026-11-01"));assertTrue(message.contains("19:00"))
        }
        assertTrue(BusinessMenuPolicy.message(base.copy(reservationEs = "Zona: ___ Necesito asistencia."), draft).contains("Zona: ___ Necesito asistencia."))
    }
}
