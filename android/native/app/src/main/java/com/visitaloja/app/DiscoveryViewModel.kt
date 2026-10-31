package com.visitaloja.app

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.MetadataChanges
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import org.json.JSONArray

data class PublicContent<T>(val value: T, val loading: Boolean = true, val error: Boolean = false, val cached: Boolean = false)
data class DiscoveryState(
    val music: PublicContent<WelcomeMusicConfig> = PublicContent(WelcomeMusicConfig()),
    val home: PublicContent<HomeContent> = PublicContent(HomeContent()),
    val photos: PublicContent<List<LojaPhoto>> = PublicContent(emptyList()),
    val history: PublicContent<List<TimePlace>> = PublicContent(emptyList()),
    val podcast: PublicContent<LojaPodcast?> = PublicContent(null))

class DiscoveryViewModel(app: Application) : AndroidViewModel(app) {
    private val mutable = MutableStateFlow(DiscoveryState())
    val state = mutable.asStateFlow()
    private val listeners = mutableListOf<ListenerRegistration>()
    private var epoch = 0
    private val defaults = runCatching {
        val json = JSONArray(app.assets.open("discovery-photo-defaults.json").bufferedReader().use { it.readText() })
        val rows = (0 until json.length()).map { i -> json.getJSONObject(i).let { obj -> obj.keys().asSequence().associateWith { obj.get(it) } } }
        DiscoveryPolicy.photos(mapOf("photoManagerInitialized" to true, "photoManagerItems" to rows), emptyList())
    }.getOrDefault(emptyList())
    init { refresh() }
    fun refresh() {
        val generation = ++epoch
        listeners.forEach { it.remove() }; listeners.clear()
        mutable.update { it.copy(music = it.music.copy(loading = true, error = false), home = it.home.copy(loading = true, error = false), photos = it.photos.copy(loading = true, error = false), history = it.history.copy(loading = true, error = false), podcast = it.podcast.copy(loading = true, error = false)) }
        val db = FirebaseFirestore.getInstance()
        listeners += db.collection("settings").document("main").addSnapshotListener(MetadataChanges.INCLUDE) { doc, error ->
            if (generation != epoch) return@addSnapshotListener
            mutable.update { state -> state.copy(
                music = if (error != null || doc == null || !doc.exists()) PublicContent(WelcomeMusicConfig(), false, true) else PublicContent(WelcomeMusicPolicy.read(doc.data.orEmpty()), false, false, doc.metadata.isFromCache),
                home = if (error != null || doc == null) PublicContent(HomeContent(), false, true) else PublicContent(HomePolicy.read(doc.data.orEmpty(), defaults), false, false, doc.metadata.isFromCache),
                photos = if (error != null || doc == null) state.photos.copy(loading = false, error = true) else PublicContent(DiscoveryPolicy.photos(doc.data ?: emptyMap(), defaults), false, false, doc.metadata.isFromCache)) }
        }
        listeners += db.collection("loja_tiempo").addSnapshotListener(MetadataChanges.INCLUDE) { snapshot, error ->
            if (generation != epoch) return@addSnapshotListener
            mutable.update { state -> state.copy(history = if (error != null || snapshot == null) state.history.copy(loading = false, error = true)
                else PublicContent(snapshot.documents.mapNotNull { DiscoveryPolicy.time(it.id, it.data ?: emptyMap()) }.sortedBy { PlacePolicy.normalize(it.title) }, false, false, snapshot.metadata.isFromCache)) }
        }
        listeners += db.collection("siteContent").document("podcast").addSnapshotListener(MetadataChanges.INCLUDE) { doc, error ->
            if (generation != epoch) return@addSnapshotListener
            mutable.update { state -> state.copy(podcast = if (error != null || doc == null) state.podcast.copy(loading = false, error = true)
                else PublicContent(DiscoveryPolicy.podcast(doc.data ?: emptyMap()), false, false, doc.metadata.isFromCache)) }
        }
    }
    override fun onCleared() { epoch++; listeners.forEach { it.remove() }; super.onCleared() }
}
