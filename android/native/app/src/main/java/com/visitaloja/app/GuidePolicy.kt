package com.visitaloja.app

/** Same guided choices as chabaquito-guide.js; all descriptions come from the public directory. */
internal object GuidePolicy {
    val interests=linkedMapOf("cafe" to "Un cafecito", "food" to "Algo rico", "culture" to "Un paseo", "stay" to "Descansar")
    fun matches(place:Place, interest:String):Boolean {
        if(!PlacePolicy.published(place)||place.categories.any{it=="aliado"})return false
        val words=PlacePolicy.normalize("${place.categories.joinToString(" ")} ${place.title} ${place.description}")
        val pattern=when(interest){
            "cafe"->"cafe|cafeter"
            "food"->"hueca|restaurant|comida|gastronom|urbana|helader|panader|reposter|bar|coctel"
            "culture"->"turismo|cultura|museo|iglesia|parque|histori|fotograf"
            "stay"->"hotel|hostal|hospeda"
            else->return false
        }
        return Regex(pattern).containsMatchIn(words)
    }
    fun candidates(state:PlacesState,interest:String,now:Long):List<Place> {
        if(!RoutePlannerPolicy.fresh(state,now))return emptyList()
        return state.places.filter{matches(it,interest)}.distinctBy{it.id}
            .sortedWith(compareByDescending<Place>{PlaceInfoPolicy.open(it.info,now)==true}.thenBy{it.id})
    }
    fun next(candidates:List<Place>,seen:List<String>):Place? = candidates.firstOrNull{it.id !in seen}
        ?: candidates.firstOrNull{it.id!=seen.lastOrNull()} ?: candidates.firstOrNull()
    fun current(state:PlacesState,interest:String,id:String?,now:Long):Place? = candidates(state,interest,now).firstOrNull{it.id==id}
}
