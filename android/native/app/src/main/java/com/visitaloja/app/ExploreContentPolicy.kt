package com.visitaloja.app

/** Match only features the place detail can actually expose, with the same video gates. */
internal object ExploreContentPolicy {
    fun video(place: Place, now: Long, fresh: Boolean) = fresh && PlaceMediaPolicy.video(place, now) != null
    fun menu(place: Place) = MenuPolicy.validId(place.menuQrId)
    fun matches(place: Place, filter: String, now: Long, fresh: Boolean): Boolean =
        PlacePolicy.published(place) && when (filter) {
            "video" -> video(place, now, fresh)
            "menu" -> menu(place)
            else -> true
        }
}
