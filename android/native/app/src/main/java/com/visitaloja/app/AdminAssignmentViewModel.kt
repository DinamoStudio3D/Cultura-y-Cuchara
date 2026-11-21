package com.visitaloja.app

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

internal data class AssignmentPlace(val id: String, val name: String, val available: Boolean = true)
internal data class AssignmentDraft(
    val target: String, val source: String, val email: String, val name: String,
    val merchant: Map<String, Any?>?, val modern: Map<String, Map<String, Any?>>,
    val initial: Map<String, String>, val selected: Map<String, String>,
    val active: Boolean, val initiallyActive: Boolean
)
internal data class AdminAssignmentState(
    val uid: String? = null, val kind: String = "merchants", val busy: Boolean = false, val ready: Boolean = false,
    val rows: List<AdminDirectoryRow> = emptyList(), val more: Boolean = false,
    val draft: AssignmentDraft? = null, val places: List<AssignmentPlace> = emptyList(), val morePlaces: Boolean = false,
    val message: String? = null, val revision: Int = 0
)
internal class AdminAssignmentViewModel : ViewModel() {
    private val auth = FirebaseAuth.getInstance()
    private val db = FirebaseFirestore.getInstance()
    private val mutable = MutableStateFlow(AdminAssignmentState())
    val state = mutable.asStateFlow()
    private var epoch = 0
    private var cursor: DocumentSnapshot? = null
    private var placeCursor: DocumentSnapshot? = null
    private fun same(uid: String, version: Int) = epoch == version && auth.currentUser?.uid == uid && mutable.value.uid == uid
    private suspend fun authorize(uid: String) {
        val user = auth.currentUser?.takeIf { it.uid == uid } ?: error("La sesión cambió.")
        val claims = user.getIdToken(true).await().claims
        check(AdminPlacePolicy.allowed(user.email, claims, emptyMap()) ||
            AdminPlacePolicy.allowed(user.email, claims, db.collection("adminUsers").document(uid).get(Source.SERVER).await().data.orEmpty())) {
            "Necesitas administración general para gestionar asignaciones."
        }
    }
    private suspend fun modern(target: String, email: String): Map<String, Map<String, Any?>> {
        val byUid = db.collection("businessAccess").whereEqualTo("uid", target).limit(201).get(Source.SERVER).await()
        val byEmail = db.collection("businessAccess").whereEqualTo("email", email).limit(201).get(Source.SERVER).await()
        check(byUid.size() <= 200 && byEmail.size() <= 200) { "Hay demasiados accesos. Revisa esta cuenta en la web." }
        val rows = (byUid.documents + byEmail.documents).associate { it.id to it.data.orEmpty() }
        return AdminAssignmentPolicy.modern(target, rows)
    }
    private fun fail(uid: String, version: Int, error: Exception) {
        if (same(uid, version)) mutable.value = mutable.value.copy(busy = false, ready = false,
            rows = emptyList(), draft = null, places = emptyList(),
            message = if (error is IllegalArgumentException || error is IllegalStateException) error.message else
                "No se pudo confirmar la operación o los permisos. Actualiza desde el servidor antes de continuar.")
    }
    fun bind(uid: String?, kind: String = "merchants") {
        ++epoch; cursor = null; placeCursor = null
        mutable.value = AdminAssignmentState(uid = uid, kind = kind)
        if (uid != null) load()
    }
    fun load() {
        val old = mutable.value; val uid = old.uid ?: return
        val collection = AdminAssignmentPolicy.sources[old.kind] ?: return
        if (old.busy) return
        val version = epoch
        mutable.value = old.copy(busy = true, message = null)
        viewModelScope.launch {
            try {
                authorize(uid); if (!same(uid, version)) return@launch
                var query: Query = db.collection(collection).orderBy(FieldPath.documentId()).limit(50)
                cursor?.let { query = query.startAfter(it) }
                val page = query.get(Source.SERVER).await()
                if (same(uid, version)) {
                    cursor = page.documents.lastOrNull() ?: cursor
                    mutable.value = old.copy(ready = true, rows = (old.rows + page.documents.map {
                        AdminDirectoryRow(it.id, it.data.orEmpty())
                    }).distinctBy { it.id }, more = page.size() == 50)
                }
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { fail(uid, version, e) }
        }
    }
    fun inspect(row: AdminDirectoryRow) {
        val old = mutable.value; val uid = old.uid ?: return
        if (old.busy || !old.ready) return
        val version = ++epoch
        mutable.value = old.copy(busy = true, draft = null, message = null)
        viewModelScope.launch {
            try {
                authorize(uid); if (!same(uid, version)) return@launch
                require(AdminAssignmentPolicy.uid(row.id))
                val source = db.collection(AdminAssignmentPolicy.sources.getValue(old.kind)).document(row.id).get(Source.SERVER).await()
                check(source.exists()) { "La cuenta ya no está en el listado. Actualiza." }
                val email = AdminAssignmentPolicy.email(source.getString("email").orEmpty())
                check(email == AdminAssignmentPolicy.email(row.email)) { "El correo cambió. Actualiza antes de continuar." }
                val merchant = db.collection("missionRewardMerchants").document(row.id).get(Source.SERVER).await()
                val records = modern(row.id, email)
                val configured = AdminAssignmentPolicy.configured(merchant.data, records)
                val first = db.collection("locales").orderBy(FieldPath.documentId()).limit(50).get(Source.SERVER).await()
                val places = first.documents.map { AssignmentPlace(it.id, it.getString("title") ?: it.id) }.toMutableList()
                val referenced = configured.keys + records.values.map { it.text("placeId") }
                check(referenced.toSet().size <= 200) { "Esta cuenta necesita una revisión de asignaciones en la web." }
                for (id in referenced.filter { id -> places.none { it.id == id } }) {
                    val doc = db.collection("locales").document(id).get(Source.SERVER).await()
                    places += AssignmentPlace(id, doc.getString("title") ?: id, doc.exists())
                }
                val name = source.getString("businessName") ?: source.getString("fullName")
                    ?: source.getString("displayName") ?: email
                val active = merchant.data?.get("active") != false
                if (same(uid, version)) {
                    placeCursor = first.documents.lastOrNull()
                    mutable.value = old.copy(places = places.distinctBy { it.id }, morePlaces = first.size() == 50,
                        draft = AssignmentDraft(row.id, old.kind, email, name, merchant.data, records, configured, configured, active, active))
                }
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { fail(uid, version, e) }
        }
    }
    fun edit(draft: AssignmentDraft) {
        val old = mutable.value
        if (!old.busy && old.ready && draft.target == old.draft?.target) mutable.value = old.copy(draft = draft, message = null)
    }
    fun dismiss() {
        if (!mutable.value.busy) {
            ++epoch; placeCursor = null
            mutable.value = mutable.value.copy(draft = null, places = emptyList())
        }
    }
    fun morePlaces() {
        val old = mutable.value; val uid = old.uid ?: return
        if (old.busy || !old.ready || !old.morePlaces || old.draft == null) return
        val version = epoch; mutable.value = old.copy(busy = true)
        viewModelScope.launch {
            try {
                authorize(uid); if (!same(uid, version)) return@launch
                var query: Query = db.collection("locales").orderBy(FieldPath.documentId()).limit(50)
                placeCursor?.let { query = query.startAfter(it) }
                val page = query.get(Source.SERVER).await()
                if (same(uid, version)) {
                    placeCursor = page.documents.lastOrNull() ?: placeCursor
                    mutable.value = old.copy(places = (old.places + page.documents.map {
                        AssignmentPlace(it.id, it.getString("title") ?: it.id)
                    }).distinctBy { it.id }, morePlaces = page.size() == 50)
                }
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { fail(uid, version, e) }
        }
    }
    fun save() {
        val old = mutable.value; val uid = old.uid ?: return; val draft = old.draft ?: return
        if (old.busy || !old.ready) return
        val touched = (AdminAssignmentPolicy.ids(draft.merchant) + draft.modern.values.map { it.text("placeId") } + draft.selected.keys).toSet()
        try { AdminAssignmentPolicy.validate(draft.initial, draft.selected, old.places.filter { it.available }.map { it.id }.toSet(),
            draft.merchant != null, touched) }
        catch (e: Exception) { mutable.value = old.copy(message = e.message); return }
        val version = epoch; mutable.value = old.copy(busy = true, message = null)
        viewModelScope.launch {
            try {
                authorize(uid); if (!same(uid, version)) return@launch
                // Preflight detects additions outside the already loaded canonical document references.
                check(modern(draft.target, draft.email) == draft.modern) { "Las asignaciones cambiaron. Actualiza antes de guardar." }
                if (!same(uid, version)) return@launch
                val merchant = db.collection("missionRewardMerchants").document(draft.target)
                val source = db.collection(AdminAssignmentPolicy.sources.getValue(draft.source)).document(draft.target)
                val refs = touched.associateWith { db.collection("businessAccess").document(draft.target + "_" + it) }
                val audit = db.collection("adminAudit").document()
                db.runTransaction { tx ->
                    check(same(uid, version)) { "La sesión cambió." }
                    val current = tx.get(merchant)
                    val identity = tx.get(source)
                    val accesses = refs.mapValues { tx.get(it.value) }
                    val places = draft.selected.keys.associateWith { tx.get(db.collection("locales").document(it)) }
                    check(current.data == draft.merchant && identity.exists() &&
                        AdminAssignmentPolicy.email(identity.getString("email").orEmpty()) == draft.email) { "La cuenta o su asignación cambió. Actualiza." }
                    accesses.forEach { (place, doc) -> check(doc.data == draft.modern[draft.target + "_" + place]) {
                        "Otro administrador modificó un permiso. Actualiza antes de guardar."
                    } }
                    AdminAssignmentPolicy.validate(draft.initial, draft.selected,
                        places.filterValues { it.exists() }.keys, current.exists(), touched)
                    val metadata = mapOf("updatedAt" to FieldValue.serverTimestamp(), "updatedBy" to uid)
                    val legacy = AdminAssignmentPolicy.merchantPatch(draft.target, draft.email, draft.name,
                        current.data, draft.selected, draft.active) + metadata
                    tx.set(merchant, legacy + if (current.exists()) emptyMap() else
                        mapOf("createdAt" to FieldValue.serverTimestamp(), "createdBy" to uid), SetOptions.merge())
                    accesses.forEach { (place, doc) ->
                        val patch = AdminAssignmentPolicy.accessPatch(draft.target, draft.email, place,
                            draft.selected[place], draft.active, doc.data) + metadata
                        tx.set(refs.getValue(place), patch + if (doc.exists()) emptyMap() else
                            mapOf("createdAt" to FieldValue.serverTimestamp()), SetOptions.merge())
                    }
                    tx.set(audit, mapOf("action" to "business.assignments_saved", "module" to "business",
                        "summary" to "Actualizó accesos de negocios desde Android",
                        "details" to mapOf("targetUid" to draft.target, "active" to draft.active, "assignments" to draft.selected),
                        "actorUid" to uid, "actorEmail" to (auth.currentUser?.email ?: ""), "createdAt" to FieldValue.serverTimestamp()))
                    Unit
                }.await()
                if (same(uid, version)) mutable.value = old.copy(ready = false, draft = null, rows = emptyList(),
                    places = emptyList(), revision = old.revision + 1,
                    message = "Asignaciones guardadas. Actualiza para comprobar los accesos actuales.")
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { fail(uid, version, e) }
        }
    }
}
