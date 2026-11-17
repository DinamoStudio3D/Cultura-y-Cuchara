package com.visitaloja.app

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
internal fun AdminCantonsEntry(uid: String) {
    val model: AdminCantonViewModel = viewModel(key = "admin-cantons")
    val observed by model.state.collectAsStateWithLifecycle()
    val state = observed.takeIf { it.uid == uid } ?: AdminCantonState()
    var open by remember(uid) { mutableStateOf(false) }
    var selected by remember(uid) { mutableStateOf("") }
    var discard by remember(uid) { mutableStateOf(false) }
    var reload by remember(uid) { mutableStateOf(false) }
    var review by remember(uid) { mutableStateOf(false) }
    var preview by remember(uid) { mutableStateOf(false) }
    var picker by remember(uid) { mutableStateOf<Int?>(null) }
    var query by remember(uid, picker) { mutableStateOf("") }
    val imagePicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri -> if (uri != null) model.upload(uri) }
    DisposableEffect(uid) { onDispose { model.bind(null, "") } }
    fun close() {
        if (state.busy) return
        if (selected.isNotBlank() && state.draft != state.initial) discard = true
        else { if (selected.isNotBlank()) { selected = ""; model.bind(null, "") } else open = false }
    }
    fun updateRoute(index: Int, route: CantonEditRoute) {
        if (index in state.draft.routes.indices) model.edit(state.draft.copy(routes = state.draft.routes.mapIndexed { i, row -> if (i == index) route else row }))
    }
    fun name(id: String) = state.places.firstOrNull { it.id == id }?.name ?: "Referencia no disponible: $id"
    OutlinedButton(onClick = { open = true }) { Text("Editar cantones y rutas") }
    if (open) Dialog(onDismissRequest = ::close, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxSize().systemBarsPadding()) {
            LazyColumn(Modifier.fillMaxSize().imePadding(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                item {
                    Text("Cantones y rutas", style = MaterialTheme.typography.headlineSmall)
                    TextButton(onClick = ::close, enabled = !state.busy) { Text(if (selected.isBlank()) "Cerrar" else "Volver a cantones") }
                    if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                    state.message?.let { Text(it) }
                }
                if (selected.isBlank()) items(CantonPolicy.catalogue, key = { it.id }) { canton ->
                    OutlinedButton(onClick = { selected = canton.id; model.bind(uid, canton.id) }, modifier = Modifier.fillMaxWidth()) { Text(canton.name) }
                } else {
                    item {
                        Text(CantonPolicy.catalogue.firstOrNull { it.id == selected }?.name.orEmpty(), style = MaterialTheme.typography.titleLarge)
                        Text("Guardar publica la guía en la web y la app. La duración de las rutas es orientativa, no un cálculo de navegación.")
                        OutlinedButton(onClick = { if (state.draft != state.initial) reload = true else model.bind(uid, selected) }, enabled = !state.busy) { Text("Actualizar desde la web") }
                    }
                    if (state.ready || state.draft != CantonEditDraft()) {
                        items(AdminCantonPolicy.fields.keys.toList(), key = { it }) { key ->
                            val info = AdminCantonPolicy.fields.getValue(key)
                            OutlinedTextField(state.draft.text[key].orEmpty(), { model.edit(state.draft.copy(text = state.draft.text + (key to it.take(info.second)))) },
                                label = { Text(info.first) }, enabled = state.ready && !state.busy, modifier = Modifier.fillMaxWidth())
                            if (key == "cover") {
                                OutlinedButton(onClick = { imagePicker.launch("image/*") }, enabled = state.ready && !state.busy) { Text("Elegir portada del teléfono") }
                                val cover = CantonPolicy.guide(state.draft.text).cover
                                if (cover != null) AsyncImage(cover, "Portada del cantón", Modifier.fillMaxWidth().height(180.dp), contentScale = ContentScale.Fit)
                                Text("Una portada subida se publica al guardar. Si descartas el formulario, la guía conserva la anterior.")
                            }
                        }
                        item {
                            Text("Lugares destacados · " + state.draft.featured.size + "/16", style = MaterialTheme.typography.titleMedium)
                            CantonOrderedPlaces(state.draft.featured, ::name, state.ready && !state.busy) { model.edit(state.draft.copy(featured = it)) }
                            OutlinedButton(onClick = { picker = -1 }, enabled = state.ready && !state.busy && state.draft.featured.size < 16) { Text("Añadir lugar destacado") }
                        }
                        items(state.draft.routes.withIndex().toList(), key = { it.value.key }) { entry ->
                            val index = entry.index; val route = entry.value
                            OutlinedCard(Modifier.fillMaxWidth()) {
                                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Text("Ruta " + (index + 1), style = MaterialTheme.typography.titleMedium)
                                    OutlinedTextField(route.title, { updateRoute(index, route.copy(title = it.take(100))) }, label = { Text("Título de la ruta") }, enabled = state.ready && !state.busy)
                                    OutlinedTextField(route.duration, { updateRoute(index, route.copy(duration = it.take(80))) }, label = { Text("Duración orientativa") }, enabled = state.ready && !state.busy)
                                    OutlinedTextField(route.notes, { updateRoute(index, route.copy(notes = it.take(1000))) }, label = { Text("Notas de la ruta") }, enabled = state.ready && !state.busy)
                                    Text("De 2 a 12 paradas, en el orden del recorrido")
                                    CantonOrderedPlaces(route.placeIds, ::name, state.ready && !state.busy) { updateRoute(index, route.copy(placeIds = it)) }
                                    OutlinedButton(onClick = { picker = index }, enabled = state.ready && !state.busy && route.placeIds.size < 12) { Text("Añadir parada a la ruta") }
                                    Row {
                                        TextButton(onClick = {
                                            val rows = state.draft.routes.toMutableList(); rows.add(index - 1, rows.removeAt(index)); model.edit(state.draft.copy(routes = rows))
                                        }, enabled = state.ready && !state.busy && index > 0) { Text("Subir ruta") }
                                        TextButton(onClick = {
                                            val rows = state.draft.routes.toMutableList(); rows.add(index + 1, rows.removeAt(index)); model.edit(state.draft.copy(routes = rows))
                                        }, enabled = state.ready && !state.busy && index < state.draft.routes.lastIndex) { Text("Bajar ruta") }
                                        TextButton(onClick = { model.edit(state.draft.copy(routes = state.draft.routes.filterIndexed { i, _ -> i != index })) }, enabled = state.ready && !state.busy) { Text("Quitar ruta") }
                                    }
                                }
                            }
                        }
                        item {
                            OutlinedButton(onClick = { model.edit(state.draft.copy(routes = state.draft.routes + CantonEditRoute())) }, enabled = state.ready && !state.busy && state.draft.routes.size < 8) { Text("Añadir ruta · máximo 8") }
                            OutlinedButton(onClick = { preview = true }, enabled = !state.busy) { Text("Previsualizar guía") }
                            Button(onClick = { review = true }, enabled = state.ready && !state.busy && state.draft != state.initial) { Text("Revisar y publicar cambios") }
                            Text("Las fichas de las paradas se editan desde Paradas. Este editor cambia la guía y sus recomendaciones.")
                        }
                    }
                }
            }
        }
    }
    val destination = picker
    if (open && destination != null) Dialog(onDismissRequest = { picker = null }) {
        Surface {
            LazyColumn(Modifier.fillMaxHeight(.85f).padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                item {
                    Text("Elegir parada publicada")
                    OutlinedTextField(query, { query = it.take(150) }, label = { Text("Buscar por nombre") })
                    TextButton(onClick = { picker = null }) { Text("Volver") }
                    Text("Se muestran hasta 50 coincidencias. Escribe para buscar en todo el catálogo cargado.")
                }
                val existing = if (destination == -1) state.draft.featured else state.draft.routes.getOrNull(destination)?.placeIds.orEmpty()
                val rows = state.places.filter { AdminCantonPolicy.publicPlace(it.raw, selected) && it.id !in existing && PlacePolicy.normalize(it.name).contains(PlacePolicy.normalize(query)) }.take(50)
                if (rows.isEmpty()) item { Text("No hay paradas publicadas disponibles que coincidan.") }
                items(rows, key = { it.id }) { row ->
                    OutlinedButton(onClick = {
                        if (destination == -1 && state.draft.featured.size < 16) model.edit(state.draft.copy(featured = state.draft.featured + row.id))
                        else state.draft.routes.getOrNull(destination)?.takeIf { it.placeIds.size < 12 }?.let { updateRoute(destination, it.copy(placeIds = it.placeIds + row.id)) }
                        picker = null
                    }) { Text(row.name) }
                }
            }
        }
    }
    if (review) AlertDialog(onDismissRequest = { review = false }, title = { Text("Publicar guía del cantón") },
        text = { Text("Se actualizarán textos, portada, destacados y " + state.draft.routes.size + " rutas de " + selected + ". Los cambios se verán en web y app.") },
        confirmButton = { TextButton(onClick = { review = false; model.save() }) { Text("Guardar y publicar") } }, dismissButton = { TextButton(onClick = { review = false }) { Text("Volver") } })
    if (discard || reload) AlertDialog(onDismissRequest = { discard = false; reload = false }, title = { Text("Descartar cambios del formulario") },
        text = { Text("Los cambios sin guardar se perderán. La guía publicada se conserva.") },
        confirmButton = { TextButton(onClick = {
            if (reload) model.bind(uid, selected) else { selected = ""; model.bind(null, "") }
            discard = false; reload = false
        }) { Text("Descartar y continuar") } }, dismissButton = { TextButton(onClick = { discard = false; reload = false }) { Text("Conservar formulario") } })
    if (preview) Dialog(onDismissRequest = { preview = false }) {
        Surface {
            LazyColumn(Modifier.fillMaxHeight(.85f).padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                item { Text("Vista previa sin publicar", style = MaterialTheme.typography.titleLarge); TextButton(onClick = { preview = false }) { Text("Volver al editor") } }
                val guide = CantonPolicy.guide(state.draft.text)
                item { guide.cover?.let { AsyncImage(it, "Portada", Modifier.fillMaxWidth().height(170.dp), contentScale = ContentScale.Fit) }; Text(guide.credit); Text(guide.tagline); Text(guide.description); Text(guide.highlights) }
                items(guide.sections) { row -> Text(row.first, style = MaterialTheme.typography.titleMedium); Text(row.second) }
                item { Text("Destacados"); state.draft.featured.forEach { Text(name(it)) } }
                items(state.draft.routes, key = { it.key }) { route -> Text(route.title + " · " + route.duration, style = MaterialTheme.typography.titleMedium); Text(route.notes); route.placeIds.forEachIndexed { i, id -> Text("${i + 1}. " + name(id)) } }
            }
        }
    }
}
@Composable
private fun CantonOrderedPlaces(ids: List<String>, name: (String) -> String, enabled: Boolean, change: (List<String>) -> Unit) {
    ids.forEachIndexed { index, id ->
        Text("${index + 1}. " + name(id))
        Row {
            TextButton(onClick = { val rows = ids.toMutableList(); rows.add(index - 1, rows.removeAt(index)); change(rows) }, enabled = enabled && index > 0) { Text("Subir") }
            TextButton(onClick = { val rows = ids.toMutableList(); rows.add(index + 1, rows.removeAt(index)); change(rows) }, enabled = enabled && index < ids.lastIndex) { Text("Bajar") }
            TextButton(onClick = { change(ids.filterIndexed { i, _ -> i != index }) }, enabled = enabled) { Text("Quitar") }
        }
    }
}
