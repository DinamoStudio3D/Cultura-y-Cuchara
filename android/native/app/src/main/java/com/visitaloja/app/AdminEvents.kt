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

internal object AdminEventPolicy {
    val fields = linkedMapOf("title" to "Título", "titleEn" to "Título en inglés", "date" to "Fecha (AAAA-MM-DD)",
        "time" to "Hora en Ecuador (HH:mm)", "type" to "Tipo de evento", "location" to "Lugar",
        "desc" to "Descripción", "descEn" to "Descripción en inglés", "img" to "Enlace HTTPS del afiche",
        "bannerImg" to "Enlace HTTPS del banner", "lat" to "Latitud", "lng" to "Longitud")
    fun patch(values: Map<String, String>, publication: String): Map<String, Any> {
        require(publication in setOf("published", "draft", "hidden")) { "Elige un estado válido." }
        val title = values["title"].orEmpty().trim()
        require(title.length in 2..140) { "El título debe tener de 2 a 140 caracteres." }
        java.time.LocalDate.parse(values["date"].orEmpty())
        require(values["time"].orEmpty().matches(Regex("[0-9]{2}:[0-9]{2}"))) { "Escribe la hora como HH:mm." }
        java.time.LocalTime.parse(values["time"])
        require(values["location"].orEmpty().trim().length in 1..180) { "Escribe el lugar del evento." }
        require(values["desc"].orEmpty().trim().length in 1..700 && values["descEn"].orEmpty().length <= 700)
        require(values["titleEn"].orEmpty().length <= 140 && values["type"].orEmpty().length <= 80)
        for (field in listOf("img", "bannerImg"))
            require(values[field].isNullOrBlank() || (values[field]!!.length <= 2000 && PlacePolicy.safeImage(values[field]) != null)) { "Las imágenes necesitan un enlace HTTPS válido." }
        val lat = values["lat"].orEmpty().toDoubleOrNull()
        val lng = values["lng"].orEmpty().toDoubleOrNull()
        require(PlacePolicy.safeCoordinate(lat, true) != null && PlacePolicy.safeCoordinate(lng, false) != null) { "Revisa las coordenadas del evento." }
        return fields.keys.filter { it !in setOf("lat", "lng") }.associateWith { values[it].orEmpty().trim() } +
            mapOf("lat" to lat!!, "lng" to lng!!, "publicationStatus" to publication)
    }
}
internal data class AdminEventsState(val uid: String? = null, val busy: Boolean = false, val ready: Boolean = false,
    val events: List<Map<String, Any?>> = emptyList(), val message: String? = null, val revision: Int = 0)
