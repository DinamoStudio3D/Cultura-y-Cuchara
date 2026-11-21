package com.visitaloja.app

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.BiasAlignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import kotlin.math.roundToInt

@Composable
internal fun AdminPhotosEntry(uid: String) {
    val model: AdminPhotosViewModel = viewModel(key = "admin-photos")
    val observed by model.state.collectAsStateWithLifecycle()
    val state = observed.takeIf { it.uid == uid } ?: PhotoLibraryState()
    var open by remember(uid) { mutableStateOf(false) }
    var section by remember(uid) { mutableStateOf(AdminPhotoPolicy.sections.first()) }
    var query by remember(uid) { mutableStateOf("") }
    var discard by remember(uid) { mutableStateOf(false) }
    var reload by remember(uid) { mutableStateOf(false) }
    var cancel by remember(uid) { mutableStateOf(false) }
    var review by remember(uid) { mutableStateOf(false) }
    var drafts by remember(uid) { mutableStateOf(false) }
    var authors by remember(uid) { mutableStateOf(false) }
    var reuse by remember(uid) { mutableStateOf<String?>(null) }
    var remove by remember(uid) { mutableStateOf<String?>(null) }
    var uploadId by rememberSaveable(uid) { mutableStateOf("") }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri -> if (uri != null) model.upload(uri, uploadId) }
    DisposableEffect(uid) { onDispose { model.bind(null) } }
    fun close() { if (state.busy) return; if (state.dirty) discard = true else { open = false; model.bind(null) } }
    OutlinedButton(onClick = { open = true; model.bind(uid) }) { Text("Administrar fotografías y créditos") }
    if (open) Dialog(onDismissRequest = ::close, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxSize().systemBarsPadding()) {
            LazyColumn(Modifier.fillMaxSize().imePadding(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                item {
                    Text("Fotografías y créditos", style = MaterialTheme.typography.headlineSmall)
                    TextButton(onClick = ::close, enabled = !state.busy) { Text("Cerrar") }
                    if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                    state.message?.let { Text(it) }
                    Text("Biblioteca compartida con la web y las vistas de la app que la utilizan. Prepara los cambios y confirma la publicación. Los archivos originales se conservan al retirar una foto.")
                    TextButton(onClick = { if (state.dirty) reload = true else model.bind(uid) }, enabled = !state.busy) { Text("Actualizar biblioteca y permisos") }
                    TextButton(onClick = { model.local("list"); drafts = true }, enabled = state.ready && !state.busy) { Text("Recuperar borrador de este teléfono") }
                }
                if (state.ready) {
                    val editing = state.editing
                    if (editing != null) {
                        item {
                            Text(if (state.original == null) "Añadir fotografía" else "Editar fotografía", style = MaterialTheme.typography.titleLarge)
                            Text("Destino")
                            PhotoSections(editing.text("section"), !state.busy) { model.edit("section", it) }
                            OutlinedButton(onClick = { uploadId = editing.text("id"); picker.launch("image/*") }, enabled = !state.busy) { Text("Elegir foto del teléfono · hasta 12 MB") }
                            Text("Se optimiza y sube al elegirla. Guarda un borrador o publica para conservar el enlace.")
                        }
                        items(AdminPhotoPolicy.fields.entries.toList(), key = { it.key }) { field ->
                            OutlinedTextField(editing.text(field.key), { model.edit(field.key, it.take(field.value.second)) }, label = { Text(field.value.first) }, modifier = Modifier.fillMaxWidth(), enabled = !state.busy)
                            if (field.key == "credit") TextButton(onClick = { authors = true }, enabled = !state.busy) { Text("Elegir autor guardado") }
                        }
                        item {
                            TextButton(onClick = { model.saveAuthor() }, enabled = !state.busy) { Text("Guardar o actualizar autor en cambios pendientes") }
                            Text("Actualizar un autor guardado también prepara los créditos de sus fotografías vinculadas. Esos cambios se publican con la biblioteca.")
                            Row { Checkbox(editing["active"] != false, { model.edit("active", it) }, enabled = !state.busy); Text("Fotografía visible") }
                            PhotoFullPreview(editing)
                        }
                        if (editing.text("section") == "Portada principal") item {
                            val custom = editing["desktopFocus"] != null || editing["mobileFocus"] != null
                            Text("Encuadre de portada", style = MaterialTheme.typography.titleMedium)
                            Row { Checkbox(custom, { model.customFrame(it) }, enabled = !state.busy); Text("Personalizar encuadre") }
                            Text("Solo ajusta la parte visible; conserva la imagen completa. El encuadre de celular se utiliza en la portada de la app. Sin ajuste propio se usa la posición global de portada.")
                            if (custom) {
                                listOf("desktopFocus", "mobileFocus").forEach { device ->
                                    val point = AdminPhotoPolicy.focus(editing, device) ?: (if (device == "mobileFocus") AdminPhotoPolicy.focus(editing, "desktopFocus") else null) ?: (50f to 50f)
                                    Text(if (device == "desktopFocus") "Computadora · muestra panorámica" else "Celular · muestra vertical")
                                    AsyncImage(DiscoveryPolicy.photoUrl(editing.text("url")), editing.text("alt").ifBlank { editing.text("title") },
                                        Modifier.fillMaxWidth().aspectRatio(if (device == "desktopFocus") 16f / 7f else 4f / 5f), contentScale = ContentScale.Crop,
                                        alignment = BiasAlignment(point.first / 50f - 1f, point.second / 50f - 1f))
                                    Text("Horizontal · " + point.first.roundToInt() + "%")
                                    Slider(point.first, { model.frame(device, "x", it) }, valueRange = 0f..100f, enabled = !state.busy)
                                    Text("Vertical · " + point.second.roundToInt() + "%")
                                    Slider(point.second, { model.frame(device, "y", it) }, valueRange = 0f..100f, enabled = !state.busy)
                                }
                                TextButton(onClick = { model.customFrame(true) }, enabled = !state.busy) { Text("Centrar ambos encuadres") }
                            }
                        }
                        item {
                            Button(onClick = { model.stage() }, enabled = !state.busy) { Text("Guardar foto en cambios pendientes") }
                            TextButton(onClick = { if (state.editing != state.original) cancel = true else model.cancel() }, enabled = !state.busy) { Text("Cancelar edición de esta foto") }
                            OutlinedButton(onClick = { model.local("save") }, enabled = !state.busy) { Text("Guardar borrador local, incluida esta foto") }
                        }
                    } else {
                        item {
                            PhotoSections(section, !state.busy) { section = it }
                            Text(when (section) { "Portada principal" -> "Fondo del inicio: las fotos grandes detrás del título y buscador."; "Loja, en cada mirada" -> "Tarjetas fotográficas debajo del inicio en la web y sección de fotos en la app."; else -> "Galería de fotografías, con apertura de imagen completa." })
                            OutlinedTextField(query, { query = it.take(150) }, label = { Text("Buscar por título o autor") }, modifier = Modifier.fillMaxWidth())
                            OutlinedButton(onClick = { model.begin(null, section) }, enabled = !state.busy) { Text("Añadir foto en esta sección") }
                        }
                        val group = state.draft.photos.filter { it.text("section") == section }
                        val shown = group.filter { PlacePolicy.normalize(it.text("title") + " " + it.text("credit")).contains(PlacePolicy.normalize(query)) }
                        item { Text("${shown.size} fotos · ${group.count { it["active"] != false }} visibles · " + if (state.draft != state.initial) "Cambios sin publicar" else "Sin cambios pendientes") }
                        if (shown.isEmpty()) item { Text("No hay fotografías que coincidan en esta sección.") }
                        items(shown, key = { it.text("id") }) { row ->
                            OutlinedCard(Modifier.fillMaxWidth()) {
                                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    AsyncImage(DiscoveryPolicy.photoUrl(row.text("url")), row.text("alt").ifBlank { row.text("title") }, Modifier.fillMaxWidth().height(160.dp), contentScale = ContentScale.Fit)
                                    Text(row.text("title"), style = MaterialTheme.typography.titleMedium)
                                    Text(row.text("credit") + " · " + if (row["active"] == false) "Oculta" else "Visible")
                                    Row(Modifier.horizontalScroll(rememberScrollState())) {
                                        TextButton(onClick = { model.begin(row.text("id"), section) }, enabled = !state.busy) { Text("Editar") }
                                        TextButton(onClick = { model.action(row.text("id"), "up") }, enabled = !state.busy && group.indexOf(row) > 0) { Text("Subir") }
                                        TextButton(onClick = { model.action(row.text("id"), "down") }, enabled = !state.busy && group.indexOf(row) < group.lastIndex) { Text("Bajar") }
                                        TextButton(onClick = { model.action(row.text("id"), "visibility") }, enabled = !state.busy) { Text(if (row["active"] == false) "Mostrar" else "Ocultar") }
                                    }
                                    Row { TextButton(onClick = { reuse = row.text("id") }, enabled = !state.busy) { Text("Usar también en…") }; TextButton(onClick = { remove = row.text("id") }, enabled = !state.busy) { Text("Retirar") } }
                                }
                            }
                        }
                        val unknown = state.draft.photos.count { it.text("section") !in AdminPhotoPolicy.sections }
                        if (unknown > 0) item { Text("Se conservan $unknown registros de otras secciones. Revísalos en la web.") }
                        item {
                            OutlinedButton(onClick = { model.local("save") }, enabled = !state.busy) { Text("Guardar borrador local") }
                            Button(onClick = { review = true }, enabled = !state.busy && state.draft != state.initial) { Text("Revisar y publicar biblioteca") }
                        }
                    }
                }
            }
        }
    }
    if (authors) Dialog(onDismissRequest = { authors = false }) {
        Surface { LazyColumn(Modifier.fillMaxHeight(.85f).padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            item { Text("Autores guardados", style = MaterialTheme.typography.titleLarge); TextButton(onClick = { authors = false }) { Text("Volver") }; Text("Para actualizar un autor, elígelo, cambia sus datos y pulsa Guardar o actualizar autor."); OutlinedButton(onClick = { model.newAuthor(); authors = false }, enabled = !state.busy) { Text("Nuevo autor / datos manuales") } }
            items(state.draft.authors.indices.toList(), key = { it }) { index -> val row = state.draft.authors[index]
                OutlinedButton(onClick = { model.chooseAuthor(index); authors = false }, enabled = !state.busy, modifier = Modifier.fillMaxWidth()) { Text(row.text("name")) }
            }
        } }
    }
    if (drafts) AdminDraftPicker(state.localDrafts, state.busy, state.message, { drafts = false }, { drafts = false; model.local("restore") }, { model.local("delete") })
    val reuseRow = state.draft.photos.firstOrNull { it.text("id") == reuse }
    if (reuseRow != null) AlertDialog(onDismissRequest = { reuse = null }, title = { Text("Usar también en otra sección") }, text = {
        Column { Text("Se conserva la foto y el crédito originales."); AdminPhotoPolicy.sections.filter { it != reuseRow.text("section") }.forEach { target ->
            TextButton(onClick = { model.action(reuseRow.text("id"), "reuse", target); reuse = null }, enabled = !state.busy && state.draft.photos.none { it["section"] == target && it["url"] == reuseRow["url"] }) { Text(target) }
        } }
    }, confirmButton = { TextButton(onClick = { reuse = null }) { Text("Volver") } })
    if (remove != null) AlertDialog(onDismissRequest = { remove = null }, title = { Text("Retirar fotografía") }, text = { Text("Se retirará de esta sección al publicar. El archivo original y las copias utilizadas en otras secciones se conservan.") }, confirmButton = { TextButton(onClick = { remove?.let { model.action(it, "remove") }; remove = null }) { Text("Retirar del borrador") } }, dismissButton = { TextButton(onClick = { remove = null }) { Text("Conservar") } })
    if (cancel) AlertDialog(onDismissRequest = { cancel = false }, title = { Text("Cancelar edición de esta foto") }, text = { Text("Se perderán los cambios del formulario que no guardaste en cambios pendientes. Los demás cambios de la biblioteca y los borradores locales se conservan.") }, confirmButton = { TextButton(onClick = { model.cancel(); cancel = false }) { Text("Cancelar edición") } }, dismissButton = { TextButton(onClick = { cancel = false }) { Text("Seguir editando") } })
    if (review) AlertDialog(onDismissRequest = { review = false }, title = { Text("Publicar biblioteca compartida") }, text = { Text("Se publicarán las fotos, créditos, visibilidad, orden y encuadres preparados para las tres secciones. También se actualizarán los autores vinculados. Esto afecta al contenido compartido de la web y la app.") }, confirmButton = { TextButton(onClick = { review = false; model.save() }) { Text("Confirmar publicación") } }, dismissButton = { TextButton(onClick = { review = false }) { Text("Revisar de nuevo") } })
    if (discard || reload) AlertDialog(onDismissRequest = { discard = false; reload = false }, title = { Text("Descartar cambios sin publicar") }, text = { Text("La biblioteca publicada y los borradores que ya guardaste en este teléfono se conservan.") }, confirmButton = { TextButton(onClick = { if (reload) model.bind(uid) else { open = false; model.bind(null) }; discard = false; reload = false }) { Text("Descartar") } }, dismissButton = { TextButton(onClick = { discard = false; reload = false }) { Text("Seguir editando") } })
}
@Composable
private fun PhotoSections(selected: String, enabled: Boolean, choose: (String) -> Unit) {
    Column { AdminPhotoPolicy.sections.forEach { section -> FilterChip(selected == section, { choose(section) }, label = { Text(section) }, enabled = enabled) } }
}
@Composable
private fun PhotoFullPreview(row: Map<String, Any?>) {
    Text("Imagen y crédito sin publicar", style = MaterialTheme.typography.titleMedium)
    AsyncImage(DiscoveryPolicy.photoUrl(row.text("url")), row.text("alt").ifBlank { row.text("title") }, Modifier.fillMaxWidth().height(240.dp), contentScale = ContentScale.Fit)
    Text(row.text("title")); Text(row.text("credit")); if (row.text("creditUrl").isNotBlank()) Text(row.text("creditUrl")); if (row.text("description").isNotBlank()) Text(row.text("description"))
}
