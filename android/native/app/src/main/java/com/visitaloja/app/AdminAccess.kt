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

internal object AdminAccessPolicy {
    const val PROTECTED_EMAIL = "sukogames1996@gmail.com"
    val collections = mapOf("access" to "adminUsers", "users" to "userProfiles", "audit" to "adminAudit")
    fun canEdit(actor: String, target: String, email: String): Boolean =
        actor.isNotBlank() && target.isNotBlank() && target.length <= 128 && '/' !in target &&
            actor != target && email.trim().lowercase(java.util.Locale.ROOT) != PROTECTED_EMAIL
    fun grant(actor: String, target: String, email: String, name: String, role: String, active: Boolean): Map<String, Any> {
        require(canEdit(actor, target, email)) { "Tu acceso y la cuenta principal se conservan protegidos." }
        require(role in setOf("admin", "owner")) { "Elige un rol disponible." }
        require(email.length <= 254 && email.matches(Regex("[^\\s@]+@[^\\s@]+\\.[^\\s@]+"))) { "El usuario necesita un correo válido." }
        require(name.length <= 100) { "El nombre es demasiado largo." }
        return mapOf("email" to email, "displayName" to name.trim(), "role" to role, "active" to active)
    }
}
internal data class AdminDirectoryRow(val id: String, val fields: Map<String, Any?>) {
    val name: String get() = (fields["displayName"] as? String)?.takeIf { it.isNotBlank() }
        ?: (fields["fullName"] as? String)?.takeIf { it.isNotBlank() } ?: "Usuario de VisitaLoja"
    val email: String get() = fields["email"] as? String ?: ""
}
internal data class AdminAccessDraft(val target: String, val email: String, val name: String,
    val previous: Map<String, Any?>?, val role: String, val active: Boolean)
internal data class AdminAccessState(val uid: String? = null, val kind: String = "access", val ready: Boolean = false,
    val busy: Boolean = false, val rows: List<AdminDirectoryRow> = emptyList(), val complete: Boolean = false,
    val message: String? = null, val draft: AdminAccessDraft? = null, val revision: Int = 0)

