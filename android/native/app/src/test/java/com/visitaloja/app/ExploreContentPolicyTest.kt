package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test

class ExploreContentPolicyTest {
    private val place = Place("cafe", "Cafetería", listOf("cafe"), "Loja", "", null,
        menuQrId = "menu_123", media = PlaceMedia(video = "https://www.youtube.com/watch?v=dQw4w9WgXcQ", paidVideo = true, start = 100, end = 200))

    @Test fun videoFilterFollowsDetailEntitlementsDatesAndFreshness() {
        assertTrue(ExploreContentPolicy.matches(place, "video", 150, true))
        assertFalse(ExploreContentPolicy.matches(place, "video", 150, false))
        assertFalse(ExploreContentPolicy.matches(place, "video", 99, true))
        assertFalse(ExploreContentPolicy.matches(place, "video", 201, true))
        assertFalse(ExploreContentPolicy.matches(place.copy(media = place.media.copy(paidVideo = false)), "video", 150, true))
        assertFalse(ExploreContentPolicy.matches(place.copy(media = place.media.copy(validWindow = false)), "video", 150, true))
    }

    @Test fun menuFilterRequiresValidRegisteredIdAndAllStillShowsPlacesWithoutMedia() {
        assertTrue(ExploreContentPolicy.matches(place, "menu", 150, false))
        assertFalse(ExploreContentPolicy.matches(place.copy(menuQrId = "../other"), "menu", 150, true))
        assertFalse(ExploreContentPolicy.matches(place.copy(menuQrId = null), "menu", 150, true))
        assertTrue(ExploreContentPolicy.matches(place.copy(menuQrId = null, media = PlaceMedia()), "all", 150, false))
    }

    @Test fun contentFiltersNeverRevealUnpublishedPlaces() {
        listOf("all", "video", "menu").forEach { filter ->
            assertFalse(ExploreContentPolicy.matches(place.copy(active = false), filter, 150, true))
            assertFalse(ExploreContentPolicy.matches(place.copy(publicationStatus = "draft"), filter, 150, true))
        }
    }
}
