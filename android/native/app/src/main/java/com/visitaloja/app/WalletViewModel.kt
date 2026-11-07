package com.visitaloja.app

import androidx.lifecycle.ViewModel
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.MetadataChanges
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

data class WalletState(val uid: String? = null, val ready: Set<String> = emptySet(), val errors: Set<String> = emptySet(),
    val cached: Set<String> = emptySet(), val config: Map<String, Any?> = emptyMap(), val campaignExists: Boolean = false,
    val stamps: List<Map<String, Any?>> = emptyList(), val programs: List<Map<String, Any?>> = emptyList(),
    val counters: List<Map<String, Any?>> = emptyList(), val rewards: List<Map<String, Any?>> = emptyList(),
    val completions: List<Map<String, Any?>> = emptyList(), val mode: String = "turista")

class WalletViewModel : ViewModel() {
    private val db = FirebaseFirestore.getInstance()
    private val mutable = MutableStateFlow(WalletState())
    val state = mutable.asStateFlow()
    private val listeners = mutableListOf<ListenerRegistration>()
    private var generation = 0
    fun bind(uid: String?) {
        generation++; val epoch = generation
        listeners.forEach { it.remove() }; listeners.clear()
        mutable.value = WalletState(uid = uid)
        if (uid == null) return
        fun current() = generation == epoch && mutable.value.uid == uid
        listeners += db.collection("siteContent").document("passport").addSnapshotListener(MetadataChanges.INCLUDE) { doc, error ->
            if (!current()) return@addSnapshotListener
            mutable.update { it.copy(config = if (error == null) project(doc?.data) else emptyMap(), campaignExists = error == null && doc?.exists() == true,
                ready = if (error == null) it.ready + "campaign" else it.ready - "campaign", errors = if (error != null) it.errors + "campaign" else it.errors - "campaign",
                cached = if (doc?.metadata?.isFromCache == true) it.cached + "campaign" else it.cached - "campaign") }
        }
        listeners += db.collection("userProgress").document(uid).addSnapshotListener { doc, _ ->
            if (current()) mutable.update { it.copy(mode = if (doc?.getString("passportMode") == "lojano") "lojano" else "turista") }
        }
        for ((name, collection) in mapOf("stamps" to "securePassportStamps", "counters" to "loyaltyCounters", "rewards" to "loyaltyRewardClaims", "completions" to "passportCompletions", "programs" to "loyaltyPrograms")) {
            val query = if (name == "programs") db.collection(collection) else db.collection(collection).whereEqualTo("userId", uid)
            listeners += query.addSnapshotListener(MetadataChanges.INCLUDE) { snapshot, error ->
                if (!current()) return@addSnapshotListener
                val rows = if (error == null) snapshot?.documents?.map { project(it.data) + ("id" to it.id) } ?: emptyList() else emptyList()
                mutable.update {
                    val next = it.copy(ready = if (error == null && snapshot != null) it.ready + name else it.ready - name,
                        errors = if (error != null) it.errors + name else it.errors - name,
                        cached = if (snapshot?.metadata?.isFromCache == true) it.cached + name else it.cached - name)
                    when (name) { "stamps" -> next.copy(stamps = rows); "counters" -> next.copy(counters = rows); "rewards" -> next.copy(rewards = rows); "completions" -> next.copy(completions = rows); else -> next.copy(programs = rows) }
                }
            }
        }
    }
    override fun onCleared() { generation++; listeners.forEach { it.remove() }; super.onCleared() }
}

private fun project(data: Map<String, Any?>?): Map<String, Any?> = data?.mapValues { (_, v) -> clean(v) } ?: emptyMap()
private fun clean(value: Any?): Any? = when (value) {
    is Timestamp -> value.toDate().time
    is Map<*, *> -> value.entries.associate { it.key.toString() to clean(it.value) }
    is List<*> -> value.map(::clean)
    else -> value
}
