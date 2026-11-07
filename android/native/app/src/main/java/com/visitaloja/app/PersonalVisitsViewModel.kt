package com.visitaloja.app

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.Timestamp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldPath
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.Source
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

internal data class PersonalVisitsState(val uid: String? = null, val rows: List<Map<String, Any?>> = emptyList(),
    val busy: Boolean = false, val more: Boolean = true, val loaded: Boolean = false, val error: String? = null)
internal class PersonalVisitsViewModel : ViewModel() {
    private val mutable = MutableStateFlow(PersonalVisitsState())
    val state = mutable.asStateFlow()
    private var generation = 0
    private var cursor: DocumentSnapshot? = null
    fun bind(uid: String?) {
        generation++; cursor = null; mutable.value = PersonalVisitsState(uid)
        if (uid != null) load()
    }
    fun load() {
        val before = mutable.value
        val uid = before.uid ?: return
        if (before.busy || !before.more || FirebaseAuth.getInstance().currentUser?.uid != uid) return
        val epoch = generation
        mutable.value = before.copy(busy = true, error = null)
        viewModelScope.launch {
            fun current() = generation == epoch && mutable.value.uid == uid && FirebaseAuth.getInstance().currentUser?.uid == uid
            try {
                var query: Query = FirebaseFirestore.getInstance().collection("loyaltyVisits").whereEqualTo("userId", uid)
                    .orderBy(FieldPath.documentId()).limit(50)
                cursor?.let { query = query.startAfter(it) }
                val result = query.get(Source.SERVER).await()
                if (!current()) return@launch
                val rows = result.documents.filter { it.getString("userId") == uid }.map { doc ->
                    doc.data.orEmpty().mapValues { (_, value) -> if (value is Timestamp) value.toDate().time else value } + ("id" to doc.id)
                }
                cursor = result.documents.lastOrNull() ?: cursor
                mutable.value = mutable.value.copy(rows = (before.rows + rows).distinctBy { it.text("id") }, busy = false, loaded = true, more = result.size() == 50)
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                if (current()) mutable.value = mutable.value.copy(busy = false, error = "No pudimos consultar tus visitas. Comprueba la conexión y vuelve a intentar.")
            }
        }
    }
}
