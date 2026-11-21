package com.visitaloja.app

import androidx.lifecycle.ViewModel
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.MetadataChanges
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

internal class MesaViewModel : ViewModel() {
    private val mutable = MutableStateFlow(PublicContent(MesaContent()))
    val state = mutable.asStateFlow()
    private var listener: ListenerRegistration? = null
    private var bound = false
    private var epoch = 0
    fun bind(active: Boolean, force: Boolean = false) {
        if (bound == active && !force) return
        bound = active
        val generation = ++epoch
        listener?.remove();listener = null
        if (!active) return
        mutable.value = mutable.value.copy(loading = true, error = false)
        listener = FirebaseFirestore.getInstance().collection("siteContent").document("mesaTuristica").addSnapshotListener(MetadataChanges.INCLUDE) { doc, error ->
            if (generation != epoch) return@addSnapshotListener
            mutable.value = if (error != null || doc == null) PublicContent(MesaContent(), false, true) else PublicContent(MesaPolicy.read(doc.data ?: emptyMap()), false, false, doc.metadata.isFromCache)
        }
    }
    override fun onCleared() { epoch++;listener?.remove();super.onCleared() }
}
