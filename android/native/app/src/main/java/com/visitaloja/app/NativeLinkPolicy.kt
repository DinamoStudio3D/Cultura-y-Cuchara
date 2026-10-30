package com.visitaloja.app

import java.net.URI
import java.net.URLDecoder
import java.util.Locale

internal data class NativeLinkRequest(val id: String, val text: String)
internal data class NativeLinkTarget(val route: String, val place: String? = null, val category: String = "all")
internal object NativeLinkPolicy {
    private val sections = mapOf("" to "home", "inicio" to "home", "mapa" to "map", "agenda" to "agenda", "fiavl" to "agenda", "misiones" to "missions", "pasaporte" to "passport", "promociones" to "promotions", "historias" to "stories", "emprendedores" to "enterprises", "loja-en-video" to "videos", "loja-tiempo" to "time", "loja-en-imagenes" to "photos", "podcast" to "podcast", "tienda" to "shop", "postales" to "postcards", "especias" to "shop", "establecimientos" to "explore", "categorias" to "explore", "registeredBrands" to "supporters")
    private val categories = mapOf("/cafeterias-en-loja" to "cafe", "/hoteles-en-loja" to "hotel", "/restaurantes-en-loja" to "food", "/huecas-en-loja" to "hueca", "/panaderias-en-loja" to "panaderia", "/heladerias-en-loja" to "heladeria", "/bares-en-loja" to "bar", "/artesanias-en-loja" to "artesania", "/que-hacer-en-loja" to "turismo")
    private fun id(value: String) = value.takeIf { it.length in 1..120 && Regex("[A-Za-z0-9_-]+").matches(it) }
    fun parse(value: String): NativeLinkTarget? = try {
        if (value.length !in 1..2048 || value.any { it.isWhitespace() || it.isISOControl() || it == '\\' }) null
        else {
            val u = URI(value)
            if (u.scheme != "https" || u.host?.lowercase(Locale.ROOT) !in setOf("visitaloja.com", "www.visitaloja.com") || u.port != -1 || u.userInfo != null || u.rawPath != u.path) null
            else {
                val pairs = u.rawQuery.orEmpty().split('&').filter(String::isNotBlank).map { it.split('=', limit = 2).let { p -> URLDecoder.decode(p[0], "UTF-8") to URLDecoder.decode(p.getOrElse(1) { "" }, "UTF-8") } }
                val keys = pairs.filter { it.first in setOf("checkin", "lugar", "place", "qr") }
                val path = u.path.ifBlank { "/" }
                when {
                    keys.any { it.first == "qr" } || keys.size > 1 -> null
                    Regex("/parada/[A-Za-z0-9_-]+/?").matches(path) && keys.isEmpty() -> id(path.trimEnd('/').substringAfterLast('/'))?.let { NativeLinkTarget("explore", it) }
                    path == "/" && keys.size == 1 && keys[0].first in setOf("checkin", "lugar") -> id(keys[0].second)?.let { NativeLinkTarget("explore", it) }
                    path == "/fidelidad.html" && keys.size == 1 && keys[0].first == "place" -> id(keys[0].second)?.let { NativeLinkTarget("explore", it) }
                    keys.isNotEmpty() -> null
                    path == "/" -> sections[u.fragment.orEmpty()]?.let { NativeLinkTarget(it) }
                    path == "/mesa-turistica.html" -> NativeLinkTarget("mesa")
                    path == "/cantones.html" -> NativeLinkTarget("cantons")
                    path == "/agenda.html" -> NativeLinkTarget("agenda")
                    path == "/loja-en-el-tiempo.html" -> NativeLinkTarget("time")
                    path == "/fidelidad.html" -> NativeLinkTarget("passport")
                    path in categories -> NativeLinkTarget("explore", category = categories.getValue(path))
                    else -> null
                }
            }
        }
    } catch (_: Exception) { null }
    fun shared(text: String): NativeLinkTarget? {
        if (text.length !in 1..4096 || text.any { it.isISOControl() && it !in "\n\r\t" }) return null
        val urls = Regex("https?://[^\\s<>]+", RegexOption.IGNORE_CASE).findAll(text).map { it.value.trimEnd('.', ',', ';', '!', '?', ')', ']', '"', '\'') }.toList()
        return urls.singleOrNull()?.let(::parse)
    }
    fun ready(state: PlacesState, requiredVersion: Long): Boolean = !state.loading && !state.offline && state.error == null && state.fetchedAt > 0 && state.fetchedVersion >= requiredVersion
    fun place(places: List<Place>, reference: String): Place? {
        val published = places.filter(PlacePolicy::published)
        val exact = published.filter { it.id == reference }
        if (exact.isNotEmpty()) return exact.singleOrNull()
        return published.filter { URI(PlacePolicy.publicUrl(it)).path.substringAfterLast('/') == reference.lowercase(Locale.ROOT) }.singleOrNull()
    }
}
