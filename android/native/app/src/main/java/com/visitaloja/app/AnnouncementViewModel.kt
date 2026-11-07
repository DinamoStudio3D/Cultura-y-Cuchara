package com.visitaloja.app

import androidx.lifecycle.ViewModel
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.MetadataChanges
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

internal class AnnouncementViewModel : ViewModel() {
    private val mutable = MutableStateFlow<List<EntryAnnouncement>>(emptyList())
    val state = mutable.asStateFlow()
    private val seen = mutableSetOf<EntryAnnouncement>()
    fun hasSeen(item: EntryAnnouncement) = item in seen
    fun shown(item: EntryAnnouncement) { seen.add(item) }
    private var queue: ListenerRegistration? = null
    private var legacy: ListenerRegistration? = null
    private var bound = false
    private var epoch = 0
    private var legacyEpoch = 0
    fun bind(active: Boolean) {
        if (bound == active) return
        bound = active
        val generation = ++epoch
        queue?.remove(); queue = null
        legacyEpoch++; legacy?.remove(); legacy = null
        mutable.value = emptyList()
        if (!active) return
        queue = FirebaseFirestore.getInstance().collection("settings").document("announcements").addSnapshotListener(MetadataChanges.INCLUDE) { doc, error ->
            if (generation != epoch) return@addSnapshotListener
            legacyEpoch++; legacy?.remove(); legacy = null
            mutable.value = emptyList()
            if (error != null || doc == null || doc.metadata.isFromCache) return@addSnapshotListener
            if (doc.exists()) mutable.value = AnnouncementPolicy.read(doc.data.orEmpty())
            else {
                val legacyGeneration = legacyEpoch
                legacy = FirebaseFirestore.getInstance().collection("settings").document("main").addSnapshotListener(MetadataChanges.INCLUDE) old@{ old, failure ->
                    if (generation != epoch || legacyGeneration != legacyEpoch) return@old
                    mutable.value = if (failure == null && old != null && !old.metadata.isFromCache && old.exists()) AnnouncementPolicy.read(old.data.orEmpty(), true) else emptyList()
                }
            }
        }
    }
    override fun onCleared() { epoch++; legacyEpoch++; queue?.remove(); legacy?.remove(); super.onCleared() }
}
