package com.visitaloja.app

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
internal fun AdminEditorialEntry(uid: String, kind: String) {
    val model: AdminEditorialViewModel = viewModel(key = "admin-editorial-" + kind)
    val observed by model.state.collectAsStateWithLifecycle()
    val state = observed.takeIf { it.uid == uid } ?: EditorialState(kind = kind)
    val title = if (kind == "stories") "Historias de Loja" else "Emprendedores"
    var open by remember(uid) { mutableStateOf(false) }
    var query by remember(uid) { mutableStateOf("") }
    var discard by remember(uid) { mutableStateOf(false) }
    var review by remember(uid) { mutableStateOf(false) }
    var preview by remember(uid) { mutableStateOf(false) }
    var related by remember(uid) { mutableStateOf(false) }
    var placeQuery by remember(uid) { mutableStateOf("") }
    var action by remember(uid) { mutableStateOf<Pair<String, Int>?>(null) }
    var settings by remember(uid) { mutableStateOf<Map<String, Any?>?>(null) }
    var refresh by remember(uid) { mutableStateOf(false) }
    DisposableEffect(uid) { onDispose { model.bind(null, kind) } }
    fun closeDraft() {
        if (state.busy) return
        val draft = state.draft ?: return
        if (draft.original == null || draft.text != EditorialPolicy.draft(kind, draft.id, draft.original).text) discard = true else model.dismiss()
    }
    OutlinedButton(onClick = { open = true; model.bind(uid, kind) }) { Text("Administrar " + title) }
    if (open) Dialog(onDismissRequest = { if (!state.busy && state.draft == null) { open = false; model.bind(null, kind) } }, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxSize().systemBarsPadding()) {
            LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                item {
                    Text(title, style = MaterialTheme.typography.headlineSmall)
                    TextButton(onClick = { open = false; model.bind(null, kind) }, enabled = !state.busy && state.draft == null) { Text("Cerrar") }
                    Text("Los cambios guardados se reflejan en la web y la app. Las imágenes y audios se añaden por enlace en este editor.")
                    if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                    state.message?.let { Text(it) }
                    OutlinedButton(onClick = { model.bind(uid, kind) }, enabled = !state.busy) { Text("Actualizar catálogo") }
                    Button(onClick = { model.select(null) }, enabled = state.ready && !state.busy && state.rows.size < 300) { Text(if (kind == "stories") "Crear historia" else "Crear emprendimiento") }
                    if (kind == "stories") OutlinedButton(onClick = {
                        val raw = state.base?.get("settings") as? Map<*, *>
                        settings = mapOf("active" to (raw?.get("active") != false), "title" to (raw?.get("title") as? String ?: "Historias de Loja"),
                            "titleEn" to (raw?.get("titleEn") as? String ?: ""), "intro" to (raw?.get("intro") as? String ?: ""), "introEn" to (raw?.get("introEn") as? String ?: ""))
                    }, enabled = state.ready && !state.busy) { Text("Presentación de la sección") }
                    if (state.base?.get("active") == false) Text("El documento general está pausado. Guardar un registro no levanta esa pausa global.")
                    OutlinedTextField(query, { query = it.take(150) }, label = { Text("Buscar en el catálogo cargado") }, modifier = Modifier.fillMaxWidth())
                    Text(state.rows.size.toString() + " registros")
                }
                items(state.rows.filter { PlacePolicy.normalize(it.text("title") + " " + it.text("name") + " " + it.text("category")).contains(PlacePolicy.normalize(query)) }, key = { it.text("id") }) { row ->
                    val id = row.text("id"); val index = state.rows.indexOf(row)
                    OutlinedCard(Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(row.text(if (kind == "stories") "title" else "name"), style = MaterialTheme.typography.titleMedium)
                            Text(row.text("category") + if (kind == "stories") " · " + row.text("status") else "")
                            if (kind == "stories" && row["publishAt"] != null && row["publishAt"] != "") Text("Publicación programada: " + row["publishAt"])
                            OutlinedButton(onClick = { model.select(id) }, enabled = !state.busy) { Text("Editar") }
                            Row {
                                TextButton(onClick = { action = id to -1 }, enabled = !state.busy && index > 0) { Text("Subir") }
                                TextButton(onClick = { action = id to 1 }, enabled = !state.busy && index < state.rows.lastIndex) { Text("Bajar") }
                                TextButton(onClick = { action = id to 0 }, enabled = !state.busy) { Text("Eliminar") }
                            }
                        }
                    }
                }
            }
        }
    }
    val draft = state.draft
    if (open && draft != null) Dialog(onDismissRequest = ::closeDraft, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxSize().systemBarsPadding()) {
            LazyColumn(Modifier.fillMaxSize().imePadding(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                item {
                    Text(if (draft.original == null) "Nuevo contenido" else "Editar contenido", style = MaterialTheme.typography.headlineSmall)
                    TextButton(onClick = ::closeDraft, enabled = !state.busy) { Text("Volver al catálogo") }
                    if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                    state.message?.let { Text(it) }
                    if (kind == "stories") {
                        Row { listOf("draft" to "Borrador", "published" to "Publicada", "hidden" to "Oculta").forEach { (key, label) ->
                            FilterChip(draft.text["status"] == key, { model.edit(draft.copy(text = draft.text + ("status" to key))) }, label = { Text(label) }, enabled = !state.busy)
                        } }
                        Text("Las historias nuevas comienzan en borrador. Una fecha futura retrasa su aparición aunque esté publicada.")
                        if (draft.original?.get("active") == false || draft.original?.get("hidden") == true || draft.original?.text("publicationStatus")?.let { it.isNotBlank() && it != "published" } == true)
                            Text("Tiene un bloqueo de visibilidad anterior. Para publicarla explícitamente, cambia a Borrador y luego a Publicada antes de guardar.")
                    }
                }
                items(EditorialPolicy.fields(kind).keys.toList(), key = { it }) { key ->
                    val info = EditorialPolicy.fields(kind).getValue(key)
                    OutlinedTextField(draft.text[key].orEmpty(), { model.edit(draft.copy(text = draft.text + (key to it.take(info.second)))) },
                        label = { Text(info.first) }, enabled = !state.busy, modifier = Modifier.fillMaxWidth())
                    if (key == "publishAt") Text("Formato: AAAA-MM-DDTHH:MM. Ejemplo: 2026-11-20T18:30. Vacío: sin programación.")
                    if (key in setOf("cover", "img")) DiscoveryPolicy.media(draft.text[key].orEmpty())?.let { AsyncImage(it, "Imagen del contenido", Modifier.fillMaxWidth().height(180.dp), contentScale = ContentScale.Fit) }
                }
                if (kind == "stories") item {
                    Text("Paradas relacionadas", style = MaterialTheme.typography.titleMedium)
                    val ids = draft.text["relatedPlaceIds"].orEmpty().lines().filter(String::isNotBlank)
                    ids.forEach { id ->
                        Row {
                            Text(state.places.firstOrNull { it.first == id }?.second ?: "Referencia guardada: $id", Modifier.weight(1f))
                            TextButton(onClick = { model.edit(draft.copy(text = draft.text + ("relatedPlaceIds" to ids.filter { it != id }.joinToString("\n")))) }, enabled = !state.busy) { Text("Quitar") }
                        }
                    }
                    OutlinedButton(onClick = { placeQuery = ""; related = true }, enabled = !state.busy && ids.size < 50) { Text("Relacionar una parada") }
                }
                item {
                    OutlinedButton(onClick = { preview = true }, enabled = !state.busy) { Text("Previsualizar texto e imagen") }
                    Button(onClick = { review = true }, enabled = !state.busy) { Text("Revisar guardado") }
                    OutlinedButton(onClick = { refresh = true }, enabled = !state.busy) { Text("Descartar formulario y actualizar") }
                }
            }
        }
    }
    if (related && draft != null) Dialog(onDismissRequest = { related = false }) {
        Surface {
            LazyColumn(Modifier.fillMaxHeight(.85f).padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                item { Text("Paradas relacionadas"); OutlinedTextField(placeQuery, { placeQuery = it.take(150) }, label = { Text("Buscar en el directorio cargado") }); Text("Hasta 50 coincidencias; escribe para afinar la búsqueda."); TextButton(onClick = { related = false }) { Text("Volver") } }
                val ids = draft.text["relatedPlaceIds"].orEmpty().lines().filter(String::isNotBlank)
                items(state.places.filter { it.first !in ids && PlacePolicy.normalize(it.second).contains(PlacePolicy.normalize(placeQuery)) }.take(50), key = { it.first }) { row ->
                    OutlinedButton(onClick = { model.edit(draft.copy(text = draft.text + ("relatedPlaceIds" to (ids + row.first).joinToString("\n")))); related = false }) { Text(row.second) }
                }
            }
        }
    }
    if (preview && draft != null) Dialog(onDismissRequest = { preview = false }) {
        Surface {
            LazyColumn(Modifier.fillMaxHeight(.85f).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                item { Text("Vista previa sin publicar"); TextButton(onClick = { preview = false }) { Text("Volver") } }
                item { DiscoveryPolicy.media(draft.text[if (kind == "stories") "cover" else "img"].orEmpty())?.let { AsyncImage(it, "Imagen", Modifier.fillMaxWidth().height(180.dp), contentScale = ContentScale.Fit) } }
                items(if (kind == "stories") listOf("title", "titleEn", "intro", "introEn", "body", "bodyEn", "source", "era") else listOf("name", "category", "desc", "phone")) { key -> Text(draft.text[key].orEmpty()) }
                if (kind == "stories") items(draft.text["gallery"].orEmpty().lines().filter(String::isNotBlank)) { url -> DiscoveryPolicy.media(url)?.let { AsyncImage(it, "Fotografía", Modifier.fillMaxWidth().height(180.dp), contentScale = ContentScale.Fit) } }
            }
        }
    }
    if (review && draft != null) AlertDialog(onDismissRequest = { review = false }, title = { Text("Guardar contenido") },
        text = { Text(draft.text[if (kind == "stories") "title" else "name"].orEmpty() + if (kind == "stories") "\nEstado: " + draft.text["status"] + "\nPublicar desde: " + draft.text["publishAt"].orEmpty().ifBlank { "Sin programación" } else if (draft.original == null) "\nSe publicará el emprendimiento en VisitaLoja." else "\nSe actualizará el emprendimiento conservando sus ajustes de visibilidad.") },
        confirmButton = { TextButton(onClick = { review = false; model.saveRow() }) { Text("Confirmar guardado") } }, dismissButton = { TextButton(onClick = { review = false }) { Text("Volver") } })
    if (discard || refresh) AlertDialog(onDismissRequest = { discard = false; refresh = false }, title = { Text("Descartar cambios sin guardar") }, text = { Text("El contenido guardado se conserva. Se perderán los cambios de este formulario.") },
        confirmButton = { TextButton(onClick = { if (refresh) model.bind(uid, kind) else model.dismiss(); discard = false; refresh = false }) { Text("Descartar") } }, dismissButton = { TextButton(onClick = { discard = false; refresh = false }) { Text("Conservar formulario") } })
    action?.let { (id, step) -> AlertDialog(onDismissRequest = { action = null }, title = { Text(if (step == 0) "Eliminar contenido" else "Cambiar orden") },
        text = { Text(state.rows.firstOrNull { it.text("id") == id }?.let { it.text(if (kind == "stories") "title" else "name") }.orEmpty() + if (step == 0) "\nSe retirará del catálogo. Sus archivos multimedia no se borrarán." else "\nSe moverá una posición en el catálogo guardado.") },
        confirmButton = { TextButton(onClick = { action = null; if (step == 0) model.remove(id) else model.move(id, step) }) { Text("Confirmar") } }, dismissButton = { TextButton(onClick = { action = null }) { Text("Cancelar") } }) }
    settings?.let { values -> Dialog(onDismissRequest = { if (!state.busy) settings = null }) {
        Surface {
            LazyColumn(Modifier.fillMaxHeight(.85f).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                item { Text("Presentación de Historias"); Row { Checkbox(values["active"] != false, { settings = values + ("active" to it) }, enabled = !state.busy); Text("Sección visible") } }
                items(listOf("title", "titleEn", "intro", "introEn")) { key -> OutlinedTextField(values[key] as? String ?: "", { settings = values + (key to it.take(if (key.startsWith("title")) 120 else 300)) }, label = { Text(when (key) { "title" -> "Título ES"; "titleEn" -> "Título EN"; "intro" -> "Introducción ES"; else -> "Introducción EN" }) }, enabled = !state.busy) }
                item { Button(onClick = { model.settings(values); settings = null }, enabled = !state.busy) { Text("Guardar presentación") }; TextButton(onClick = { settings = null }, enabled = !state.busy) { Text("Cerrar sin guardar") } }
            }
        }
    } }
}
