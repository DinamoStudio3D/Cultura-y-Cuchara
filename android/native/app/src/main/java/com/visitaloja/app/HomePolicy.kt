package com.visitaloja.app


data class HomeCopy(val title: String, val description: String, val badge: String, val searchTitle: String, val placeholder: String, val searchButton: String, val mapButton: String, val routeButton: String)
data class HomePhoto(val photo: LojaPhoto, val x: Float = .5f, val y: Float = .5f)
data class HomeContent(val spanish: HomeCopy = HomePolicy.defaults(false), val english: HomeCopy = HomePolicy.defaults(true), val photos: List<HomePhoto> = emptyList(), val intervalSeconds: Long = 6, val height: Int = 360, val brightness: Float = 1f, val radius: Int = 20)
object HomePolicy {
    fun defaults(english: Boolean) = if (english) HomeCopy("Flavors, Stories & Destinations", "Discover traditional local eateries, specialty coffee shops, hotels and must-see tourist spots through our interactive route.", "Loja is experienced, tasted and hosted", "What would you like to discover?", "Coffee, hotels, local food…", "Search", "Explore the map", "Plan my route") else HomeCopy("Sabores, Historias y Destinos", "Descubre las huecas tradicionales, cafeterías de especialidad, hoteles y rincones turísticos imperdibles a través de nuestra ruta interactiva.", "LOJA SE CONOCE, SE SABOREA Y SE HOSPEDA", "¿Qué quieres descubrir?", "Café, hotel, comida lojana…", "Buscar", "Explorar el mapa", "Planificar mi recorrido")
    private fun number(value: Any?): Float? = when(value) { is Number -> value.toFloat(); is String -> value.toFloatOrNull(); else -> null }?.takeIf { it.isFinite() }
    private fun focus(raw: Any?): Pair<Float, Float>? {
        val map = raw as? Map<*, *> ?: return null
        val x = number(map["x"]) ?: return null; val y = number(map["y"]) ?: return null
        return x.coerceIn(0f,100f)/100 to y.coerceIn(0f,100f)/100
    }
    private fun position(value: Any?): Pair<Float, Float>? {
        val m = Regex("^(\\d{1,3}(?:\\.\\d+)?)% (\\d{1,3}(?:\\.\\d+)?)%$").matchEntire(value as? String ?: return null) ?: return null
        return m.groupValues[1].toFloat().coerceIn(0f,100f)/100 to m.groupValues[2].toFloat().coerceIn(0f,100f)/100
    }
    fun read(raw: Map<String, Any?>, defaults: List<LojaPhoto>): HomeContent {
        val homepage = raw["homepageContent"] as? Map<*, *> ?: emptyMap<Any,Any>()
        val blocks = homepage["blocks"] as? Map<*, *> ?: emptyMap<Any,Any>()
        val actions = blocks["welcomeActions"] as? Map<*, *> ?: emptyMap<Any,Any>()
        val search = blocks["welcomeSearch"] as? Map<*, *> ?: emptyMap<Any,Any>()
        fun field(map: Map<*, *>, key: String, fallback: String, english: Boolean): String {
            val es = (map[key] as? String)?.trim()?.takeIf { it.isNotEmpty() } ?: fallback
            return ((if (english) map[key+"En"] as? String else null)?.trim()?.takeIf { it.isNotEmpty() } ?: es).take(700)
        }
        fun copy(english: Boolean): HomeCopy {
            val d = HomePolicy.defaults(english)
            return HomeCopy(field(raw,"title",d.title,english),field(raw,"subtitle",d.description,english),field(actions,"heroBadge",d.badge,english),field(search,"title",d.searchTitle,english),field(search,"placeholder",d.placeholder,english),field(search,"button",d.searchButton,english).take(40),field(actions,"welcomeMap",d.mapButton,english),field(actions,"welcomeRoute",d.routeButton,english))
        }
        val global = position(raw["heroMobilePosition"]) ?: position(raw["heroBgPosition"]) ?: (.5f to .5f)
        val rows = (raw["photoManagerItems"] as? List<*>)?.filterIsInstance<Map<*, *>>().orEmpty()
        val photos = DiscoveryPolicy.photos(raw, defaults).filter { it.section == "Portada principal" }.take(200).map { photo ->
            val row = rows.firstOrNull { it["id"] == photo.id }
            val f = focus(row?.get("mobileFocus")) ?: focus(row?.get("desktopFocus")) ?: global
            HomePhoto(photo,f.first,f.second)
        }
        val interval = (number(raw["heroIntervalSeconds"])?.takeUnless { it == 0f } ?: 6f).coerceIn(2f,60f).toLong()
        val visibility = number(raw["heroImageOpacity"])?.coerceIn(25f,85f) ?: 55f
        return HomeContent(copy(false),copy(true),photos,interval,when(raw["heroHeight"]){"compact"->300;"standard"->330;else->360},1+(visibility-55)/100,when(raw["cornerStyle"]){"medium"->16;"extra"->28;else->20})
    }
    fun share(photo: LojaPhoto): String = "https://www.visitaloja.com/?foto=${java.net.URLEncoder.encode(photo.id, "UTF-8")}" + if (photo.section == "Portada principal") "#inicio" else "#loja-en-imagenes"
    fun select(photos: List<HomePhoto>, current: String?): String? = photos.firstOrNull { it.photo.id == current }?.photo?.id ?: photos.firstOrNull()?.photo?.id
    fun step(photos: List<HomePhoto>, current: String?, delta: Int): String? {
        if (photos.isEmpty()) return null
        val index = photos.indexOfFirst { it.photo.id == current }.coerceAtLeast(0)
        return photos[Math.floorMod(index + delta, photos.size)].photo.id
    }
}