internal class AdminAccessViewModel : ViewModel() {
    private val auth = FirebaseAuth.getInstance()
    private val db = FirebaseFirestore.getInstance()
    private val mutable = MutableStateFlow(AdminAccessState())
    val state = mutable.asStateFlow()
    private var epoch = 0
    private var cursor: DocumentSnapshot? = null
    private fun same(uid: String, version: Int) = epoch == version && auth.currentUser?.uid == uid && mutable.value.uid == uid
    private suspend fun authorize(uid: String) {
        val user = auth.currentUser?.takeIf { it.uid == uid } ?: error("La sesión cambió.")
        val claims = user.getIdToken(true).await().claims
        val allowed = AdminPlacePolicy.allowed(user.email, claims, emptyMap()) ||
            AdminPlacePolicy.allowed(user.email, claims, db.collection("adminUsers").document(uid).get(Source.SERVER).await().data.orEmpty())
        check(allowed) { "Necesitas acceso administrativo vigente." }
    }
    fun bind(uid: String?, kind: String = "access") {
        ++epoch
        cursor = null
        mutable.value = AdminAccessState(uid = uid, kind = kind)
        if (uid != null && kind in AdminAccessPolicy.collections) load()
    }
    fun load() {
        val old = mutable.value
        val uid = old.uid ?: return
        if (old.busy || old.complete) return
        val collection = AdminAccessPolicy.collections[old.kind] ?: return
        val version = epoch
        mutable.value = old.copy(busy = true, message = null, draft = null)
        viewModelScope.launch {
            try {
                authorize(uid)
                if (!same(uid, version)) return@launch
                var query: Query = if (old.kind == "audit") db.collection(collection).orderBy("createdAt", Query.Direction.DESCENDING).limit(50)
                    else db.collection(collection).orderBy(FieldPath.documentId()).limit(50)
                cursor?.let { query = query.startAfter(it) }
                val result = query.get(Source.SERVER).await()
                if (same(uid, version)) {
                    cursor = result.documents.lastOrNull() ?: cursor
                    mutable.value = old.copy(ready = true, rows = (old.rows +
                        result.documents.map { AdminDirectoryRow(it.id, it.data.orEmpty()) }).distinctBy { it.id },
                        complete = result.size() < 50)
                }
            } catch (e: CancellationException) { throw e }
            catch (_: Exception) { fail(uid, version) }
        }
    }
    private fun fail(uid: String, version: Int) {
        if (same(uid, version)) mutable.value = mutable.value.copy(busy = false, ready = false,
            rows = emptyList(), draft = null, message = "No se pudo confirmar la operación o el permiso. Actualiza antes de continuar.")
    }
    fun inspect(row: AdminDirectoryRow) {
        val old = mutable.value
        val uid = old.uid ?: return
        if (old.busy || !old.ready || old.kind !in setOf("users", "access")) return
        if (!AdminAccessPolicy.canEdit(uid, row.id, row.email)) {
            mutable.value = old.copy(message = "Tu propio acceso y la cuenta principal no se modifican desde esta pantalla.")
            return
        }
        val version = epoch
        mutable.value = old.copy(busy = true, message = null, draft = null)
        viewModelScope.launch {
            try {
                authorize(uid)
                if (!same(uid, version)) return@launch
                val selected = db.collection(AdminAccessPolicy.collections.getValue(old.kind)).document(row.id).get(Source.SERVER).await()
                check(selected.exists() && selected.data == row.fields) { "El usuario cambió. Actualiza el listado." }
                val access = db.collection("adminUsers").document(row.id).get(Source.SERVER).await()
                val existing = access.data
                val email = (existing?.get("email") as? String) ?: row.email
                check(AdminAccessPolicy.canEdit(uid, row.id, email))
                val role = existing?.get("role") as? String ?: "owner"
                check(role in setOf("admin", "owner"))
                if (same(uid, version)) mutable.value = old.copy(draft = AdminAccessDraft(row.id, email,
                    (existing?.get("displayName") as? String) ?: row.name, existing, role, existing?.get("active") == true))
            } catch (e: CancellationException) { throw e }
            catch (_: Exception) { fail(uid, version) }
        }
    }
    fun dismiss() { if (!mutable.value.busy) mutable.value = mutable.value.copy(draft = null) }
    fun save(role: String, active: Boolean) {
        val old = mutable.value
        val uid = old.uid ?: return
        val draft = old.draft ?: return
        if (old.busy || !old.ready) return
        val fields = try { AdminAccessPolicy.grant(uid, draft.target, draft.email, draft.name, role, active) }
        catch (e: IllegalArgumentException) { mutable.value = old.copy(message = e.message); return }
        val version = epoch
        mutable.value = old.copy(busy = true, message = null)
        viewModelScope.launch {
            try {
                authorize(uid)
                if (!same(uid, version)) return@launch
                val access = db.collection("adminUsers").document(draft.target)
                val profile = db.collection("userProfiles").document(draft.target)
                val audit = db.collection("adminAudit").document()
                db.runTransaction { tx ->
                    check(same(uid, version)) { "La sesión cambió." }
                    val current = tx.get(access)
                    val registered = if (draft.previous == null) tx.get(profile) else null
                    check(current.data == draft.previous) { "El permiso cambió en otro dispositivo." }
                    if (draft.previous == null) {
                        check(registered?.exists() == true && registered.getString("email") == draft.email) { "El perfil registrado cambió." }
                    }
                    val payload = fields + mapOf("updatedAt" to FieldValue.serverTimestamp(), "updatedBy" to uid)
                    if (current.exists()) tx.update(access, payload)
                    else tx.set(access, payload + ("createdAt" to FieldValue.serverTimestamp()))
                    tx.set(audit, mapOf("action" to "admin.access_saved", "module" to "access",
                        "summary" to "Actualizó un permiso del panel desde Android",
                        "details" to mapOf("targetUid" to draft.target, "role" to role, "active" to active),
                        "actorUid" to uid, "actorEmail" to (auth.currentUser?.email ?: ""),
                        "createdAt" to FieldValue.serverTimestamp()))
                    Unit
                }.await()
                if (same(uid, version)) {
                    // Require a fresh read after saving, including server timestamps and any secure-claim caveat.
                    mutable.value = old.copy(ready = false, draft = null, rows = emptyList(), revision = old.revision + 1,
                        message = "Permiso guardado. Actualiza el listado para consultar su estado actual.")
                }
            } catch (e: CancellationException) { throw e }
            catch (_: Exception) { fail(uid, version) }
        }
    }
}

