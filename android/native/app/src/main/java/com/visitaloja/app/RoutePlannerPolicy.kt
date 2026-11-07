package com.visitaloja.app

import java.util.Locale
import kotlin.math.*

data class RouteOrigin(val latitude: Double, val longitude: Double, val label: String)
data class RoutePreferences(val minutes: Int = 60, val category: String = "all", val transport: String = "walk", val intensity: String = "balanced", val openOnly: Boolean = false)
data class SuggestedStop(val id: String, val distanceKm: Double, val travelMinutes: Int, val visitMinutes: Int, val arrivalMinutes: Int)
data class SuggestedRoute(val preferences: RoutePreferences, val origin: RouteOrigin, val stops: List<SuggestedStop>, val distanceKm: Double, val minutes: Int, val generatedAt: Long, val sourceVersion: Long)

/** Uses published directory entries only. Distances are geodesic estimates, not road navigation. */
object RoutePlannerPolicy {
    val centre = RouteOrigin(-3.9931, -79.2042, "Centro de Loja")
    val categories = linkedMapOf("all" to "Un poco de todo", "food" to "Gastronomía", "cafe" to "Cafeterías", "hotel" to "Hospedaje", "turismo" to "Turismo")
    fun valid(origin: RouteOrigin) = PlacePolicy.safeCoordinate(origin.latitude, true) != null && PlacePolicy.safeCoordinate(origin.longitude, false) != null
    fun fresh(state: PlacesState, now: Long) = !state.loading && !state.offline && state.error == null && state.fetchedAt > 0 && now - state.fetchedAt in 0..300_000
    fun eligible(place: Place) = PlacePolicy.published(place) && place.categories.none { it == "aliado" } &&
        "motel" !in PlacePolicy.normalize("${place.title} ${place.categories.joinToString(" ")}") &&
        PlacePolicy.safeCoordinate(place.latitude, true) != null && PlacePolicy.safeCoordinate(place.longitude, false) != null
    fun distance(a: RouteOrigin, b: RouteOrigin): Double {
        val x=Math.toRadians(a.latitude);val y=Math.toRadians(b.latitude)
        val d=Math.toRadians(b.latitude-a.latitude);val l=Math.toRadians(b.longitude-a.longitude)
        val h=(sin(d/2).pow(2)+cos(x)*cos(y)*sin(l/2).pow(2)).coerceIn(0.0,1.0)
        return 6371.0088*2*atan2(sqrt(h),sqrt(1-h))
    }
    fun build(state: PlacesState, preferences: RoutePreferences, origin: RouteOrigin, now: Long): SuggestedRoute? {
        if (!fresh(state,now) || !valid(origin) || preferences.minutes !in setOf(60,240,480) || preferences.category !in categories || preferences.transport !in setOf("walk","drive") || preferences.intensity !in setOf("short","balanced","complete")) return null
        val candidates=state.places.filter {eligible(it)&&PlacePolicy.matches(it,category=preferences.category)}.distinctBy {it.id}.toMutableList()
        val limit=minOf(when(preferences.intensity){"short"->2;"complete"->6;else->4},(preferences.minutes/45).coerceAtLeast(1))
        val speed=if(preferences.transport=="drive")24.0 else 4.5
        var cursor=origin;var minutes=0;var total=0.0;val stops=mutableListOf<SuggestedStop>()
        while(candidates.isNotEmpty()&&stops.size<limit) {
            val sorted=candidates.sortedWith(compareBy<Place>{distance(cursor,RouteOrigin(it.latitude!!,it.longitude!!,it.title))}.thenBy{it.id})
            var chosen: Place?=null;var leg=0.0;var travel=0;var visit=0
            for(place in sorted) {
                val km=distance(cursor,RouteOrigin(place.latitude!!,place.longitude!!,place.title))
                val movement=maxOf(2,(km/speed*60).roundToInt());val stay=if(place.categories.any{it in setOf("hotel","hostal","hospedaje","alojamiento")})20 else 30
                if(minutes+movement+stay>preferences.minutes)continue
                if(preferences.openOnly&&PlaceInfoPolicy.open(place.info,now+(minutes+movement)*60_000L)!=true)continue
                chosen=place;leg=km;travel=movement;visit=stay;break
            }
            val next=chosen?:break
            stops+=SuggestedStop(next.id,leg,travel,visit,minutes+travel)
            total+=leg;minutes+=travel+visit;cursor=RouteOrigin(next.latitude!!,next.longitude!!,next.title);candidates.removeAll{it.id==next.id}
        }
        return SuggestedRoute(preferences,origin,stops,total,minutes,now,state.fetchedVersion)
    }
    fun usable(route: SuggestedRoute, state: PlacesState, now: Long) = fresh(state,now)&&route.sourceVersion==state.fetchedVersion&&now-route.generatedAt in 0..300_000&&route.stops.isNotEmpty()&&route.stops.all {stop->state.places.any{it.id==stop.id&&eligible(it)}}
    fun reconcile(ids: List<String>, places: List<Place>) = ids.distinct().filter {id->places.any{it.id==id&&eligible(it)}}.take(6)
    fun km(value: Double) = if(value<1)"${(value*1000).roundToInt()} m" else String.format(Locale.ROOT,"%.1f km",value)
}
