package com.visitaloja.app

import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

class NativeHttpError(val status: Int, message: String) : IOException(message)
object NativeApi {
    fun post(url: String, token: String, body: JSONObject): JSONObject {
        require(url == "https://www.visitaloja.com/api/chabaquito-ranking?action=notifications" || url == "https://www.visitaloja.com/api/chabaquito-ranking" || url == "https://www.visitaloja.com/api/chabaquito-ranking?action=passport-claim" || url == "https://firestore.googleapis.com/v1/projects/cultura-y-cuchara/databases/(default)/documents:commit")
        val connection = URL(url).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "POST"; connection.instanceFollowRedirects = false
            connection.connectTimeout = 12000; connection.readTimeout = 20000; connection.doOutput = true
            connection.setRequestProperty("Authorization", "Bearer $token")
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
            connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            val input = if (status in 200..299) connection.inputStream else connection.errorStream
            val bytes = ByteArrayOutputStream()
            input?.use { source -> val buffer = ByteArray(4096); while (true) { val n = source.read(buffer); if (n < 0) break; if (bytes.size() + n > 256000) throw IOException("Respuesta demasiado grande."); bytes.write(buffer, 0, n) } }
            val response = try { JSONObject(bytes.toString("UTF-8")) } catch (_: Exception) { JSONObject() }
            if (status !in 200..299) {
                val message = if (url.startsWith("https://www.visitaloja.com/")) response.optString("error").take(400) else ""
                throw NativeHttpError(status, message.ifBlank { "No pudimos confirmar la solicitud. Comprueba la conexión y vuelve a intentar." })
            }
            return response
        } finally { connection.disconnect() }
    }
}
