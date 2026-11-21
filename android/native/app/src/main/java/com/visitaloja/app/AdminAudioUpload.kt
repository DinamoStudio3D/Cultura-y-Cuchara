package com.visitaloja.app

import android.content.Context
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import android.provider.OpenableColumns
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

internal object AdminAudioUpload {
    suspend fun upload(context: Context, uri: Uri, uid: String, purpose: String = "story"): String {
        require(purpose in setOf("story", "time"))
        val expectedFolder = if (purpose == "time") "visitaloja/time/audio" else "visitaloja/stories/audio"
        val user = FirebaseAuth.getInstance().currentUser?.takeIf { it.uid == uid } ?: error("La sesión cambió.")
        val token = user.getIdToken(false).await().token ?: error("Inicia sesión nuevamente.")
        return withContext(Dispatchers.IO) {
            val bytes = context.contentResolver.openInputStream(uri)?.use { input ->
                val out = ByteArrayOutputStream(); val buffer = ByteArray(8192)
                while (true) { val n = input.read(buffer); if (n < 0) break; require(out.size() + n <= 20 * 1024 * 1024) { "El audio debe pesar como máximo 20 MB." }; out.write(buffer, 0, n) }; out.toByteArray()
            } ?: error("No se pudo abrir el audio.")
            require(bytes.isNotEmpty()) { "El archivo está vacío." }
            val temp = File.createTempFile("admin-audio-", ".media", context.cacheDir)
            var audioMime = ""
            try {
                temp.writeBytes(bytes)
                val extractor = MediaExtractor()
                try {
                    extractor.setDataSource(temp.absolutePath)
                    var audio = false; var video = false
                    for (index in 0 until extractor.trackCount) {
                        val mime = extractor.getTrackFormat(index).getString(MediaFormat.KEY_MIME).orEmpty()
                        if (mime.startsWith("audio/")) { audio = true; audioMime = mime }
                        if (mime.startsWith("video/")) video = true
                    }
                    require(audio && !video) { "Elige un archivo de audio compatible, sin pista de video." }
                } finally { extractor.release() }
            } finally { temp.delete() }
            val name = context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor -> if (cursor.moveToFirst()) cursor.getString(0) else null }.orEmpty()
            val supplied = name.substringAfterLast('.', "").lowercase()
            val ext = supplied.takeIf { it in setOf("mp3", "m4a", "wav", "ogg", "aac", "flac", "opus", "webm") }
                ?: when (audioMime) { "audio/mpeg" -> "mp3"; "audio/vorbis", "audio/opus" -> "ogg"; "audio/raw" -> "wav"; "audio/flac" -> "flac"; else -> "m4a" }
            check(FirebaseAuth.getInstance().currentUser?.uid == uid) { "La sesión cambió." }
            val auth = NativeApi.post("https://www.visitaloja.com/api/sign-time-audio?purpose=$purpose", token, JSONObject())
            val cloud = auth.getString("cloudName"); val params = auth.getJSONObject("params"); val folder = params.getString("folder")
            require(cloud.matches(Regex("[A-Za-z0-9_-]+")) && folder == expectedFolder && auth.getString("signature").matches(Regex("[a-f0-9]{40}")))
            val boundary = "vl-audio-" + java.util.UUID.randomUUID()
            val connection = URL("https://api.cloudinary.com/v1_1/$cloud/video/upload").openConnection() as HttpURLConnection
            try {
                connection.requestMethod = "POST"; connection.instanceFollowRedirects = false; connection.connectTimeout = 15000; connection.readTimeout = 90000; connection.doOutput = true
                connection.setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
                connection.outputStream.use { out ->
                    fun field(key: String, value: String) { require(!value.contains('\r') && !value.contains('\n')); out.write(("--$boundary\r\nContent-Disposition: form-data; name=\"$key\"\r\n\r\n$value\r\n").toByteArray()) }
                    field("folder", folder); field("timestamp", params.get("timestamp").toString()); field("api_key", auth.getString("apiKey")); field("signature", auth.getString("signature"))
                    out.write(("--$boundary\r\nContent-Disposition: form-data; name=\"file\"; filename=\"audio.$ext\"\r\nContent-Type: application/octet-stream\r\n\r\n").toByteArray()); out.write(bytes); out.write("\r\n--$boundary--\r\n".toByteArray())
                }
                check(connection.responseCode in 200..299) { "No se pudo subir el audio." }
                val body = connection.inputStream.use { input -> val out = ByteArrayOutputStream(); val buffer = ByteArray(4096); while (true) { val n = input.read(buffer); if (n < 0) break; require(out.size() + n <= 256000); out.write(buffer, 0, n) }; out.toString("UTF-8") }
                val result = JSONObject(body); val url = result.getString("secure_url"); val parsed = java.net.URI(url)
                require(result.optString("resource_type") == "video" && result.getString("public_id").startsWith("$folder/") && parsed.scheme == "https" && parsed.host == "res.cloudinary.com" && parsed.path.startsWith("/$cloud/video/upload/")) { "El proveedor devolvió un destino de audio no autorizado." }
                require(PlaceMediaPolicy.audio(url) != null) { "El audio no es compatible con el reproductor." }
                url
            } finally { connection.disconnect() }
        }
    }
}
