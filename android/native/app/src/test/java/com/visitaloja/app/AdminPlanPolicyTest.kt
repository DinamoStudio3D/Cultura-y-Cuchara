package com.visitaloja.app

import java.io.File
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class AdminPlanPolicyTest {
    private fun catalog() = JSONObject(File("src/main/assets/admin-plans-catalog.json").readText())
    @Test fun oldOffersUseTheSharedCurrentOfferButConfiguredPricesArePreserved() {
        val c = catalog()
        val old = AdminPlanPolicy.normalized(mapOf("id" to "impulse", "monthly" to 15, "annual" to 150, "extra" to "keep"), c)
        assertEquals(10.0, old["monthly"]); assertEquals(100.0, old["annual"]); assertEquals("Plan Emprendo", old["name"]); assertEquals("keep", old["extra"])
        val current = AdminPlanPolicy.normalized(old + mapOf("monthly" to 12.50, "annual" to 125), c)
        assertEquals(12.50, current["monthly"]); assertEquals(125, current["annual"])
    }
    @Test fun benefitsComeFromTheWebTemplatesAndReflectVariableLimits() {
        val c = catalog(); val plan = AdminPlanPolicy.normalized(mapOf("id" to "featured"), c)
        val changed = plan + ("features" to (AdminPlatformPolicy.map(plan["features"]) + mapOf("maxGalleryImages" to 17, "maxFeaturedProducts" to 9, "analyticsPeriodMonths" to 1)))
        val text = AdminPlanPolicy.benefits(changed, c).joinToString("\n")
        assertTrue(text.contains("Hasta 17 fotografías")); assertTrue(text.contains("Hasta 9 productos")); assertTrue(text.contains("historial de 1 mes,")); assertFalse(text.contains("{months}"))
    }
    @Test fun publishingPreservesUnknownMetadataAndDoesNotIncludeFaqsOrAssignedSubscriptions() {
        val c = catalog(); val base = mapOf<String, Any?>("plans" to listOf(mapOf("id" to "custom", "name" to "Mi plan", "cta" to "Consultar", "monthly" to 25, "annual" to 250, "benefits" to listOf("Beneficio"), "features" to mapOf("futureFeature" to "keep"), "customMetadata" to "keep")), "faqs" to listOf(mapOf("question" to "Q", "answer" to "A")))
        val rows = AdminPlanPolicy.rows(base, c); val groups = AdminPlanPolicy.groups(base, mapOf("subscriptionWhatsapp" to "593999123456"), c, rows)
        val draft = groups.flatMap { it.fields }.associate { it.key to it.fallback }
        val result = AdminPlanPolicy.build(base, rows, draft + ("p|custom|monthly" to "30.50"), groups, c)
        val saved = AdminPhotoPolicy.rows(result.first["plans"]).single()
        assertEquals(30.5, saved["monthly"]); assertEquals("keep", saved["customMetadata"]); assertEquals("keep", AdminPlatformPolicy.map(saved["features"])["futureFeature"])
        assertFalse(result.first.containsKey("faqs")); assertEquals(setOf("showSubscriptions", "showBusinessSignup", "subscriptionWhatsapp"), result.second.keys)
    }
    @Test fun pricesMustBeValidMoneyAndVisibilityRulesAreEnforced() {
        listOf("-1", "1.005", "NaN", "Infinity").forEach { value -> assertThrows(IllegalArgumentException::class.java) { AdminPlanPolicy.money(value) } }
        assertEquals(10.5, AdminPlanPolicy.money("10.50"), 0.0)
        val c = catalog(); val rows = AdminPlanPolicy.rows(emptyMap(), c); val groups = AdminPlanPolicy.groups(emptyMap(), mapOf("subscriptionWhatsapp" to "593999123456"), c, rows)
        val draft = groups.flatMap { it.fields }.associate { it.key to it.fallback }
        val hidden = draft + rows.associate { "p|${it.text("id")}|active" to "false" }
        assertThrows(IllegalArgumentException::class.java) { AdminPlanPolicy.build(emptyMap(), rows, hidden, groups, c) }
        val recommended = draft + mapOf("p|impulse|recommended" to "true", "p|featured|recommended" to "true")
        assertThrows(IllegalArgumentException::class.java) { AdminPlanPolicy.build(emptyMap(), rows, recommended, groups, c) }
    }
}
