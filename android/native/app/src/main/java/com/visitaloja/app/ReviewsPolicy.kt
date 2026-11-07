package com.visitaloja.app

import com.google.firebase.Timestamp
import org.json.JSONArray
import org.json.JSONObject
import java.util.Date

internal data class VerifiedReview(val id: String, val name: String, val rating: Int, val comment: String, val updated: Long, val published: Boolean)
internal object ReviewsPolicy {
    private fun Map<String, Any?>.text(key: String) = (this[key] as? String).orEmpty().trim()
    fun id(uid: String, place: String): String {
        require(uid.isNotBlank() && place.isNotBlank() && listOf(uid, place).none { '/' in it || it.any(Char::isISOControl) } && uid.length <= 128 && place.length <= 180)
        return "${uid}_$place"
    }
    fun placePublished(raw: Map<String, Any?>) = raw.text("title").isNotBlank() && raw["active"] != false && raw["hidden"] != true && raw["published"] != false && raw.text("publicationStatus") in setOf("", "published") && raw.text("status") !in setOf("draft", "hidden", "inactive", "deleted", "archived")
    fun read(id: String, raw: Map<String, Any?>, place: String, publicOnly: Boolean = true): VerifiedReview? {
        val rating = (raw["rating"] as? Number)?.toDouble() ?: return null
        val comment = raw.text("comment")
        val published = raw["status"] == "published"
        if (raw["placeId"] != place || (publicOnly && !published) || !rating.isFinite() || rating != rating.toInt().toDouble() || rating.toInt() !in 1..5 || comment.length !in 3..600) return null
        val time = when (val value = raw["updatedAt"]) { is Timestamp -> value.toDate().time; is Date -> value.time; else -> 0L }
        return VerifiedReview(id, raw.text("userName").take(100).ifBlank { "Visitante" }, rating.toInt(), comment, time, published)
    }
    fun eligible(uid: String, place: String, documentId: String, raw: Map<String, Any?>) = documentId == id(uid, place) && raw["userId"] == uid && raw["placeId"] == place
    fun error(name: String, rating: Int, comment: String): String? = when {
        name.trim().length !in 1..100 || name.any(Char::isISOControl) -> "Escribe un nombre público de hasta 100 caracteres."
        rating !in 1..5 -> "Elige entre 1 y 5 estrellas."
        comment.trim().length !in 3..600 || comment.any { it.isISOControl() && it != '\n' } -> "Escribe una opinión de 3 a 600 caracteres."
        else -> null
    }
    fun sorted(items: List<VerifiedReview>, high: Boolean) = if (high) items.sortedWith(compareByDescending<VerifiedReview> { it.rating }.thenByDescending { it.updated }.thenBy { it.id }) else items.sortedWith(compareByDescending<VerifiedReview> { it.updated }.thenBy { it.id })
    fun average(items: List<VerifiedReview>): Double? = items.takeIf { it.isNotEmpty() }?.map { it.rating }?.average()
    fun commit(uid: String, place: String, placeName: String, name: String, rating: Int, comment: String, existing: Boolean): JSONObject {
        require(error(name, rating, comment) == null)
        val fields = JSONObject().put("userName", JSONObject().put("stringValue", name.trim())).put("rating", JSONObject().put("integerValue", rating.toString())).put("comment", JSONObject().put("stringValue", comment.trim()))
        if (!existing) mapOf("userId" to uid, "placeId" to place, "placeName" to placeName.take(160), "status" to "published").forEach { (key, value) -> fields.put(key, JSONObject().put("stringValue", value)) }
        val transforms = JSONArray().put(JSONObject().put("fieldPath", "updatedAt").put("setToServerValue", "REQUEST_TIME"))
        if (!existing) transforms.put(JSONObject().put("fieldPath", "createdAt").put("setToServerValue", "REQUEST_TIME"))
        val write = JSONObject().put("update", JSONObject().put("name", "projects/cultura-y-cuchara/databases/(default)/documents/verifiedReviews/${id(uid, place)}").put("fields", fields)).put("currentDocument", JSONObject().put("exists", existing)).put("updateTransforms", transforms)
        if (existing) write.put("updateMask", JSONObject().put("fieldPaths", JSONArray(listOf("userName", "rating", "comment"))))
        return JSONObject().put("writes", JSONArray().put(write))
    }
}
