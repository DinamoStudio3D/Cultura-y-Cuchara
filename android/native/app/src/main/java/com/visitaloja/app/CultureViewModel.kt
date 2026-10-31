package com.visitaloja.app

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.MetadataChanges
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

internal data class CultureState(val stories: PublicContent<StoryCatalogue> = PublicContent(StoryCatalogue()), val enterprises: PublicContent<List<LojaEnterprise>> = PublicContent(emptyList()), val now: Long = System.currentTimeMillis())
internal class CultureViewModel : ViewModel() {
    private val mutable = MutableStateFlow(CultureState())
    val state = mutable.asStateFlow()
    private var storyListener: ListenerRegistration? = null
    private var enterpriseListener: ListenerRegistration? = null
    private var storyEpoch = 0;private var enterpriseEpoch = 0
    private var storyBound = false;private var enterpriseBound = false
    init { viewModelScope.launch { while (true) { delay(30_000);if (storyBound) mutable.update { it.copy(now = System.currentTimeMillis()) } } } }
    fun bind(stories: Boolean, enterprises: Boolean, force: Boolean = false) {
        val db = FirebaseFirestore.getInstance()
        if (stories != storyBound || force) {
            storyBound = stories;val generation = ++storyEpoch;storyListener?.remove();storyListener = null
            if (stories) {
                mutable.update { it.copy(stories = it.stories.copy(loading = true, error = false), now = System.currentTimeMillis()) }
                storyListener = db.collection("siteContent").document("stories").addSnapshotListener(MetadataChanges.INCLUDE) { doc, error ->
                    if (generation != storyEpoch) return@addSnapshotListener
                    mutable.update { it.copy(stories = if (error != null || doc == null) PublicContent(StoryCatalogue(), false, true) else PublicContent(CulturePolicy.stories(doc.data ?: emptyMap()), false, false, doc.metadata.isFromCache), now = System.currentTimeMillis()) }
                }
            }
        }
        if (enterprises != enterpriseBound || force) {
            enterpriseBound = enterprises;val generation = ++enterpriseEpoch;enterpriseListener?.remove();enterpriseListener = null
            if (enterprises) {
                mutable.update { it.copy(enterprises = it.enterprises.copy(loading = true, error = false)) }
                enterpriseListener = db.collection("siteContent").document("entrepreneurs").addSnapshotListener(MetadataChanges.INCLUDE) { doc, error ->
                    if (generation != enterpriseEpoch) return@addSnapshotListener
                    mutable.update { it.copy(enterprises = if (error != null || doc == null) PublicContent(emptyList(), false, true) else PublicContent(CulturePolicy.enterprises(doc.data ?: emptyMap()), false, false, doc.metadata.isFromCache)) }
                }
            }
        }
    }
    override fun onCleared() { storyEpoch++;enterpriseEpoch++;storyListener?.remove();enterpriseListener?.remove();super.onCleared() }
}
