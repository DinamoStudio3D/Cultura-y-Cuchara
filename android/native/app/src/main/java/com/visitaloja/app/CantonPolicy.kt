package com.visitaloja.app

data class Canton(val id: String, val name: String)
data class CantonGuide(val tagline: String = "", val description: String = "", val highlights: String = "",
    val cover: String? = null, val credit: String = "", val sections: List<Pair<String, String>> = emptyList(), val featured: List<String> = emptyList())

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
        return CantonGuide(text("tagline", 120), text("description", 4000), text("highlights", 1500), PlacePolicy.safeImage(url), text("coverCredit", 180), sections, featured)
    }
    fun places(canton: String, records: List<Place>, guide: CantonGuide = CantonGuide(), query: String = "", category: String = "all"): List<Place> {
        require(catalogue.any { it.id == canton })
        return records.filter { place ->
            place.cantonId.trim().ifBlank { "loja" } == canton && PlacePolicy.matches(place, query, category) &&
                !PlacePolicy.normalize(place.title + " " + place.categories.joinToString(" ")).contains("motel")
        }.sortedWith(compareBy<Place> { guide.featured.indexOf(it.id).takeIf { i -> i >= 0 } ?: Int.MAX_VALUE }.thenBy { PlacePolicy.normalize(it.title) })
    }
    fun search(query: String) = catalogue.filter { PlacePolicy.normalize(it.name).contains(PlacePolicy.normalize(query)) }
}
