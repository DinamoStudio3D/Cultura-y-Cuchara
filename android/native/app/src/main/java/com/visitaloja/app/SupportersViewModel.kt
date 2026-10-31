package com.visitaloja.app

import androidx.lifecycle.ViewModel
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.MetadataChanges
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

internal class SupportersViewModel : ViewModel() {
    private val mutable = MutableStateFlow(PublicContent(SupportConfig()))
    val state = mutable.asStateFlow()
    private var listener: ListenerRegistration? = null
    private var bound = false;private var epoch = 0
    fun bind(active: Boolean, force: Boolean = false) {
        if (active == bound && !force) return
        bound = active;val generation = ++epoch;listener?.remove();listener = null
        if (!active) return
        mutable.value = mutable.value.copy(loading = true, error = false)
        listener = FirebaseFirestore.getInstance().collection("siteContent").document("registeredBrands").addSnapshotListener(MetadataChanges.INCLUDE) { doc, error ->
            if (generation != epoch) return@addSnapshotListener
            mutable.value = if (error != null || doc == null) PublicContent(SupportConfig(), false, true) else PublicContent(SupportersPolicy.config(doc.data ?: emptyMap()), false, false, doc.metadata.isFromCache)
        }
    }
    override fun onCleared() { epoch++;listener?.remove();super.onCleared() }
}
