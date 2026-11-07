package com.visitaloja.app

import java.time.LocalDate

internal object FestivalFilterPolicy {
    fun filter(events: List<FestivalEvent>, day: LocalDate?, query: String, savedOnly: Boolean,
        savedIds: Set<String>, freeOnly: Boolean, upcomingOnly: Boolean, category: String?, now: Long): List<FestivalEvent> {
        val words = PlacePolicy.normalize(query).trim().split(Regex("\\s+")).filter(String::isNotBlank)
        return events.filter { event ->
            (!savedOnly || event.id in savedIds) &&
                (savedOnly || words.isNotEmpty() || event.day == day) &&
                (!freeOnly || event.free) && (!upcomingOnly || event.start > now) &&
                (category == null || event.category == category) &&
                words.all { it in PlacePolicy.normalize("${event.title} ${event.category} ${event.place} ${event.description}") }
        }.sortedWith(compareBy<FestivalEvent> { it.start }.thenBy { it.title }.thenBy { it.id })
    }
}