internal class AdminEventsViewModel : ViewModel() {
    private val auth = FirebaseAuth.getInstance()
    private val db = FirebaseFirestore.getInstance()
    private val mutable = MutableStateFlow(AdminEventsState())
    val state = mutable.asStateFlow()
    private var epoch = 0
    private fun same(uid: String, version: Int) = epoch == version && auth.currentUser?.uid == uid && mutable.value.uid == uid
    private suspend fun authorize(uid: String) {
        val user = auth.currentUser?.takeIf { it.uid == uid } ?: error("La sesión cambió.")
        val token = user.getIdToken(true).await()
        val allowed = AdminPlacePolicy.allowed(user.email, token.claims, emptyMap()) ||
            AdminPlacePolicy.allowed(user.email, token.claims, db.collection("adminUsers").document(uid).get(Source.SERVER).await().data.orEmpty())
        check(allowed) { "Acceso administrativo no autorizado." }
    }
    fun bind(uid: String?) {
        val version = ++epoch
        mutable.value = AdminEventsState(uid, busy = uid != null)
        if (uid == null) return
        viewModelScope.launch {
            try {
                authorize(uid)
                if (!same(uid, version)) return@launch
                val doc = db.collection("siteContent").document("events").get(Source.SERVER).await()
                val raw = doc.get("events") as? List<*> ?: emptyList<Any>()
                val events = raw.map { row ->
                    val map = row as? Map<*, *> ?: error("Hay un evento con formato no compatible. Revísalo en la web.")
                    map.entries.associate { it.key.toString() to it.value }
                }
                check(events.all { it["id"] is String && (it["id"] as String).isNotBlank() } &&
                    events.map { it["id"] }.distinct().size == events.size) { "Hay identificadores de evento que necesitan revisión en la web." }
                if (same(uid, version)) mutable.value = AdminEventsState(uid, ready = true, events = events)
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { if (same(uid, version)) mutable.value = AdminEventsState(uid, message = e.message ?: "No se pudo cargar la agenda.") }
        }
    }
    fun save(id: String, values: Map<String, String>, publication: String, creating: Boolean) {
        val old = mutable.value
        val uid = old.uid ?: return
        if (!old.ready || old.busy) return
        val patch = try { AdminEventPolicy.patch(values, publication) }
        catch (_: Exception) { mutable.value = old.copy(message = "Revisa título, fecha, hora, lugar, descripción, imágenes y coordenadas."); return }
        val version = epoch
        mutable.value = old.copy(busy = true, message = null)
        viewModelScope.launch {
            try {
                authorize(uid)
                if (!same(uid, version)) return@launch
                val ref = db.collection("siteContent").document("events")
                val audit = db.collection("adminAudit").document()
                val original = old.events.find { it["id"] == id }
                check(if (creating) original == null else original != null) { "Actualiza la agenda antes de guardar." }
                val row = original.orEmpty() + patch + mapOf("id" to id)
                val events = if (creating) old.events + listOf(row) else old.events.map { if (it["id"] == id) row else it }
                db.runTransaction { tx ->
                    check(same(uid, version)) { "La sesión cambió." }
                    val current = tx.get(ref)
                    check((current.get("events") ?: emptyList<Any>()) == old.events) { "La agenda cambió desde otro dispositivo. Actualiza antes de guardar." }
                    tx.set(ref, mapOf("events" to events, "updatedAt" to FieldValue.serverTimestamp(),
                        "updatedBy" to (auth.currentUser?.email ?: "")), SetOptions.merge())
                    tx.set(audit, mapOf("action" to if (creating) "create" else "update", "module" to "events",
                        "summary" to "Edición de evento desde Android", "details" to mapOf("eventId" to id),
                        "actorUid" to uid, "actorEmail" to (auth.currentUser?.email ?: ""), "createdAt" to FieldValue.serverTimestamp()))
                    Unit
                }.await()
                if (same(uid, version)) mutable.value = old.copy(events = events, revision = old.revision + 1,
                    message = "Evento guardado en la agenda compartida.")
            } catch (e: CancellationException) { throw e }
            catch (_: Exception) { if (same(uid, version)) mutable.value = old.copy(ready = false,
                message = "No se pudo confirmar el guardado. Actualiza la agenda y los permisos antes de continuar.") }
        }
    }
}

@Composable
internal fun AdminEventsEntry(uid: String) {
    val model: AdminEventsViewModel = viewModel(key = "admin-events")
    val observed by model.state.collectAsStateWithLifecycle()
    val state = observed.takeIf { it.uid == uid } ?: AdminEventsState(uid)
    var open by remember(uid) { mutableStateOf(false) }
    var editing by remember(uid) { mutableStateOf<Map<String, Any?>?>(null) }
    var creating by remember(uid) { mutableStateOf(false) }
    DisposableEffect(uid) { onDispose { model.bind(null) } }
    OutlinedButton(onClick = { open = true; model.bind(uid) }) { Text("Administrar eventos") }
    if (open) Dialog(onDismissRequest = { if (!state.busy) { open = false; editing = null; model.bind(null) } },
        properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxSize().systemBarsPadding()) {
            LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                item {
                    Text("Agenda · administración", style = MaterialTheme.typography.headlineSmall)
                    Text("La fecha y hora se interpretan en Ecuador. El evento deja de mostrarse una hora después de iniciar.")
                    TextButton(onClick = { open = false; editing = null; model.bind(null) }, enabled = !state.busy) { Text("Cerrar eventos") }
                    if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                    state.message?.let { Text(it) }
                    OutlinedButton(onClick = { editing = null; model.bind(uid) }, enabled = !state.busy) { Text("Actualizar agenda y permisos") }
                    Button(onClick = { creating = true; editing = mapOf("id" to ("ev_" + java.util.UUID.randomUUID()), "publicationStatus" to "draft", "time" to "18:00", "type" to "Otro") },
                        enabled = state.ready && !state.busy) { Text("Crear evento") }
                }
                if (state.ready) items(state.events, key = { it["id"].toString() }) { row ->
                    OutlinedCard(onClick = { creating = false; editing = row }, enabled = !state.busy, modifier = Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(16.dp)) {
                            Text(row["title"]?.toString().orEmpty(), style = MaterialTheme.typography.titleMedium)
                            Text("${row["date"]} · ${row["time"]}")
                            Text(row["publicationStatus"]?.toString() ?: "published")
                        }
                    }
                }
            }
        }
    }
    if (open) editing?.let { row ->
        key(uid, row["id"]) {
            var values by remember { mutableStateOf(AdminEventPolicy.fields.keys.associateWith { row[it]?.toString().orEmpty() }) }
            var publication by remember { mutableStateOf(row["publicationStatus"]?.toString() ?: "published") }
            var confirm by remember { mutableStateOf(false) }
            val initialRevision = remember { state.revision }
            LaunchedEffect(state.revision) { if (state.revision != initialRevision) editing = null }
            AlertDialog(onDismissRequest = { if (!state.busy) editing = null }, title = { Text(if (creating) "Nuevo evento" else "Editar evento") },
                text = { Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    AdminEventPolicy.fields.forEach { (field, label) ->
                        OutlinedTextField(values[field].orEmpty(), { values = values + (field to it.take(if (field in listOf("img", "bannerImg")) 2000 else 700)) },
                            label = { Text(label) }, enabled = !state.busy)
                    }
                    listOf("draft" to "Borrador", "published" to "Publicado", "hidden" to "Oculto").forEach { (value, label) ->
                        FilterChip(publication == value, { publication = value }, label = { Text(label) }, enabled = !state.busy)
                    }
                    state.message?.let { Text(it) }
                } },
                confirmButton = { TextButton(onClick = { confirm = true }, enabled = state.ready && !state.busy) { Text("Revisar evento") } },
                dismissButton = { TextButton(onClick = { editing = null }, enabled = !state.busy) { Text("Cancelar") } })
            if (confirm) AlertDialog(onDismissRequest = { confirm = false }, title = { Text("Guardar en la agenda compartida") },
                text = { Text("«${values["title"]}» · ${values["date"]} a las ${values["time"]} (Ecuador). Estado: $publication. El cambio también aparece en la web.") },
                confirmButton = { TextButton(onClick = { confirm = false; model.save(row["id"].toString(), values, publication, creating) }, enabled = !state.busy) { Text("Guardar evento") } },
                dismissButton = { TextButton(onClick = { confirm = false }) { Text("Volver") } })
        }
    }
}
