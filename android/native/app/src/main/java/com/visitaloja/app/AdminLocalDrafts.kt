package com.visitaloja.app

import android.content.Context
import android.util.AtomicFile
import com.google.firebase.Timestamp
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest

internal data class LocalAdminDraft(val id: String, val title: String, val savedAt: Long, val fingerprint: String, val data: JSONObject)
/** Private, account-scoped files. Never contains credentials or a whole user directory. */
internal object AdminLocalDrafts {
    private fun hash(value: String) = MessageDigest.getInstance("SHA-256").digest(value.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
    private fun dir(context: Context, uid: String, scope: String): File {
        require(uid.isNotBlank() && scope in setOf("stories", "entrepreneurs", "cantons", "history", "podcast"))
        return File(context.noBackupFilesDir, "admin-drafts/" + hash(uid + "\u0000" + scope)).also { check(it.isDirectory || it.mkdirs()) }
    }
    private fun file(context: Context, uid: String, scope: String, id: String) = File(dir(context, uid, scope), hash(id) + ".json")
    private fun canonical(value: Any?): String = when (value) {
        null -> "null"
        is Timestamp -> "timestamp:${value.seconds}:${value.nanoseconds}"
        is Map<*, *> -> value.entries.sortedBy { it.key.toString() }.joinToString(prefix = "{", postfix = "}") { JSONObject.quote(it.key.toString()) + ":" + canonical(it.value) }
        is List<*> -> value.joinToString(prefix = "[", postfix = "]") { canonical(it) }
        is String -> JSONObject.quote(value)
        is Number, is Boolean -> value.toString()
        else -> JSONObject.quote(value.toString())
    }
    fun fingerprint(base: Map<String, Any?>?) = hash(canonical(base))
    fun save(context: Context, uid: String, scope: String, id: String, title: String, base: Map<String, Any?>?, data: JSONObject) {
        require(id.length in 1..180)
        val folder = dir(context, uid, scope)
        val target = file(context, uid, scope, id)
        check(target.exists() || folder.listFiles { f -> f.name.endsWith(".json") }?.size.orZero() < 30) { "Hay 30 borradores de este módulo. Elimina alguno antes de añadir otro." }
        val body = JSONObject().put("schema", 1).put("uid", uid).put("scope", scope).put("id", id).put("title", title.take(140))
            .put("savedAt", System.currentTimeMillis()).put("fingerprint", fingerprint(base)).put("data", data).toString().toByteArray(Charsets.UTF_8)
        require(body.size <= 1_048_576) { "El borrador supera el tamaño permitido." }
        val atomic = AtomicFile(target); val stream = atomic.startWrite()
        try { stream.write(body); atomic.finishWrite(stream) } catch (e: Exception) { atomic.failWrite(stream); throw e }
    }
    private fun Int?.orZero() = this ?: 0
    private fun read(context: Context, uid: String, scope: String, id: String): LocalAdminDraft {
        val atomic = AtomicFile(file(context, uid, scope, id))
        val bytes = atomic.openRead().use { input ->
            val out = java.io.ByteArrayOutputStream(); val buffer = ByteArray(8192)
            while (true) { val n = input.read(buffer); if (n < 0) break; require(out.size() + n <= 1_048_576); out.write(buffer, 0, n) }; out.toByteArray()
        }
        val json = JSONObject(String(bytes, Charsets.UTF_8))
        require(json.getInt("schema") == 1 && json.getString("uid") == uid && json.getString("scope") == scope && json.getString("id") == id)
        return LocalAdminDraft(id, json.getString("title"), json.getLong("savedAt"), json.getString("fingerprint"), json.getJSONObject("data"))
    }
    fun list(context: Context, uid: String, scope: String): List<LocalAdminDraft> = dir(context, uid, scope).listFiles().orEmpty().filter { (it.name.endsWith(".json") || it.name.endsWith(".json.bak")) && it.length() <= 1_048_576 }.mapNotNull { file ->
        runCatching {
            val header = JSONObject(file.readText())
            read(context, uid, scope, header.getString("id"))
        }.getOrNull()
    }.distinctBy { it.id }.sortedByDescending { it.savedAt }
    fun load(context: Context, uid: String, scope: String, id: String) = read(context, uid, scope, id)
    fun remove(context: Context, uid: String, scope: String, id: String) = AtomicFile(file(context, uid, scope, id)).delete()
    fun strings(json: JSONObject): Map<String, String> = json.keys().asSequence().associateWith { key ->
        require(json.get(key) is String) { "Borrador incompatible." }; json.getString(key)
    }
    fun value(value: Any?): Any? = when (value) {
        JSONObject.NULL -> null
        is JSONObject -> value.keys().asSequence().associateWith { this.value(value.get(it)) }
        is JSONArray -> (0 until value.length()).map { this.value(value.get(it)) }
        else -> value
    }
}
