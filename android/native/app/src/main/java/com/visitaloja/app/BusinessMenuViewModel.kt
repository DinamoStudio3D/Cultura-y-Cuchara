package com.visitaloja.app

import androidx.lifecycle.ViewModel
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.MetadataChanges
import com.google.firebase.firestore.Source
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.tasks.await

internal data class BusinessMenuState(val id: String? = null, val source: PublicContent<BusinessMenuSource?> = PublicContent(null), val limits: PublicContent<Map<String, Int>> = PublicContent(emptyMap()))
internal class BusinessMenuViewModel : ViewModel() {
    private val mutable = MutableStateFlow(BusinessMenuState())
    val state = mutable.asStateFlow()
    private val listeners = mutableListOf<ListenerRegistration>()
    private var epoch = 0
    fun bind(id: String?, force: Boolean = false) {
        if (id == mutable.value.id && !force) return
        val generation = ++epoch
        listeners.forEach { it.remove() };listeners.clear()
        mutable.value = BusinessMenuState(id)
        if (id == null) return
        val db = FirebaseFirestore.getInstance()
        listeners += db.collection("locales").document(id).addSnapshotListener(MetadataChanges.INCLUDE) { doc, error ->
            if (epoch != generation) return@addSnapshotListener
            mutable.value = mutable.value.copy(source = if (error != null || doc == null) PublicContent(null, false, true) else PublicContent(if (doc.exists()) BusinessMenuPolicy.source(id, doc.data.orEmpty()) else null, false, false, doc.metadata.isFromCache))
        }
        listeners += db.collection("settings").document("subscriptions").addSnapshotListener(MetadataChanges.INCLUDE) { doc, error ->
            if (epoch != generation) return@addSnapshotListener
            mutable.value = mutable.value.copy(limits = if (error != null || doc == null) PublicContent(emptyMap(), false, true) else PublicContent(BusinessMenuPolicy.limits(doc.data.orEmpty()), false, false, doc.metadata.isFromCache))
        }
    }
    fun current(now: Long): BusinessCatalogue? {
        val s = mutable.value
        if (s.source.loading || s.source.error || s.source.cached) return null
        return s.source.value?.let { BusinessMenuPolicy.catalogue(it, s.limits.value, now, !s.limits.loading && !s.limits.error && !s.limits.cached) }
    }
    suspend fun verify(expected: BusinessCatalogue, product: Boolean): Boolean {
        val generation = epoch
        if (mutable.value.id != expected.id) return false
        val db = FirebaseFirestore.getInstance()
        val place = db.collection("locales").document(expected.id).get(Source.SERVER).await()
        val plans = if (product) db.collection("settings").document("subscriptions").get(Source.SERVER).await() else null
        if (epoch != generation || mutable.value.id != expected.id) return false
        val source = if (place.exists()) BusinessMenuPolicy.source(expected.id, place.data.orEmpty()) else null
        mutable.value = mutable.value.copy(source = PublicContent(source, false, false, false), limits = plans?.let { PublicContent(BusinessMenuPolicy.limits(it.data.orEmpty()), false, false, false) } ?: mutable.value.limits)
        return current(System.currentTimeMillis()) == expected
    }
    override fun onCleared() { epoch++;listeners.forEach { it.remove() };super.onCleared() }
}
