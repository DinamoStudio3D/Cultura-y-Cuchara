package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test

class CantonPolicyTest {
    private fun place(id: String, canton: String, category: String = "cafe") = Place(id, id, listOf(category), "", "", null, cantonId = canton)
    @Test fun catalogueMatchesAllSixteenWebCantonsAndSearchIgnoresAccents() {
        assertEquals(16, CantonPolicy.catalogue.size)
        assertEquals(16, CantonPolicy.catalogue.map { it.id }.toSet().size)
        assertEquals("gonzanama", CantonPolicy.search("gonzanamá").single().id)
        assertEquals("Espíndola", CantonPolicy.search("espindola").single().name)
    }
    @Test fun explicitAssignmentNeverLeaksIntoLojaAndLegacyBlanksOnlyBelongToLoja() {
        val records = listOf(place("a", "saraguro"), place("b", "loja"), place("old", ""), place("unknown", "other"))
        assertEquals(setOf("b", "old"), CantonPolicy.places("loja", records).map { it.id }.toSet())
        assertEquals(listOf("a"), CantonPolicy.places("saraguro", records).map { it.id })
    }
    @Test fun hiddenAndInactivePlacesAreExcludedEvenWhenFeatured() {
        val records = listOf(place("draft", "loja").copy(publicationStatus = "draft"), place("off", "loja").copy(active = false), place("motel-central", "loja"), place("ok", "loja"))
        assertEquals(listOf("ok"), CantonPolicy.places("loja", records, CantonGuide(featured = listOf("draft", "off"))).map { it.id })
    }
    @Test fun featuredOrderingCannotPullPlacesFromAnotherCantonAndFiltersStayScoped() {
        val records = listOf(place("a", "loja"), place("z", "loja"), place("h", "loja", "hotel"), place("x", "paltas"))
        val guide = CantonGuide(featured = listOf("x", "z"))
        assertEquals(listOf("z", "a"), CantonPolicy.places("loja", records, guide, category = "food").map { it.id })
        assertEquals(listOf("h"), CantonPolicy.places("loja", records, guide, category = "hotel").map { it.id })
    }
    @Test fun guideOnlyIncludesRealTextSafeImagesAndValidFeaturedIds() {
        val guide = CantonPolicy.guide(mapOf("description" to "<b>Cultura</b>", "cover" to "javascript:bad", "history" to "Historia publicada", "featuredIds" to listOf("a", "a", "bad/id", 1)))
        assertEquals("Cultura", guide.description); assertNull(guide.cover)
        assertEquals(listOf("a"), guide.featured)
        assertEquals(listOf("Historia" to "Historia publicada"), guide.sections)
        assertTrue(CantonPolicy.guide(emptyMap()).sections.isEmpty())
    }
}
