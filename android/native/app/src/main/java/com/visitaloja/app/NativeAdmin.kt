package com.visitaloja.app

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

internal object AdminPlacePolicy {
    fun allowed(email: String?, claims: Map<String, Any?>, profile: Map<String, Any?>): Boolean =
        email == "sukogames1996@gmail.com" || claims["admin"] == true || claims["role"] == "admin" ||
            (profile["active"] == true && profile["role"] == "admin")

    fun patch(title: String, description: String, address: String, state: String): Map<String, Any> {
        require(title.trim().length in 2..160) { "Escribe un nombre de 2 a 160 caracteres." }
        require(description.length <= 1200 && address.length <= 400) { "Revisa la extensión de la descripción y dirección." }
        require(state in setOf("draft", "published", "hidden")) { "Elige un estado de publicación." }
        return mapOf("title" to title.trim(), "desc" to description.trim(), "description" to description.trim(),
            "address" to address.trim(), "publicationStatus" to state)
    }
}

internal data class AdminPlaceRow(val id: String, val fields: Map<String, Any?>) {
    val title: String get() = fields["title"] as? String ?: id
    val description: String get() = fields["description"] as? String ?: fields["desc"] as? String ?: ""
    val address: String get() = fields["address"] as? String ?: ""
    val publication: String get() = fields["publicationStatus"] as? String ?: "published"
}
internal data class NativeAdminState(
    val uid: String? = null, val allowed: Boolean = false, val checked: Boolean = false,
    val busy: Boolean = false, val rows: List<AdminPlaceRow> = emptyList(),
    val complete: Boolean = false, val message: String? = null, val revision: Int = 0
)

