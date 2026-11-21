package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test

class GuidePolicyTest {
    private val now=1_800_000_000_000L
    private fun place(id:String,category:String="cafe",title:String=id,description:String="")=Place(id,title,listOf(category),"Loja",description,null)
    private fun state(vararg places:Place)=PlacesState(places=places.toList(),fetchedAt=now)
    @Test fun guidedChoicesFollowWebCategoriesAndAccentedDescriptions() {
        assertTrue(GuidePolicy.matches(place("a",title="Café"),"cafe"))
        assertTrue(GuidePolicy.matches(place("b",category="urbana"),"food"))
        assertTrue(GuidePolicy.matches(place("c",category="other",description="Museo y fotografía"),"culture"))
        assertTrue(GuidePolicy.matches(place("d",category="hostal"),"stay"))
        assertFalse(GuidePolicy.matches(place("a"),"unknown"))
        assertFalse(GuidePolicy.matches(place("a"),"stay"))
    }
    @Test fun hiddenUnpublishedAndAlliesNeverBecomeSuggestions() {
        val a=place("a")
        val source=state(a,a,place("draft").copy(publicationStatus="draft"),place("inactive").copy(active=false),place("hidden").copy(status="hidden"),place("ally",category="aliado",title="Café aliado"))
        assertEquals(listOf("a"),GuidePolicy.candidates(source,"cafe",now).map{it.id})
    }
    @Test fun confirmedOpenIsPrioritisedWithoutAssumingUnknownHours() {
        val unknown=place("a");val open=place("z").copy(info=PlaceInfo(hours="24 horas"))
        assertEquals(listOf("z","a"),GuidePolicy.candidates(state(unknown,open),"cafe",now).map{it.id})
        assertNull(PlaceInfoPolicy.open(unknown.info,now))
    }
    @Test fun noCachedFailedLoadingOrExpiredRecommendationIsPresentedAsCurrent() {
        val s=state(place("a"))
        listOf(s.copy(offline=true),s.copy(error="offline"),s.copy(loading=true),s.copy(fetchedAt=0),s.copy(fetchedAt=now-300_001),s.copy(fetchedAt=now+1)).forEach {
            assertTrue(GuidePolicy.candidates(it,"cafe",now).isEmpty())
            assertNull(GuidePolicy.current(it,"cafe","a",now))
        }
    }
    @Test fun anotherOptionVisitsEveryCandidateBeforeRepeating() {
        val options=listOf(place("a"),place("b"),place("c"))
        assertEquals("a",GuidePolicy.next(options,emptyList())?.id)
        assertEquals("b",GuidePolicy.next(options,listOf("a"))?.id)
        assertEquals("c",GuidePolicy.next(options,listOf("a","b"))?.id)
        assertEquals("a",GuidePolicy.next(options,listOf("a","b","c"))?.id)
    }
    @Test fun emptyAndSingleCandidateHaveHonestFallbacks() {
        assertNull(GuidePolicy.next(emptyList(),emptyList()))
        assertEquals("a",GuidePolicy.next(listOf(place("a")),listOf("a"))?.id)
        assertTrue(GuidePolicy.candidates(state(place("a")),"stay",now).isEmpty())
    }
    @Test fun withdrawalOrChangedCategoryInvalidatesSelectedPlace() {
        val p=place("a")
        assertEquals(p,GuidePolicy.current(state(p),"cafe","a",now))
        assertNull(GuidePolicy.current(state(p.copy(publicationStatus="draft")),"cafe","a",now))
        assertNull(GuidePolicy.current(state(p.copy(categories=listOf("hotel"))),"cafe","a",now))
    }
    @Test fun suggestionRequiresNeitherCoordinatesNorFavouritesAndDoesNotChangeDirectory() {
        val p=place("a");val s=state(p).copy(favourites=setOf("other"))
        assertEquals(p,GuidePolicy.next(GuidePolicy.candidates(s,"cafe",now),emptyList()))
        assertEquals(setOf("other"),s.favourites);assertEquals(listOf(p),s.places)
        assertNull(p.latitude)
    }
}
