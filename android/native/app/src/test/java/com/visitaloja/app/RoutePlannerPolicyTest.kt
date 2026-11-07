package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test

class RoutePlannerPolicyTest {
    private val now=1_800_000_000_000L
    private val origin=RoutePlannerPolicy.centre
    private fun place(id:String, lat:Double=origin.latitude, lng:Double=origin.longitude, category:String="cafe")=Place(id,id,listOf(category),"Loja","",null,latitude=lat,longitude=lng)
    private fun state(vararg places:Place)=PlacesState(places=places.toList(),fetchedAt=now,fetchedVersion=4)
    private fun build(state:PlacesState,prefs:RoutePreferences=RoutePreferences(minutes=480))=RoutePlannerPolicy.build(state,prefs,origin,now)!!

    @Test fun unpublishedInvalidAndIneligiblePlacesAreExcluded() {
        val a=place("a")
        val result=build(state(a,a,place("draft").copy(publicationStatus="draft"),place("hidden").copy(active=false),place("ally",category="aliado"),place("motel"),place("nan",lat=Double.NaN),place("missing").copy(longitude=null)))
        assertEquals(listOf("a"),result.stops.map{it.id})
    }
    @Test fun noFirstStopCanOverflowTimeBudget() {
        val result=build(state(place("far",lat=origin.latitude+1)),RoutePreferences())
        assertTrue(result.stops.isEmpty());assertEquals(0,result.minutes)
    }
    @Test fun laterCandidateCanFitWhenNearestVisitDoesNot() {
        // 33 min travel + 30 min cafe would overflow; 34 min travel + 20 min lodging fits.
        val result=build(state(place("cafe",lat=origin.latitude+0.022),place("hotel",lat=origin.latitude+0.023,category="hotel")),RoutePreferences())
        assertEquals(listOf("hotel"),result.stops.map{it.id});assertTrue(result.minutes<=60)
    }
    @Test fun maximumStopsAndShortTimeAreEnforced() {
        val state=state(*(1..12).map{place("p$it")}.toTypedArray())
        assertEquals(1,build(state,RoutePreferences()).stops.size)
        assertEquals(2,build(state,RoutePreferences(480,intensity="short")).stops.size)
        assertEquals(4,build(state).stops.size)
        assertEquals(6,build(state,RoutePreferences(480,intensity="complete")).stops.size)
    }
    @Test fun tiesAreStableAndCategoryUsesDirectoryAliases() {
        assertEquals(listOf("a","b"),build(state(place("b"),place("a"))).stops.map{it.id})
        assertEquals(listOf("hotel"),build(state(place("cafe"),place("hotel",category="hostal")),RoutePreferences(480,category="hotel")).stops.map{it.id})
    }
    @Test fun driveAndWalkUseDifferentTravelTimes() {
        val state=state(place("a",lat=origin.latitude+0.05))
        assertTrue(build(state,RoutePreferences(480,transport="drive")).minutes<build(state).minutes)
    }
    @Test fun distanceIsKilometresAndSymmetric() {
        val a=RouteOrigin(0.0,0.0,"");val b=RouteOrigin(1.0,0.0,"")
        assertEquals(111.195,RoutePlannerPolicy.distance(a,b),0.01)
        assertEquals(RoutePlannerPolicy.distance(a,b),RoutePlannerPolicy.distance(b,a),0.000001)
        assertEquals(0.0,RoutePlannerPolicy.distance(a,a),0.0)
    }
    @Test fun staleOfflineLoadingErrorAndFutureSourcesAreRejected() {
        val source=state(place("a"))
        listOf(source.copy(offline=true),source.copy(loading=true),source.copy(error="network"),source.copy(fetchedAt=now-300_001),source.copy(fetchedAt=now+1),source.copy(fetchedAt=0)).forEach {
            assertNull(RoutePlannerPolicy.build(it,RoutePreferences(),origin,now))
        }
    }
    @Test fun invalidSettingsAndOriginAreRejected() {
        val source=state(place("a"))
        listOf(RoutePreferences(minutes=0),RoutePreferences(category="unknown"),RoutePreferences(transport="flight"),RoutePreferences(intensity="unknown")).forEach {
            assertNull(RoutePlannerPolicy.build(source,it,origin,now))
        }
        assertNull(RoutePlannerPolicy.build(source,RoutePreferences(),origin.copy(latitude=91.0),now))
    }
    @Test fun openFilterExcludesUnknownAndChecksArrivalRatherThanDeparture() {
        val departure=java.time.Instant.parse("2026-11-01T14:00:00Z").toEpochMilli() // 09:00 Loja
        val source=state(place("unknown"),place("always").copy(info=PlaceInfo(hours="24/7")),place("arrivesClosed").copy(info=PlaceInfo(openHour=8.0,closeHour=9.016))).copy(fetchedAt=departure)
        val result=RoutePlannerPolicy.build(source,RoutePreferences(480,openOnly=true),origin,departure)!!
        assertEquals(listOf("always"),result.stops.map{it.id})
    }
    @Test fun suggestionIsInvalidatedByRefreshWithdrawalOrExpiry() {
        val source=state(place("a"));val route=build(source)
        assertTrue(RoutePlannerPolicy.usable(route,source,now))
        assertFalse(RoutePlannerPolicy.usable(route,source.copy(fetchedVersion=5),now))
        assertFalse(RoutePlannerPolicy.usable(route,source.copy(places=emptyList()),now))
        assertFalse(RoutePlannerPolicy.usable(route,source.copy(fetchedAt=now+300_001),now+300_001))
    }
    @Test fun localPlanReconcileDoesNotDependOnOrChangeFavourites() {
        val source=state(*(1..8).map{place("p$it")}.toTypedArray()).copy(favourites=setOf("other"))
        val ids=listOf("p1","p1","missing")+(2..8).map{"p$it"}
        assertEquals((1..6).map{"p$it"},RoutePlannerPolicy.reconcile(ids,source.places))
        assertEquals(setOf("other"),source.favourites)
    }
}