@Composable
internal fun AdminAccessEntry(uid: String) {
    val model: AdminAccessViewModel = viewModel(key = "admin-access")
    val observed by model.state.collectAsStateWithLifecycle()
    val state = observed.takeIf { it.uid == uid } ?: AdminAccessState(uid)
    var open by remember(uid) { mutableStateOf(false) }
    var query by remember(uid) { mutableStateOf("") }
    DisposableEffect(uid) { onDispose { model.bind(null) } }
    OutlinedButton(onClick = { open = true; query = ""; model.bind(uid) }) { Text("Usuarios, permisos y auditoría") }
    if (open) Dialog(onDismissRequest = { if (!state.busy) { open = false; model.bind(null) } },
        properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxSize().systemBarsPadding()) {
            LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                item {
                    Text("Usuarios y permisos del panel", style = MaterialTheme.typography.headlineSmall)
                    TextButton(onClick = { open = false; model.bind(null) }, enabled = !state.busy) { Text("Cerrar usuarios") }
                    Column {
                        listOf("access" to "Permisos del panel", "users" to "Usuarios registrados", "audit" to "Historial de cambios").forEach { (kind, label) ->
                            FilterChip(selected = state.kind == kind, onClick = { query = ""; model.bind(uid, kind) }, enabled = !state.busy, label = { Text(label) })
                        }
                    }
                    Text("Estos permisos no asignan negocios ni autorizan sellos. Desactivar un permiso del panel conserva la cuenta del visitante.")
                    Text("Si una cuenta también tiene un permiso especial del servidor, desactivar este registro no retira ese otro acceso.")
                    if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                    state.message?.let { Text(it) }
                    OutlinedButton(onClick = { model.bind(uid, state.kind) }, enabled = !state.busy) { Text("Actualizar desde el servidor") }
                    OutlinedTextField(query, { query = it.take(150) }, label = { Text("Buscar entre los registros cargados") }, modifier = Modifier.fillMaxWidth())
                    Text("${state.rows.size} registros cargados" + if (state.complete) "" else " · puede haber más")
                }
                if (state.ready) {
                    val filtered = state.rows.filter { row ->
                        val text = if (state.kind == "audit") "${row.fields["summary"]} ${row.fields["module"]} ${row.fields["actorEmail"]}"
                            else row.name + " " + row.email
                        PlacePolicy.normalize(text).contains(PlacePolicy.normalize(query))
                    }
                    if (filtered.isEmpty()) item { Text("No hay coincidencias entre los registros cargados.") }
                    items(filtered, key = { it.id }) { row ->
                        Card(Modifier.fillMaxWidth()) {
                            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                if (state.kind == "audit") {
                                    Text(row.fields["summary"]?.toString().orEmpty(), style = MaterialTheme.typography.titleMedium)
                                    Text(row.fields["module"]?.toString().orEmpty())
                                    Text(row.fields["actorEmail"]?.toString().orEmpty())
                                    (row.fields["createdAt"] as? com.google.firebase.Timestamp)?.let { time ->
                                        val formatted = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm", java.util.Locale("es", "EC"))
                                            .withZone(AgendaPolicy.zone).format(time.toDate().toInstant())
                                        Text("$formatted · Ecuador")
                                    }
                                } else {
                                    Text(row.name, style = MaterialTheme.typography.titleMedium)
                                    Text(row.email)
                                    if (state.kind == "access") {
                                        Text(if (row.fields["active"] == true) "Permiso activo" else "Permiso desactivado")
                                        Text("Rol: ${row.fields["role"]}")
                                    } else Text(row.fields["city"]?.toString().orEmpty())
                                    if (AdminAccessPolicy.canEdit(uid, row.id, row.email))
                                        OutlinedButton(onClick = { model.inspect(row) }, enabled = !state.busy) { Text("Revisar permiso del panel") }
                                    else Text("Acceso protegido")
                                }
                            }
                        }
                    }
                    if (!state.complete) item { OutlinedButton(onClick = model::load, enabled = !state.busy) { Text("Cargar más registros") } }
                }
            }
        }
    }
    if (open && state.ready) state.draft?.let { draft ->
        key(uid, draft.target, state.revision) {
            var role by remember { mutableStateOf(draft.role) }
            var active by remember { mutableStateOf(draft.active) }
            var confirm by remember { mutableStateOf(false) }
            AlertDialog(onDismissRequest = model::dismiss, title = { Text("Permiso del panel") },
                text = { Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(draft.name); Text(draft.email)
                    Text(if (draft.previous == null) "Esta cuenta todavía no tiene un permiso del panel." else "Editando su permiso existente.")
                    FilterChip(role == "admin", { role = "admin" }, label = { Text("Administrador general") }, enabled = !state.busy)
                    FilterChip(role == "owner", { role = "owner" }, label = { Text("Rol owner del panel") }, enabled = !state.busy)
                    Text(if (role == "admin") "Puede administrar contenido y otros permisos." else "Conserva el alcance owner definido por el panel web. No asigna un negocio.")
                    Row { Checkbox(active, { active = it }, enabled = !state.busy); Text("Permiso activo") }
                    state.message?.let { Text(it) }
                } },
                confirmButton = { TextButton(onClick = { confirm = true }, enabled = !state.busy) { Text("Revisar cambio") } },
                dismissButton = { TextButton(onClick = model::dismiss, enabled = !state.busy) { Text("Cancelar") } })
            if (confirm) AlertDialog(onDismissRequest = { confirm = false }, title = { Text("Confirmar permiso") },
                text = { Text("${draft.email}: rol $role, permiso ${if (active) "activo" else "desactivado"}. Este cambio afecta también al panel web.") },
                confirmButton = { TextButton(onClick = { confirm = false; model.save(role, active) }, enabled = !state.busy) { Text("Guardar permiso") } },
                dismissButton = { TextButton(onClick = { confirm = false }) { Text("Volver") } })
        }
    }
}