internal class NativeAdminViewModel : ViewModel() {
    private val auth = FirebaseAuth.getInstance()
    private val db = FirebaseFirestore.getInstance()
    private val mutable = MutableStateFlow(NativeAdminState())
    val state = mutable.asStateFlow()
    private var epoch = 0
    private var cursor: DocumentSnapshot? = null
    private fun same(uid: String, version: Int) = epoch == version && auth.currentUser?.uid == uid && mutable.value.uid == uid
    private suspend fun authorize(uid: String): Boolean {
        val user = auth.currentUser?.takeIf { it.uid == uid } ?: return false
        val claims = user.getIdToken(true).await().claims
        // Both claims and the legacy emergency account follow the existing server rules.
        if (AdminPlacePolicy.allowed(user.email, claims, emptyMap())) return true
        val profile = db.collection("adminUsers").document(uid).get(Source.SERVER).await()
        return AdminPlacePolicy.allowed(user.email, claims, profile.data.orEmpty())
    }
    fun bind(uid: String?, preferred: String? = null) {
        val version = ++epoch
        cursor = null
        mutable.value = NativeAdminState(uid = uid, busy = uid != null)
        if (uid == null) return
        viewModelScope.launch {
            try {
                val allowed = authorize(uid)
                if (!same(uid, version)) return@launch
                val saved = if (allowed && preferred != null && MerchantScanPolicy.placeId(preferred))
                    db.collection("locales").document(preferred).get(Source.SERVER).await() else null
                if (!same(uid, version)) return@launch
                mutable.value = mutable.value.copy(allowed = allowed, checked = true, busy = false,
                    rows = if (saved?.exists() == true) listOf(AdminPlaceRow(saved.id, saved.data.orEmpty())) else emptyList())
                if (allowed) load()
            } catch (e: CancellationException) { throw e }
            catch (_: Exception) {
                if (same(uid, version)) mutable.value = NativeAdminState(uid = uid, checked = true,
                    message = "No se pudo verificar tu acceso. Conéctate y vuelve a intentar.")
            }
        }
    }
    fun load() {
        val old = mutable.value
        val uid = old.uid ?: return
        if (old.busy || !old.allowed || old.complete) return
        val version = epoch
        mutable.value = old.copy(busy = true, message = null)
        viewModelScope.launch {
            try {
                check(authorize(uid)) { "Tu cuenta ya no tiene acceso administrativo." }
                if (!same(uid, version)) return@launch
                var query: Query = db.collection("locales").orderBy(FieldPath.documentId()).limit(50)
                cursor?.let { query = query.startAfter(it) }
                val result = query.get(Source.SERVER).await()
                if (same(uid, version)) {
                    cursor = result.documents.lastOrNull() ?: cursor
                    mutable.value = mutable.value.copy(busy = false,
                        rows = (old.rows + result.documents.map { AdminPlaceRow(it.id, it.data.orEmpty()) }).distinctBy { it.id },
                        complete = result.size() < 50)
                }
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { fail(uid, version, e) }
        }
    }
    private fun fail(uid: String, version: Int, error: Exception) {
        if (!same(uid, version)) return
        val denied = error is IllegalStateException || (error as? FirebaseFirestoreException)?.code == FirebaseFirestoreException.Code.PERMISSION_DENIED
        mutable.value = mutable.value.copy(busy = false, allowed = if (denied) false else mutable.value.allowed,
            rows = if (denied) emptyList() else mutable.value.rows,
            message = if (denied) "El acceso administrativo no está autorizado. Actualiza tus permisos." else
                "No se pudo confirmar la operación. Actualiza antes de volver a guardar.")
    }
    fun save(row: AdminPlaceRow, title: String, description: String, address: String, publication: String) {
        val old = mutable.value
        val uid = old.uid ?: return
        if (old.busy || !old.allowed) return
        val patch = try { AdminPlacePolicy.patch(title, description, address, publication) }
        catch (e: IllegalArgumentException) { mutable.value = old.copy(message = e.message); return }
        val version = epoch
        mutable.value = old.copy(busy = true, message = null)
        viewModelScope.launch {
            try {
                check(authorize(uid)) { "Acceso retirado." }
                if (!same(uid, version)) return@launch
                val ref = db.collection("locales").document(row.id)
                val audit = db.collection("adminAudit").document()
                db.runTransaction { tx ->
                    check(same(uid, version)) { "La sesión cambió." }
                    val current = tx.get(ref)
                    check(current.exists() && current.data == row.fields) { "La parada cambió. Actualiza antes de guardar." }
                    // Publication does not reactivate suspended/archived businesses or change their plans.
                    tx.update(ref, patch)
                    tx.set(audit, mapOf("action" to "update", "module" to "places",
                        "summary" to "Edición de parada desde Android",
                        "details" to mapOf("placeId" to row.id, "fields" to patch.keys.toList()),
                        "actorUid" to uid, "actorEmail" to (auth.currentUser?.email ?: ""),
                        "createdAt" to FieldValue.serverTimestamp()))
                    Unit
                }.await()
                if (same(uid, version)) mutable.value = mutable.value.copy(busy = false,
                    rows = old.rows.map { if (it.id == row.id) AdminPlaceRow(row.id, row.fields + patch) else it },
                    revision = old.revision + 1, message = "Parada guardada. Los cambios se comparten con la web.")
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { fail(uid, version, e) }
        }
    }
}

@Composable
internal fun NativeAdminEntry(uid: String?) {
    val model: NativeAdminViewModel = viewModel(key = "native-admin")
    val observed by model.state.collectAsStateWithLifecycle()
    val state = observed.takeIf { it.uid == uid } ?: NativeAdminState(uid = uid)
    var open by remember(uid) { mutableStateOf(false) }
    var query by remember(uid) { mutableStateOf("") }
    var editingId by remember(uid) { mutableStateOf<String?>(null) }
    var creating by remember(uid) { mutableStateOf(false) }
    // Check only when requested; ordinary visitors do not download administrative data.
    DisposableEffect(uid) { onDispose { model.bind(null) } }
    if (uid != null) OutlinedButton(onClick = { open = true; model.bind(uid) }, modifier = Modifier.fillMaxWidth()) {
        Text("Administración · comprobar acceso")
    }
    if (open && uid != null) Dialog(onDismissRequest = { if (!state.busy) { open = false; editingId = null; model.bind(null) } },
        properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxSize().systemBarsPadding()) {
            LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                item {
                    Text("Administración general", style = MaterialTheme.typography.headlineSmall)
                    Text("Acceso exclusivo de administración general. Los cambios guardados se reflejan en VisitaLoja.")
                    TextButton(onClick = { open = false; editingId = null; model.bind(null) }, enabled = !state.busy) { Text("Cerrar") }
                    if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                    state.message?.let { Text(it) }
                    if (state.checked && !state.allowed) Text("Esta cuenta no tiene acceso administrativo confirmado.")
                    OutlinedButton(onClick = { editingId = null; model.bind(uid) }, enabled = !state.busy) { Text("Actualizar permisos y paradas") }
                    if (state.allowed) AdminAccessEntry(uid)
                    if (state.allowed) AdminAssignmentEntry(uid)
                    if (state.allowed) AdminPushEntry(uid)
                    if (state.allowed) AdminEventsEntry(uid)
                    if (state.allowed) AdminCantonsEntry(uid)
                    if (state.allowed) Button(onClick = { creating = true; editingId = "loc_" + java.util.UUID.randomUUID().toString() }, enabled = !state.busy) { Text("Crear parada") }
                    if (state.allowed) OutlinedTextField(query, { query = it }, label = { Text("Buscar entre las paradas cargadas") }, modifier = Modifier.fillMaxWidth())
                    if (state.allowed) Text("${state.rows.size} paradas cargadas" + if (state.complete) "" else " · quedan más por cargar")
                }
                if (state.allowed) {
                    items(state.rows.filter { PlacePolicy.normalize(it.title + " " + it.address + " " + AdminPlaceEditorPolicy.categories[AdminPlaceEditorPolicy.primary(it.fields)].orEmpty() + " " + it.fields.text("cantonId")).contains(PlacePolicy.normalize(query)) }, key = { it.id }) { row ->
                        OutlinedCard(onClick = { creating = false; editingId = row.id }, modifier = Modifier.fillMaxWidth(), enabled = !state.busy) {
                            Column(Modifier.padding(16.dp)) {
                                Text(row.title, style = MaterialTheme.typography.titleMedium)
                                Text(row.publication)
                                if (row.fields["active"] == false || row.fields["status"] in setOf("inactive", "archived", "deleted", "hidden", "draft"))
                                    Text("Revisa sus opciones de Publicación en el editor de la parada.")
                                Text("Editar ficha, ubicación, contacto, fotografías y publicación")
                                AdminLoyaltyEntry(uid, row.id)
                            }
                        }
                    }
                    if (!state.complete) item { OutlinedButton(onClick = model::load, enabled = !state.busy) { Text("Cargar más paradas") } }
                }
            }
        }
    }
    if (open && state.allowed && uid != null) editingId?.let { id ->
        AdminPlaceEditorScreen(uid, id, creating,
            close = { editingId = null },
            saved = { editingId = null; query = ""; model.bind(uid, id) })
    }
}
