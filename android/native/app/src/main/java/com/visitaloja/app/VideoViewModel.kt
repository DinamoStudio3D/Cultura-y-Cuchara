package com.visitaloja.app

import androidx.lifecycle.ViewModel
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.MetadataChanges
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

class VideoViewModel : ViewModel() {
    private val mutable = MutableStateFlow(PublicContent(VideoGallery()))
    val state = mutable.asStateFlow()
    private var listener: ListenerRegistration? = null
    private var generation = 0
    init { refresh() }
    fun refresh() {
        val epoch = ++generation
        listener?.remove()
        mutable.update { it.copy(loading = true, error = false) }
        listener = FirebaseFirestore.getInstance().collection("settings").document("videoGallery")
            .addSnapshotListener(MetadataChanges.INCLUDE) { doc, error ->
                if (epoch != generation) return@addSnapshotListener
                mutable.update { if (doc == null || error != null) it.copy(loading = false, error = true)
                    else PublicContent(VideoPolicy.read(doc.data ?: emptyMap()), false, false, doc.metadata.isFromCache) }
            }
    }
    override fun onCleared() { generation++; listener?.remove(); super.onCleared() }
}
