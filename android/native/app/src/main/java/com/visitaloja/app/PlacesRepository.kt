package com.visitaloja.app

import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

class PlacesRepository(private val cacheFile: File, private val fetch: (String) -> String = ::fetchPublicJson, private val clock: () -> Long = System::currentTimeMillis) {
    data class Result(val places: List<Place>, val offline: Boolean, val savedAt: Long, val cacheAvailable: Boolean)
    fun load(): Result {
        return try {
            val places = mutableListOf<Place>()
            val seenTokens = mutableSetOf<String>()
            var token = ""
            do {
                val suffix = if (token.isEmpty()) "" else "&pageToken=" + URLEncoder.encode(token, "UTF-8")
                val page = JSONObject(fetch("https://firestore.googleapis.com/v1/projects/cultura-y-cuchara/databases/(default)/documents/locales?pageSize=100$suffix"))
                val documents = page.optJSONArray("documents") ?: JSONArray()
                for (i in 0 until documents.length()) {
                    documents.optJSONObject(i)?.let(PlaceJson::document)?.let(places::add)
                }
                token = page.optString("nextPageToken", "")
                if (token.isNotEmpty() && (!seenTokens.add(token) || seenTokens.size > 50)) throw IOException("No se pudo completar el directorio.")
            } while (token.isNotEmpty())
            val now = clock()
            val unique = places.distinctBy(Place::id)
            val cached = runCatching { writeCache(unique, now) }.isSuccess
            Result(unique, false, now, cached)
        } catch (failure: IOException) {
            val cached = runCatching { readCache() }.getOrNull()
            cached ?: throw failure
        }
    }
    private fun writeCache(places: List<Place>, time: Long) {
        cacheFile.parentFile?.mkdirs()
        val value = JSONObject().put("version", 1).put("savedAt", time).put("places", JSONArray(places.map(PlaceJson::cachePlace)))
        val temporary = File(cacheFile.parentFile, cacheFile.name + ".tmp")
        temporary.writeText(value.toString())
        if (!temporary.renameTo(cacheFile)) { temporary.delete(); throw IOException("No se pudo guardar la copia local.") }
    }
    private fun readCache(): Result? {
        if (!cacheFile.exists() || cacheFile.length() > 4_000_000) return null
        val value = JSONObject(cacheFile.readText())
        val time = value.optLong("savedAt")
        if (value.optInt("version") != 1 || clock() - time !in 0..604_800_000L) return null
        val array = value.optJSONArray("places") ?: return null
        val places = (0 until array.length()).mapNotNull { array.optJSONObject(it)?.let(PlaceJson::cached) }
        return Result(places, true, time, true)
    }
}
private fun fetchPublicJson(url: String): String {
    val connection = URL(url).openConnection() as HttpURLConnection
    try {
        connection.connectTimeout = 10_000
        connection.readTimeout = 15_000
        connection.setRequestProperty("Accept", "application/json")
        connection.instanceFollowRedirects = false
        val status = connection.responseCode
        if (status in setOf(401, 403)) throw SecurityException("No se pudo acceder al directorio publicado.")
        if (status != 200) throw IOException("El servicio no está disponible temporalmente.")
        val bytes = connection.inputStream.use { input ->
            val output = ByteArrayOutputStream()
            val buffer = ByteArray(8192)
            while (output.size() <= 4_000_000) { val count = input.read(buffer); if (count < 0) break; output.write(buffer, 0, count) }
            output.toByteArray()
        }
        if (bytes.size > 4_000_000) throw IOException("La respuesta del directorio no se pudo procesar.")
        return bytes.toString(Charsets.UTF_8)
    } finally { connection.disconnect() }
}
