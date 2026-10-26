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

data class AgendaState(val events: List<LojaEvent> = emptyList(), val loading: Boolean = true, val error: Boolean = false,
    val cached: Boolean = false, val now: Long = System.currentTimeMillis())

class AgendaViewModel : ViewModel() {
    private val mutable = MutableStateFlow(AgendaState())
    val state = mutable.asStateFlow()
    private var listener: ListenerRegistration? = null
    private var generation = 0
    init {
        refresh()
        viewModelScope.launch { while (true) { delay(30000); mutable.update { it.copy(now = System.currentTimeMillis()) } } }
    }
    fun refresh() {
        val epoch = ++generation
        listener?.remove(); mutable.update { it.copy(loading = true, error = false, now = System.currentTimeMillis()) }
        listener = FirebaseFirestore.getInstance().collection("siteContent").document("events").addSnapshotListener(MetadataChanges.INCLUDE) { doc, error ->
            if (epoch != generation) return@addSnapshotListener
            if (error != null) { mutable.update { it.copy(loading = false, error = true, cached = it.events.isNotEmpty()) }; return@addSnapshotListener }
            val rows = doc?.get("events") as? List<*> ?: emptyList<Any>()
            val events = rows.mapIndexedNotNull { index, value ->
                val map = (value as? Map<*, *>)?.entries?.associate { it.key.toString() to it.value } ?: return@mapIndexedNotNull null
                AgendaPolicy.parse(map, index)
            }
            mutable.update { it.copy(events = events, loading = false, error = false, cached = doc?.metadata?.isFromCache ?: false, now = System.currentTimeMillis()) }
        }
    }
    override fun onCleared() { generation++; listener?.remove(); super.onCleared() }
}
