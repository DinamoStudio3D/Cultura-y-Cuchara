package com.visitaloja.app

data class Canton(val id: String, val name: String)
data class CantonRoute(val id: String, val title: String, val duration: String, val notes: String, val placeIds: List<String>)
data class CantonGuide(val tagline: String = "", val description: String = "", val highlights: String = "",
    val cover: String? = null, val credit: String = "", val sections: List<Pair<String, String>> = emptyList(), val featured: List<String> = emptyList(), val routes: List<CantonRoute> = emptyList())

object CantonPolicy {
    val catalogue = listOf("Calvas", "Catamayo", "Celica", "Chaguarpamba", "Espíndola", "Gonzanamá", "Loja", "Macará", "Olmedo", "Paltas", "Pindal", "Puyango", "Quilanga", "Saraguro", "Sozoranga", "Zapotillo")
        .map { Canton(PlacePolicy.normalize(it), it) }
    fun guide(raw: Map<String, Any?>): CantonGuide {
        fun text(key: String, max: Int) = raw.text(key).replace(Regex("<[^>]*>"), "").trim().take(max)
        val source = raw.text("cover")
        val url = if (source.startsWith("assets/") && !source.contains("..")) "https://www.visitaloja.com/$source" else source
        val sections = listOf("history" to "Historia", "culture" to "Cultura y tradiciones", "gastronomy" to "Gastronomía típica", "climate" to "Clima y qué llevar", "festivals" to "Festividades", "arrival" to "Cómo llegar")
            .mapNotNull { (key, title) -> text(key, 2500).takeIf(String::isNotBlank)?.let { title to it } }
        val featured = (raw["featuredIds"] as? List<*>)?.filterIsInstance<String>()?.filter { it.isNotBlank() && it.length <= 128 && '/' !in it }?.distinct()?.take(16) ?: emptyList()
        val routes = (raw["routes"] as? List<*>)?.take(8)?.mapIndexedNotNull { index, item ->
            val row = item as? Map<*, *> ?: return@mapIndexedNotNull null
            fun field(key: String, max: Int) = (row[key] as? String).orEmpty().replace(Regex("<[^>]*>"), "").trim().take(max)
            val title = field("title", 100).takeIf(String::isNotBlank) ?: return@mapIndexedNotNull null
            val ids = (row["placeIds"] as? List<*>)?.filterIsInstance<String>()?.filter { it.isNotBlank() && it.length <= 128 && '/' !in it }?.distinct()?.take(12).orEmpty()
            CantonRoute("route-$index", title, field("duration", 80), field("notes", 1000), ids)
        }.orEmpty()
        return CantonGuide(text("tagline", 120), text("description", 4000), text("highlights", 1500), PlacePolicy.safeImage(url), text("coverCredit", 180), sections, featured, routes)
    }
    fun places(canton: String, records: List<Place>, guide: CantonGuide = CantonGuide(), query: String = "", category: String = "all"): List<Place> {
        require(catalogue.any { it.id == canton })
        return records.filter { place ->
            place.cantonId.trim().ifBlank { "loja" } == canton && PlacePolicy.matches(place, query, category) &&
                !PlacePolicy.normalize(place.title + " " + place.categories.joinToString(" ")).contains("motel")
        }.sortedWith(compareBy<Place> { guide.featured.indexOf(it.id).takeIf { i -> i >= 0 } ?: Int.MAX_VALUE }.thenBy { PlacePolicy.normalize(it.title) })
    }
    fun routeStops(canton: String, route: CantonRoute, records: List<Place>): List<Place> {
        if (route.placeIds.size !in 2..12 || route.placeIds.distinct().size != route.placeIds.size) return emptyList()
        val available = places(canton, records).associateBy { it.id }
        val stops = route.placeIds.mapNotNull { available[it] }
        return stops.takeIf { it.size == route.placeIds.size }.orEmpty()
    }
    fun directions(place: Place): String? {
        val latitude = PlacePolicy.safeCoordinate(place.latitude, true) ?: return null
        val longitude = PlacePolicy.safeCoordinate(place.longitude, false) ?: return null
        return "https://www.google.com/maps/dir/?api=1&destination=$latitude,$longitude"
    }
    fun search(query: String) = catalogue.filter { PlacePolicy.normalize(it.name).contains(PlacePolicy.normalize(query)) }
}
