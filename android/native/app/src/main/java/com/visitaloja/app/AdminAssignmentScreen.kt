package com.visitaloja.app

import androidx.compose.foundation.horizontalScroll
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
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel

@Composable
internal fun AdminAssignmentEntry(uid: String) {
    val model: AdminAssignmentViewModel = viewModel(key = "admin-business-assignments")
    val observed by model.state.collectAsStateWithLifecycle()
    val state = observed.takeIf { it.uid == uid } ?: AdminAssignmentState(uid)
    var open by remember(uid) { mutableStateOf(false) }
    var query by remember(uid) { mutableStateOf("") }
    var placeQuery by remember(uid) { mutableStateOf("") }
    var review by remember(uid) { mutableStateOf(false) }
    var discard by remember(uid) { mutableStateOf(false) }
    DisposableEffect(uid) { onDispose { model.bind(null) } }
    OutlinedButton(onClick = { open = true; query = ""; model.bind(uid) }) { Text("Asignar negocios a responsables") }
    fun closeDraft() {
        val draft = state.draft ?: return
        if (state.busy) return
        if (draft.selected != draft.initial || draft.active != draft.initiallyActive) discard = true else model.dismiss()
    }
    if (open) Dialog(onDismissRequest = { if (!state.busy) { open = false; model.bind(null) } },
        properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxSize().systemBarsPadding()) {
            LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                item {
                    Text("Accesos de negocios", style = MaterialTheme.typography.headlineSmall)
                    TextButton(onClick = { open = false; model.bind(null) }, enabled = !state.busy) { Text("Cerrar accesos") }
                    Text("Selecciona una cuenta existente y verifica su correo antes de autorizar sus paradas.")
                    Text("Estos accesos no convierten a la persona en administrador general ni cambian su contraseña. Tampoco retiran permisos administrativos que ya tuviera.")
                    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        listOf("merchants" to "Cuentas de negocios", "users" to "Usuarios registrados", "requests" to "Solicitudes").forEach { (key, title) ->
                            FilterChip(state.kind == key, { query = ""; model.bind(uid, key) }, label = { Text(title) }, enabled = !state.busy)
                        }
                    }
                    if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                    state.message?.let { Text(it) }
                    OutlinedButton(onClick = { model.bind(uid, state.kind) }, enabled = !state.busy) { Text("Actualizar cuentas y permisos") }
                    OutlinedTextField(query, { query = it.take(150) }, label = { Text("Buscar en las cuentas cargadas") }, modifier = Modifier.fillMaxWidth())
                    Text(state.rows.size.toString() + " cuentas cargadas" + if (state.more) " · hay más por cargar" else "")
                    if (state.kind == "requests") Text("Aquí se asignan paradas. La revisión de campañas y premios de pasaporte se conserva por separado.")
                }
                if (state.ready) {
                    val rows = state.rows.filter { PlacePolicy.normalize(it.name + " " + it.email + " " + it.fields.text("businessName"))
                        .contains(PlacePolicy.normalize(query)) }
                    if (rows.isEmpty()) item { Text("No hay cuentas que coincidan entre los registros cargados.") }
                    items(rows, key = { it.id }) { row ->
                        OutlinedCard(Modifier.fillMaxWidth()) {
                            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(row.fields.text("businessName").ifBlank { row.name }, style = MaterialTheme.typography.titleMedium)
                                Text(row.email)
                                if (state.kind == "merchants") Text(if (row.fields["active"] == false) "Cuenta pausada" else "Cuenta habilitada")
                                if (state.kind == "requests") Text("Solicitud: " + row.fields.text("status"))
                                OutlinedButton(onClick = { placeQuery = ""; model.inspect(row) }, enabled = !state.busy && row.email.isNotBlank()) {
                                    Text("Revisar paradas y roles")
                                }
                            }
                        }
                    }
                    if (state.more) item { OutlinedButton(onClick = model::load, enabled = !state.busy) { Text("Cargar más cuentas") } }
                }
            }
        }
    }
    val draft = state.draft
    if (open && state.ready && draft != null) Dialog(onDismissRequest = ::closeDraft,
        properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxSize().systemBarsPadding()) {
            LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                item {
                    Text(draft.name, style = MaterialTheme.typography.headlineSmall)
                    Text(draft.email)
                    TextButton(onClick = ::closeDraft, enabled = !state.busy) { Text("Volver a cuentas") }
                    if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                    state.message?.let { Text(it) }
                    Row {
                        Checkbox(draft.active, { model.edit(draft.copy(active = it)) }, enabled = !state.busy)
                        Text("Cuenta habilitada")
                    }
                    Text("Propietario: puede editar la ficha y operar visitas. Encargado: puede operar visitas y premios de fidelidad, sin conceder edición de ficha.")
                    Text("Los accesos anteriores de solo ficha se conservan sin habilitar visitas. No se agregan permisos de campañas ni administración general.")
                    Text("Pausar deshabilita los accesos revisados y las validaciones de campañas existentes de esta cuenta.")
                    OutlinedTextField(placeQuery, { placeQuery = it.take(150) }, label = { Text("Buscar entre las paradas cargadas") }, modifier = Modifier.fillMaxWidth())
                    Text(draft.selected.size.toString() + " paradas seleccionadas · " + state.places.size + " cargadas")
                }
                val selectedFirst = state.places.filter { PlacePolicy.normalize(it.name).contains(PlacePolicy.normalize(placeQuery)) }
                    .sortedWith(compareByDescending<AssignmentPlace> { it.id in draft.selected }.thenBy { it.name })
                items(selectedFirst, key = { it.id }) { place ->
                    val role = draft.selected[place.id]
                    OutlinedCard(Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Row {
                                Checkbox(role != null, { checked ->
                                    model.edit(draft.copy(selected = if (checked) draft.selected +
                                        (place.id to (draft.initial[place.id] ?: "staff")) else draft.selected - place.id))
                                }, enabled = !state.busy && (place.available || place.id in draft.initial))
                                Text(place.name, style = MaterialTheme.typography.titleMedium)
                            }
                            if (!place.available) Text("Parada no disponible. Puedes conservar o retirar su asignación anterior.")
                            if (role != null) AdminAssignmentPolicy.roles.filterKeys { it != "profile" || draft.initial[place.id] == "profile" }.forEach { (key, label) ->
                                FilterChip(role == key, { model.edit(draft.copy(selected = draft.selected + (place.id to key))) },
                                    label = { Text(label) }, enabled = !state.busy && place.available)
                            }
                        }
                    }
                }
                if (state.morePlaces) item { OutlinedButton(onClick = model::morePlaces, enabled = !state.busy) { Text("Cargar más paradas") } }
                item {
                    Text("Los cambios se aplican únicamente al confirmar el guardado.")
                    Button(onClick = { review = true }, enabled = !state.busy, modifier = Modifier.fillMaxWidth()) { Text("Revisar asignación") }
                }
            }
        }
    }
    if (review && draft != null && state.ready) AlertDialog(onDismissRequest = { review = false },
        title = { Text("Confirmar accesos de negocio") },
        text = { Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(draft.email)
            Text(if (draft.active) "Cuenta habilitada" else "Cuenta pausada: también se deshabilita la edición de las fichas revisadas.")
            if (draft.selected.isEmpty()) Text("Se retirarán todas las paradas de esta asignación.")
            draft.selected.forEach { (id, role) ->
                Text((state.places.firstOrNull { it.id == id }?.name ?: id) + " · " + AdminAssignmentPolicy.roles.getValue(role))
            }
            draft.initial.keys.filter { it !in draft.selected }.forEach { id ->
                Text("Retirar: " + (state.places.firstOrNull { it.id == id }?.name ?: id))
            }
            Text("Esto cambia los mismos accesos usados por la web. No se crean cuentas nuevas ni se modifican contraseñas.")
        } },
        confirmButton = { TextButton(onClick = { review = false; model.save() }, enabled = !state.busy) { Text("Guardar accesos") } },
        dismissButton = { TextButton(onClick = { review = false }) { Text("Volver") } })
    if (discard) AlertDialog(onDismissRequest = { discard = false }, title = { Text("¿Descartar esta asignación?") },
        text = { Text("Los cambios pendientes no se guardarán.") },
        confirmButton = { TextButton(onClick = { discard = false; model.dismiss() }) { Text("Descartar y volver") } },
        dismissButton = { TextButton(onClick = { discard = false }) { Text("Seguir editando") } })
}
