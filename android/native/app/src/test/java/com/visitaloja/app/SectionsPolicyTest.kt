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
        assertEquals(24, SectionsPolicy.filter("   ", "Todas").size)
        assertEquals(24, SectionsPolicy.sections.map { it.route }.distinct().size)
        assertEquals(listOf("festival"), SectionsPolicy.filter("fiavl", "Descubrir").map { it.route })
    }
    @Test fun backReturnsToSectionsAndPreservesCantonHierarchy() {
        assertEquals("sections", SectionsPolicy.parent("shop", true))
        assertEquals("home", SectionsPolicy.parent("shop", false))
        assertEquals("cantons", SectionsPolicy.parent("canton", true))
        assertEquals("sections", SectionsPolicy.parent("cantons", true))
        assertEquals("home", SectionsPolicy.parent("sections", false))
    }
}
