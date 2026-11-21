package com.visitaloja.app

import androidx.lifecycle.ViewModel
import com.google.firebase.firestore.FieldPath
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.MetadataChanges
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

data class CantonsState(val guides: Map<String, CantonGuide> = emptyMap(), val loading: Boolean = false, val error: Boolean = false, val cached: Boolean = false)
class CantonsViewModel : ViewModel() {
    private val mutable = MutableStateFlow(CantonsState())
    val state = mutable.asStateFlow()
    private var listener: ListenerRegistration? = null
    private var generation = 0
    fun bind(active: Boolean) {
        if (active && listener != null) return
        val epoch = ++generation
        listener?.remove(); listener = null
        if (!active) return
        mutable.update { it.copy(loading = true, error = false) }
        listener = FirebaseFirestore.getInstance().collection("siteContent")
            .whereIn(FieldPath.documentId(), CantonPolicy.catalogue.map { "canton_${it.id}" })
            .addSnapshotListener(MetadataChanges.INCLUDE) { snapshot, error ->
                if (epoch != generation) return@addSnapshotListener
                if (error != null) { mutable.update { it.copy(loading = false, error = true, cached = it.guides.isNotEmpty()) }; return@addSnapshotListener }
                val guides = snapshot?.documents?.associate { doc -> doc.id.removePrefix("canton_") to CantonPolicy.guide(doc.data ?: emptyMap()) } ?: emptyMap()
                mutable.value = CantonsState(guides, loading = false, cached = snapshot?.metadata?.isFromCache ?: false)
            }
    }
    override fun onCleared() { generation++; listener?.remove(); super.onCleared() }
}
