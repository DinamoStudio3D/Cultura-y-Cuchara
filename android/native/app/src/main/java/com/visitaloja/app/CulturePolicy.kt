package com.visitaloja.app

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.util.Date
import com.google.firebase.Timestamp

internal data class LojaStory(val id: String, val title: String, val titleEn: String, val intro: String, val introEn: String, val body: String, val bodyEn: String, val category: String, val era: String, val source: String, val cover: String?, val gallery: List<String>, val audio: String?, val audioEn: String?, val video: VideoSource?, val related: List<String>, val publishAt: Long?)
internal data class StoryCatalogue(val active: Boolean = true, val title: String = "Historias de Loja", val intro: String = "Relatos que conectan sabores, lugares y tradiciones.", val items: List<LojaStory> = emptyList())
internal data class LojaEnterprise(val id: String, val name: String, val category: String, val description: String, val image: String?, val phone: String?)
internal object CulturePolicy {
    private fun Map<*, *>.text(key: String, limit: Int = 200) = (this[key] as? String).orEmpty().trim().take(limit)
    private fun rows(raw: Map<String, Any?>) = (raw["items"] as? List<*>)?.take(300)?.mapNotNull { it as? Map<*, *> } ?: emptyList()
    private fun allowed(row: Map<*, *>) = row["active"] != false && row["hidden"] != true && row.text("status") !in setOf("hidden", "draft", "archived", "deleted", "inactive") && row.text("publicationStatus") in setOf("", "published")
    private fun strings(value: Any?, limit: Int) = (value as? List<*>)?.mapNotNull { (it as? String)?.trim()?.takeIf(String::isNotBlank) }?.distinct()?.take(limit) ?: emptyList()
    private fun publishTime(value: Any?): Long? = when (value) {
        null, "" -> null
        is Timestamp -> value.toDate().time
        is Date -> value.time
        is String -> runCatching { Instant.parse(value).toEpochMilli() }.getOrNull() ?: runCatching { LocalDate.parse(value).atStartOfDay(ZoneId.of("America/Guayaquil")).toInstant().toEpochMilli() }.getOrNull() ?: Long.MAX_VALUE
        else -> Long.MAX_VALUE
    }
    fun stories(raw: Map<String, Any?>): StoryCatalogue {
        val settings = raw["settings"] as? Map<*, *> ?: emptyMap<Any, Any>()
        val active = settings["active"] != false && raw["active"] != false
        val title = settings.text("title").ifBlank { settings.text("titleEn") }.ifBlank { "Historias de Loja" }
        val intro = settings.text("intro", 700).ifBlank { settings.text("introEn", 700) }
        if (!active) return StoryCatalogue(false, title, intro)
        val stories = rows(raw).mapNotNull { row ->
            val id = row.text("id", 120);val name = row.text("title").ifBlank { row.text("titleEn") }
            if (id.isBlank() || name.isBlank() || row.text("status") != "published" || !allowed(row)) return@mapNotNull null
            LojaStory(id, name, row.text("titleEn"), row.text("intro", 2000), row.text("introEn", 2000), row.text("body", 60000), row.text("bodyEn", 60000), row.text("category", 100), row.text("era", 150), row.text("source", 500), DiscoveryPolicy.media(row.text("cover", 4096)),
                strings(row["gallery"], 20).mapNotNull(DiscoveryPolicy::media), PlaceMediaPolicy.audio(row.text("audioUrl", 4096)), PlaceMediaPolicy.audio(row.text("audioUrlEn", 4096)), VideoPolicy.source(row.text("videoUrl", 2000)), strings(row["relatedPlaceIds"], 50), publishTime(row["publishAt"]))
        }.distinctBy { it.id }
        return StoryCatalogue(true, title, intro, stories)
    }
    fun visible(catalogue: StoryCatalogue, now: Long) = if (!catalogue.active) emptyList() else catalogue.items.filter { it.publishAt == null || now >= it.publishAt }
    fun stories(catalogue: StoryCatalogue, now: Long, query: String, category: String): List<LojaStory> = visible(catalogue, now).filter {
        (category.isBlank() || category == it.category) && matches(query, "${it.title} ${it.titleEn} ${it.intro} ${it.introEn} ${it.category} ${it.era} ${it.source}")
    }
    fun enterprises(raw: Map<String, Any?>): List<LojaEnterprise> {
        if (raw["active"] == false) return emptyList()
        return rows(raw).mapNotNull { row ->
            val id = row.text("id", 120);val name = row.text("name")
            if (id.isBlank() || name.isBlank() || !allowed(row)) return@mapNotNull null
            LojaEnterprise(id, name, row.text("category", 100), row.text("desc", 12000), DiscoveryPolicy.media(row.text("img", 4096)), PlacePolicy.whatsapp(row.text("phone", 40)))
        }.distinctBy { it.id }
    }
    fun enterprises(items: List<LojaEnterprise>, query: String, category: String) = items.filter { (category.isBlank() || category == it.category) && matches(query, "${it.name} ${it.category} ${it.description}") }
    private fun matches(query: String, value: String): Boolean {
        val normalized = PlacePolicy.normalize(value)
        return PlacePolicy.normalize(query).split(' ').filter(String::isNotBlank).all { it in normalized }
    }
    fun storyAudioKey(id: String, english: Boolean) = "story:$id:${if (english) "en" else "es"}"
    fun audio(catalogue: StoryCatalogue, now: Long, key: String) = visible(catalogue, now).firstNotNullOfOrNull { s -> when (key) { storyAudioKey(s.id, false) -> s.audio; storyAudioKey(s.id, true) -> s.audioEn; else -> null } }
}
