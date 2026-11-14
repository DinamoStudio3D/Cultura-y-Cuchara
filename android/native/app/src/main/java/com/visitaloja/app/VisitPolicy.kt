package com.visitaloja.app

import org.json.JSONArray
import org.json.JSONObject
import java.security.SecureRandom
import java.time.Instant

data class VisitCandidate(val id: String, val code: String, val expires: Long)
object VisitPolicy {
    private val random = SecureRandom()
    fun blocked(counter: Map<String, Any?>?, day: String) = counter?.text("lastVisitDay") == day && (counter?.count("dailyVisitCount") ?: 0) >= 1
    fun candidate(placeId: String, day: String, now: Long): VisitCandidate {
        require(placeId.matches(Regex("[A-Za-z0-9_-]{1,180}"))) { "Esta parada necesita revisión antes de generar códigos." }
        val code = (100000 + random.nextInt(900000)).toString()
        return VisitCandidate("${day}_${placeId}_$code", code, now + 9 * 60000)
    }
    fun commit(uid: String, name: String, email: String, place: Place, candidate: VisitCandidate, profile: Map<String,Any?> = emptyMap()): JSONObject {
        require(uid.isNotBlank() && candidate.code.matches(Regex("[0-9]{6}")))
        require(candidate.id.matches(Regex("[0-9]{4}-[0-9]{2}-[0-9]{2}_${Regex.escape(place.id)}_${candidate.code}")))
        val fields = JSONObject()
        mapOf("userId" to uid, "userName" to (profile["fullName"] as? String)?.trim()?.takeIf{it.isNotEmpty()}?.take(100).orEmpty().ifBlank{name.take(100)}, "userEmail" to email, "placeId" to place.id, "placeName" to place.title, "code" to candidate.code, "status" to "pending").forEach { (k, v) -> fields.put(k, JSONObject().put("stringValue", v)) }
        val city=(profile["city"] as? String)?.trim()?.take(80)
        val mode=(profile["visitorType"] as? String)?.takeIf{it in setOf("turista","lojano")}
        val birth=(profile["birthDate"] as? String)?.let{runCatching{java.time.LocalDate.parse(it)}.getOrNull()}?.let{String.format(java.util.Locale.ROOT,"%02d-%02d",it.monthValue,it.dayOfMonth)}
        mapOf("city" to city,"visitorType" to mode,"birthMonthDay" to birth).forEach{(key,value)->if(value!=null)fields.put(key,JSONObject().put("stringValue",value))}
        fields.put("expiresAt", JSONObject().put("timestampValue", Instant.ofEpochMilli(candidate.expires).toString()))
        val write = JSONObject().put("update", JSONObject().put("name", "projects/cultura-y-cuchara/databases/(default)/documents/visitCodes/${candidate.id}").put("fields", fields))
            .put("currentDocument", JSONObject().put("exists", false))
            .put("updateTransforms", JSONArray().put(JSONObject().put("fieldPath", "createdAt").put("setToServerValue", "REQUEST_TIME")))
        return JSONObject().put("writes", JSONArray().put(write))
    }
}
