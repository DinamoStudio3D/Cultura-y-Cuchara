package com.visitaloja.app

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage

@Composable
internal fun AdminMissionsEntry(uid: String) {
    val model: AdminMissionsViewModel = viewModel(key = "admin-missions")
    val observed by model.state.collectAsStateWithLifecycle()
    val state = observed.takeIf { it.uid == uid } ?: AdminMissionState()
    var open by remember(uid) { mutableStateOf(false) }
    var query by remember(uid) { mutableStateOf("") }
    var filter by remember(uid) { mutableStateOf("") }
    var templates by remember(uid) { mutableStateOf(false) }
    var drafts by remember(uid) { mutableStateOf(false) }
    var discard by remember(uid) { mutableStateOf(false) }
    var review by remember(uid) { mutableStateOf(false) }
    var preview by remember(uid) { mutableStateOf(false) }
    DisposableEffect(uid) { onDispose { model.bind(null) } }
    fun closeDraft() { if (state.busy) return; val d = state.draft ?: return; if (d.original == null || d.text != AdminMissionPolicy.draft(d.id, d.original).text) discard = true else model.dismiss() }
    OutlinedButton(onClick = { open = true; model.bind(uid) }) { Text("Administrar misiones Chabaquito V2") }
    if (open) Dialog(onDismissRequest = { if (state.draft != null) closeDraft() else if (!state.busy) { open = false; model.bind(null) } }, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxSize().systemBarsPadding()) {
            LazyColumn(Modifier.fillMaxSize().imePadding(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                item {
                    Text("Misiones Chabaquito V2", style = MaterialTheme.typography.headlineSmall)
                    TextButton(onClick = { if (state.draft != null) closeDraft() else { open = false; model.bind(null) } }, enabled = !state.busy) { Text(if (state.draft == null) "Cerrar" else "Volver al catálogo") }
                    if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                    state.message?.let { Text(it) }
                }
                val draft = state.draft
                if (state.ready && draft == null) {
                    item {
                        Text("Gestiona las definiciones de retos basados en visitas validadas. Los cambios se comparten con la web. Archivar conserva la definición; este editor no borra ni modifica progreso o insignias de usuarios.")
                        Button(onClick = { model.select() }, enabled = !state.busy) { Text("Crear misión en borrador") }
                        OutlinedButton(onClick = { templates = true }, enabled = !state.busy) { Text("Elegir plantilla inicial") }
                        OutlinedButton(onClick = { model.bind(uid) }, enabled = !state.busy) { Text("Actualizar catálogo y permisos") }
                        OutlinedButton(onClick = { model.local("list"); drafts = true }, enabled = !state.busy) { Text("Recuperar borrador de este teléfono") }
                        OutlinedTextField(query, { query = it.take(150) }, label = { Text("Buscar por título o ID") }, modifier = Modifier.fillMaxWidth())
                        Row(Modifier.horizontalScroll(rememberScrollState())) { FilterChip(filter.isBlank(), { filter = "" }, label = { Text("Todas") }); AdminMissionPolicy.statuses.forEach { (key, label) -> FilterChip(filter == key, { filter = key }, label = { Text(label) }) } }
                        Text("${state.rows.size} misiones cargadas")
                    }
                    val rows = state.rows.filter { (filter.isBlank() || it.data.text("status") == filter) && PlacePolicy.normalize(it.id + " " + it.data.text("title")).contains(PlacePolicy.normalize(query)) }
                    if (rows.isEmpty()) item { Text("No hay misiones que coincidan.") }
                    items(rows, key = { it.id }) { row ->
                        OutlinedCard(Modifier.fillMaxWidth()) { Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(row.data.text("title").ifBlank { row.id }, style = MaterialTheme.typography.titleMedium)
                            Text((AdminMissionPolicy.statuses[row.data.text("status")] ?: row.data.text("status")) + " · Meta: " + row.data["targetCount"])
                            Text(row.data.text("description")); Text(row.id, style = MaterialTheme.typography.labelSmall)
                            OutlinedButton(onClick = { model.select(row.id) }, enabled = !state.busy) { Text("Editar misión") }
                        } }
                    }
                } else if (state.ready && draft != null) {
                    item {
                        OutlinedTextField(draft.id, { model.edit("id", it) }, label = { Text("ID permanente de misión") }, readOnly = draft.original != null, enabled = !state.busy, modifier = Modifier.fillMaxWidth())
                        Text("Para un reto diferente, crea una misión con otro ID. Cambiar la meta de un reto existente puede afectar la evaluación de visitas futuras; no reinicia los logros ya guardados.")
                        if (draft.original?.text("rewardType") == "digital_physical") Text("Esta misión está vinculada a una campaña física. Se conserva ese vínculo; su premio y permisos se administran por separado.")
                        MissionChoices("Estado", draft.text["status"].orEmpty(), AdminMissionPolicy.statuses, !state.busy) { model.edit("status", it); if (it == "active") model.edit("_activate", "true") }
                        if (draft.original?.get("active") == false || draft.original?.get("hidden") == true) Text("Tiene una ocultación anterior. Seleccionar Activa y confirmar también levantará ese bloqueo.")
                        MissionChoices("Qué debe hacer el visitante", draft.text["type"].orEmpty(), AdminMissionPolicy.types, !state.busy) { if (it != draft.text["type"]) { model.edit("type", it); model.edit("scope", "") } }
                        Text(when (draft.text["type"]) {
                            "place_visits" -> "Solo cuentan estas paradas, una vez cada una. Escribe los IDs exactos. La meta no puede superar la cantidad de IDs únicos."
                            "category_visits" -> "Cuenta paradas diferentes de las categorías indicadas. Usa los valores de categoría configurados para Chabaquito, uno por línea."
                            "canton_visits" -> "Cuenta cantones diferentes. Usa los cantonId de Chabaquito (ejemplo: loja, catamayo). La meta no puede superar la cantidad de cantones indicados."
                            "total_visits" -> "Cuenta visitas validadas. No necesita una lista de paradas."
                            else -> "Cuenta paradas diferentes visitadas. No necesita una lista de paradas."
                        })
                    }
                    items(AdminMissionPolicy.fields.entries.filter { it.key != "scope" || draft.text["type"] !in setOf("total_visits", "unique_places") }, key = { it.key }) { field ->
                        OutlinedTextField(draft.text[field.key].orEmpty(), { model.edit(field.key, it.take(field.value.second)) }, label = { Text(field.value.first) }, enabled = !state.busy, modifier = Modifier.fillMaxWidth())
                    }
                    item {
                        MissionChoices("Rareza de insignia", draft.text["badge.rarity"].orEmpty(), AdminMissionPolicy.rarities, !state.busy) { model.edit("badge.rarity", it) }
                        Text("Los enlaces de insignia se editan como en el contrato compartido; no se añadió una subida de insignias en este editor.")
                        OutlinedButton(onClick = { preview = true }, enabled = !state.busy) { Text("Previsualizar misión e insignia") }
                        OutlinedButton(onClick = { model.local("save") }, enabled = !state.busy && draft.id.isNotBlank()) { Text("Guardar borrador local sin publicar") }
                        Button(onClick = { review = true }, enabled = !state.busy) { Text("Revisar y guardar misión") }
                    }
                }
            }
        }
    }
    if (templates) Dialog(onDismissRequest = { templates = false }) {
        Surface { LazyColumn(Modifier.fillMaxHeight(.85f).padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item { Text("Plantillas iniciales", style = MaterialTheme.typography.titleLarge); Text("Se cargan en borrador y requieren confirmación. Una plantilla no reemplaza una misión existente con el mismo ID."); TextButton(onClick = { templates = false }) { Text("Volver") } }
            items(state.templates, key = { it.text("id") }) { row ->
                OutlinedButton(onClick = { model.select(template = row.text("id")); templates = false }, modifier = Modifier.fillMaxWidth(), enabled = !state.busy) { Text(row.text("title") + if (state.rows.any { it.id == row.text("id") }) " · ya existe" else "") }
            }
        } }
    }
    if (drafts) AdminDraftPicker(state.localDrafts, state.busy, state.message, { drafts = false }, { id -> drafts = false; model.local("restore", id) }, { id -> model.local("delete", id) })
    if (preview) Dialog(onDismissRequest = { preview = false }) {
        Surface { LazyColumn(Modifier.fillMaxHeight(.85f).padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item {
                val d = state.draft
                Text("Vista previa sin guardar", style = MaterialTheme.typography.titleLarge)
                TextButton(onClick = { preview = false }) { Text("Volver al editor") }
                Text(d?.text?.get("title").orEmpty(), style = MaterialTheme.typography.titleLarge); Text(d?.text?.get("description").orEmpty())
                Text("Meta: " + d?.text?.get("targetCount") + " · " + MissionPolicy.unit(d?.text?.get("type").orEmpty()))
                Text(d?.text?.get("badge.icon").orEmpty() + " " + d?.text?.get("badge.title").orEmpty(), style = MaterialTheme.typography.titleMedium)
                Text(d?.text?.get("badge.description").orEmpty()); DiscoveryPolicy.media(d?.text?.get("badge.imageUrl").orEmpty())?.let { AsyncImage(it, "Insignia", Modifier.fillMaxWidth().height(140.dp), contentScale = ContentScale.Fit) }
                Text("La validación de visitas y la entrega de insignias siguen a cargo del servicio de misiones. Esta muestra no genera progreso ni recompensas.")
            }
        } }
    }
    if (review) AlertDialog(onDismissRequest = { review = false }, title = { Text("Guardar definición de misión") }, text = { Text("Estado: " + (AdminMissionPolicy.statuses[state.draft?.text?.get("status")] ?: "") + "\nUna misión activa estará disponible dentro de sus fechas. Cambiar tipo, alcance o meta puede afectar las visitas futuras. Se conservan los registros de progreso e insignias ya existentes.") }, confirmButton = { TextButton(onClick = { review = false; model.save() }) { Text("Confirmar guardado") } }, dismissButton = { TextButton(onClick = { review = false }) { Text("Seguir editando") } })
    if (discard) AlertDialog(onDismissRequest = { discard = false }, title = { Text("Descartar cambios del formulario") }, text = { Text("La misión guardada y los borradores locales que ya guardaste se conservan.") }, confirmButton = { TextButton(onClick = { model.dismiss(); discard = false }) { Text("Descartar formulario") } }, dismissButton = { TextButton(onClick = { discard = false }) { Text("Conservar cambios") } })
}
@Composable
private fun MissionChoices(title: String, selected: String, options: Map<String, String>, enabled: Boolean, change: (String) -> Unit) {
    Text(title, style = MaterialTheme.typography.titleSmall)
    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) { options.forEach { (key, label) -> FilterChip(selected == key, { change(key) }, label = { Text(label) }, enabled = enabled) } }
}
