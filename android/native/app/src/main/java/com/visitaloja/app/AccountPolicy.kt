package com.visitaloja.app

/** The web owns this document too. Never reset its itinerary, agenda or passport fields. */
object AccountPolicy {
    const val favouriteLimit = 150
    fun favourites(data: Map<String, Any?>?): Set<String> =
        (data?.get("favorites") as? List<*>)?.filterIsInstance<String>()?.filter { it.isNotBlank() }?.toSet() ?: emptySet()

    fun update(uid: String, data: Map<String, Any?>?, ids: Set<String>, timestamp: Any): Map<String, Any?> {
        require(uid.isNotBlank())
        require(ids.size <= favouriteLimit) { "Puedes guardar hasta 150 favoritos." }
        require(ids.none { it.isBlank() || '/' in it })
        if (data != null) require(data["uid"] == uid) { "La cuenta no coincide." }
        return (data ?: mapOf("uid" to uid, "savedAgendaEvents" to emptyList<String>(),
            "savedFestivalEvents" to emptyList<String>(), "routeLocationIds" to emptyList<String>(), "passportMode" to "turista")) +
            mapOf("favorites" to ids.toList(), "updatedAt" to timestamp)
    }
}
