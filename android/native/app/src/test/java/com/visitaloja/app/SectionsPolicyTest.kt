package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test

class SectionsPolicyTest {
    @Test fun searchIgnoresAccentsAndCaseAndMatchesEveryWord() {
        assertEquals(listOf("photos"), SectionsPolicy.filter("FOTOGRAFIAS autores", "Todas").map { it.route })
        assertEquals(listOf("passport"), SectionsPolicy.filter("sellos", "Todas").map { it.route })
        assertTrue(SectionsPolicy.filter("sellos videos", "Todas").isEmpty())
    }
    @Test fun filterCombinesGroupAndSearchWithoutFallingBackToOtherGroups() {
        assertEquals(5, SectionsPolicy.filter("", "Tu aventura").size)
        assertTrue(SectionsPolicy.filter("videos", "Tu aventura").isEmpty())
        assertEquals(25, SectionsPolicy.filter("   ", "Todas").size)
        assertEquals(25, SectionsPolicy.sections.map { it.route }.distinct().size)
        assertEquals(listOf("festival"), SectionsPolicy.filter("fiavl", "Descubrir").map { it.route })
    }
    @Test fun backReturnsToSectionsAndPreservesCantonHierarchy() {
        assertEquals("sections", SectionsPolicy.parent("shop", true))
        assertEquals("home", SectionsPolicy.parent("shop", false))
        assertEquals("cantons", SectionsPolicy.parent("canton", true))
        assertEquals("sections", SectionsPolicy.parent("cantons", true))
        assertEquals("home", SectionsPolicy.parent("sections", false))
    }
    @Test fun translatedDirectoryKeepsRoutesGroupsAndSpanishSearch() {
        val es = SectionsPolicy.filter("", "Todas")
        val en = SectionsPolicy.filter("", "Todas", true)
        assertEquals(es.map { it.route }, en.map { it.route })
        assertEquals(es.map { it.group }, en.map { it.group })
        assertEquals("Passport and loyalty", SectionsPolicy.filter("sellos", "Todas", true).single().title)
        assertEquals(listOf("passport"), SectionsPolicy.filter("stamps rewards", "Todas").map { it.route })
        assertEquals(listOf("postcards"), SectionsPolicy.filter("postcards", "Todas", true).map { it.route })
        assertTrue(SectionsPolicy.filter("postcards", "Tu aventura", true).isEmpty())
        assertEquals("Your adventure", SectionsPolicy.groupLabel("Tu aventura", true))
        assertEquals(es.first(), SectionsPolicy.localize(es.first(), false))
    }
    @Test fun languagePreferenceAcceptsOnlySupportedEnglishAndDefaultsToSpanish() {
        assertEquals("es", LanguagePolicy.normalize(null))
        assertEquals("es", LanguagePolicy.normalize("fr"))
        assertEquals("es", LanguagePolicy.normalize("en-US"))
        assertEquals("en", LanguagePolicy.normalize(" EN "))
        assertEquals("en", LanguagePolicy.choose(true))
        assertEquals("es", LanguagePolicy.choose(false))
    }

}
