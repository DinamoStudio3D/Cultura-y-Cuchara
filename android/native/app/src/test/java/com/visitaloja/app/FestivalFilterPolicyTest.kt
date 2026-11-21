package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test
import java.time.LocalDate
import java.time.LocalTime

class FestivalFilterPolicyTest {
    private val day = LocalDate.of(2026, 11, 12)
    private fun event(id: String, date: LocalDate = day, hour: Int = 18, free: Boolean = true, category: String = "Teatro") =
        FestivalEvent(id, "Función $id", date, LocalTime.of(hour, 0), category, "Teatro Bolívar", "Arte para todos", free, null, null, false, "", null, null)
    @Test fun savedSearchHonorsEveryFilterAndDoesNotDependOnSelectedDay() {
        val a = event("a", day.plusDays(1))
        val b = event("b", free = false)
        val c = event("c", category = "Música")
        val now = event("early", hour = 10).start
        assertEquals(listOf("a"), FestivalFilterPolicy.filter(listOf(b, a, c), day, "bolivar arte", true, setOf("a", "b"), true, true, "Teatro", now).map { it.id })
        assertTrue(FestivalFilterPolicy.filter(listOf(a), day, "no existe", true, setOf("a"), false, false, null, now).isEmpty())
        assertTrue(FestivalFilterPolicy.filter(listOf(a), day, "", true, emptySet(), false, false, null, now).isEmpty())
    }
    @Test fun normalBrowsingUsesSelectedDayAndSearchSpansFestival() {
        val today = event("a")
        val tomorrow = event("b", day.plusDays(1))
        assertEquals(listOf("a"), FestivalFilterPolicy.filter(listOf(tomorrow, today), day, "", false, emptySet(), false, false, null, 0).map { it.id })
        assertEquals(listOf("a", "b"), FestivalFilterPolicy.filter(listOf(tomorrow, today), null, "funcion", false, emptySet(), false, false, null, 0).map { it.id })
        assertTrue(FestivalFilterPolicy.filter(listOf(today), day, "", false, emptySet(), false, true, null, today.start).isEmpty())
        assertTrue(FestivalFilterPolicy.filter(listOf(today), null, "", false, emptySet(), false, false, null, 0).isEmpty())
    }
}
