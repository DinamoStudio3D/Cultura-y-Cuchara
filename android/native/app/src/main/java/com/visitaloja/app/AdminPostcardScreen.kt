package com.visitaloja.app

import androidx.compose.foundation.Image
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage

@Composable
internal fun AdminPostcardsEntry(uid: String) {
    val model: AdminPostcardViewModel = viewModel(key = "admin-postcards")
    val observed by model.state.collectAsStateWithLifecycle()
    val state = observed.takeIf { it.uid == uid } ?: AdminPostcardState()
    var open by remember(uid) { mutableStateOf(false) }
    var discard by remember(uid) { mutableStateOf(false) }
    var reload by remember(uid) { mutableStateOf(false) }
    var discardFrame by remember(uid) { mutableStateOf(false) }
    var review by remember(uid) { mutableStateOf(false) }
    var drafts by remember(uid) { mutableStateOf(false) }
    var remove by remember(uid) { mutableStateOf<String?>(null) }
    var previewFrame by remember(uid) { mutableStateOf("fiavl") }
    DisposableEffect(uid) { onDispose { model.bind(null) } }
    fun close() {
        if (state.busy) return
        if (state.draft != state.initial || state.frameDraft != null) discard = true
        else { open = false; model.bind(null) }
    }
    fun closeFrame() {
        if (state.busy) return
        val frame = state.frameDraft ?: return
        val before = AdminPostcardPolicy.frameFields.keys.associateWith { frame.original?.text(it).orEmpty() }
        if (frame.original == null || frame.text != before) discardFrame = true else model.closeFrame()
    }
    OutlinedButton(onClick = { open = true; model.bind(uid) }) { Text("Administrar postales y marcos") }
    if (open) Dialog(onDismissRequest = ::close, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxSize().systemBarsPadding()) {
            LazyColumn(Modifier.fillMaxSize().imePadding(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                item {
                    Text("Postales y marcos", style = MaterialTheme.typography.headlineSmall)
                    TextButton(onClick = ::close, enabled = !state.busy) { Text("Cerrar") }
                    Text("Los cambios se preparan en este formulario. Publicar configuración actualiza los textos y marcos compartidos con la web.")
                    if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                    state.message?.let { Text(it) }
                    OutlinedButton(onClick = { if (state.draft != state.initial) reload = true else model.bind(uid) }, enabled = !state.busy) { Text("Actualizar desde el servidor") }
                    OutlinedButton(onClick = { model.local("list"); drafts = true }, enabled = state.ready && !state.busy) { Text("Recuperar borrador de este teléfono") }
                }
                if (state.ready) {
                    items(AdminPostcardPolicy.fields.keys.toList(), key = { it }) { key ->
                        val info = AdminPostcardPolicy.fields.getValue(key)
                        OutlinedTextField(state.draft.text[key].orEmpty(), { model.edit(state.draft.copy(text = state.draft.text + (key to it.take(info.second)))) }, label = { Text(info.first) }, enabled = !state.busy, modifier = Modifier.fillMaxWidth())
                        if (key == "sampleImg") DiscoveryPolicy.media(state.draft.text[key].orEmpty())?.let { AsyncImage(it, "Imagen de muestra", Modifier.fillMaxWidth().height(180.dp), contentScale = ContentScale.Fit) }
                        if (key == "defaultMsg") Text("En la postal móvil se muestran hasta 50 caracteres del mensaje. Comprueba el resultado en la vista previa.")
                    }
                    item { Text("Marcos de marca", style = MaterialTheme.typography.titleLarge) }
                    items(state.draft.brands, key = { it.id }) { brand ->
                        OutlinedCard(Modifier.fillMaxWidth()) {
                            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text(AdminPostcardPolicy.brands.first { it.id == brand.id }.name, style = MaterialTheme.typography.titleMedium)
                                Row { Checkbox(brand.enabled, { enabled -> model.edit(state.draft.copy(brands = state.draft.brands.map { if (it.id == brand.id) it.copy(enabled = enabled) else it })) }, enabled = !state.busy); Text("Marco disponible") }
                                OutlinedTextField(brand.name, { name -> model.edit(state.draft.copy(brands = state.draft.brands.map { if (it.id == brand.id) it.copy(name = name.take(40)) else it })) }, label = { Text("Nombre para el visitante") }, enabled = !state.busy)
                                OutlinedTextField(brand.color, { color -> model.edit(state.draft.copy(brands = state.draft.brands.map { if (it.id == brand.id) it.copy(color = color.take(7)) else it })) }, label = { Text("Color hexadecimal · #123B66") }, enabled = !state.busy)
                            }
                        }
                    }
                    item {
                        Text("Marcos personalizados · " + state.draft.frames.size, style = MaterialTheme.typography.titleLarge)
                        Text("Usa un PNG o WebP con transparencia. La app muestra hasta 40 marcos personalizados, en este orden. Los marcos incorporados se conservan.")
                        OutlinedButton(onClick = { model.frame(null) }, enabled = !state.busy && state.draft.frames.size < 40) { Text("Añadir marco por enlace") }
                    }
                    items(state.draft.frames, key = { it.text("id") }) { row ->
                        val id = row.text("id"); val index = state.draft.frames.indexOf(row)
                        OutlinedCard(Modifier.fillMaxWidth()) {
                            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text(row.text("name"), style = MaterialTheme.typography.titleMedium)
                                DiscoveryPolicy.media(row.text("img"))?.let { AsyncImage(it, "Marco", Modifier.fillMaxWidth().height(170.dp), contentScale = ContentScale.Fit) }
                                OutlinedButton(onClick = { model.frame(id) }, enabled = !state.busy) { Text("Editar marco") }
                                Row {
                                    TextButton(onClick = { model.move(id, -1) }, enabled = !state.busy && index > 0) { Text("Subir") }
                                    TextButton(onClick = { model.move(id, 1) }, enabled = !state.busy && index < state.draft.frames.lastIndex) { Text("Bajar") }
                                    TextButton(onClick = { remove = id }, enabled = !state.busy) { Text("Quitar") }
                                }
                            }
                        }
                    }
                    item {
                        Text("Vista previa sin publicar", style = MaterialTheme.typography.titleLarge)
                        val config = PostcardPolicy.settings(AdminPostcardPolicy.settings(state.draft, state.base.orEmpty()), mapOf("frames" to state.draft.frames))
                        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            config.frames.forEach { frame -> FilterChip(previewFrame == frame.id, { previewFrame = frame.id }, label = { Text(frame.name) }, enabled = !state.busy) }
                        }
                        OutlinedButton(onClick = { model.preview(previewFrame) }, enabled = !state.busy && config.frames.any { it.id == previewFrame }) { Text("Generar postal de muestra") }
                        state.preview?.let { Image(it.asImageBitmap(), "Postal de muestra sin publicar", Modifier.fillMaxWidth().heightIn(min = 240.dp, max = 520.dp), contentScale = ContentScale.Fit) }
                        OutlinedButton(onClick = { model.local("save") }, enabled = !state.busy) { Text("Guardar borrador local") }
                        Button(onClick = { review = true }, enabled = !state.busy && state.draft != state.initial) { Text("Revisar y publicar configuración") }
                    }
                }
            }
        }
    }
    val frame = state.frameDraft
    if (open && frame != null) Dialog(onDismissRequest = ::closeFrame) {
        Surface {
            LazyColumn(Modifier.fillMaxHeight(.9f).imePadding().padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                item { Text(if (frame.original == null) "Nuevo marco" else "Editar marco", style = MaterialTheme.typography.titleLarge); Text("Aplica el marco al formulario para verlo en una postal. Aplicar todavía no lo publica."); if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth()); state.message?.let { Text(it) } }
                items(AdminPostcardPolicy.frameFields.keys.toList(), key = { it }) { key ->
                    val info = AdminPostcardPolicy.frameFields.getValue(key)
                    OutlinedTextField(frame.text[key].orEmpty(), { model.editFrame(frame.copy(text = frame.text + (key to it.take(info.second)))) }, label = { Text(info.first) }, enabled = !state.busy, modifier = Modifier.fillMaxWidth())
                }
                item {
                    DiscoveryPolicy.media(frame.text["img"].orEmpty())?.let { AsyncImage(it, "Imagen del marco", Modifier.fillMaxWidth().height(230.dp), contentScale = ContentScale.Fit) }
                    Text("La proporción vertical 9:16 suele funcionar bien. La vista previa permite comprobar cómo encaja tu foto.")
                    Button(onClick = model::applyFrame, enabled = !state.busy) { Text("Comprobar y aplicar al formulario") }
                    OutlinedButton(onClick = { model.local("save") }, enabled = !state.busy) { Text("Guardar borrador con este marco") }
                    TextButton(onClick = ::closeFrame, enabled = !state.busy) { Text("Volver") }
                }
            }
        }
    }
    if (drafts) AdminDraftPicker(state.localDrafts, state.busy, state.message, { drafts = false }, { drafts = false; model.local("restore") }, { model.local("delete") })
    if (review) AlertDialog(onDismissRequest = { review = false }, title = { Text("Publicar configuración de postales") }, text = { Text("Se guardarán los textos, los tres marcos de marca y " + state.draft.frames.size + " marcos personalizados en la web y la app.") },
        confirmButton = { TextButton(onClick = { review = false; model.save() }) { Text("Guardar y publicar") } }, dismissButton = { TextButton(onClick = { review = false }) { Text("Volver") } })
    if (discard || reload) AlertDialog(onDismissRequest = { discard = false; reload = false }, title = { Text("Descartar cambios sin guardar") }, text = { Text("El contenido publicado y los borradores ya guardados se conservan. Se perderán los cambios de este formulario.") },
        confirmButton = { TextButton(onClick = { if (reload) model.bind(uid) else { open = false; model.bind(null) }; discard = false; reload = false }) { Text("Descartar") } }, dismissButton = { TextButton(onClick = { discard = false; reload = false }) { Text("Conservar formulario") } })
    if (discardFrame) AlertDialog(onDismissRequest = { discardFrame = false }, title = { Text("Descartar cambios de este marco") }, text = { Text("Los marcos aplicados al formulario y los borradores locales se conservan.") },
        confirmButton = { TextButton(onClick = { discardFrame = false; model.closeFrame() }) { Text("Descartar marco sin aplicar") } }, dismissButton = { TextButton(onClick = { discardFrame = false }) { Text("Volver al marco") } })
    remove?.let { id -> AlertDialog(onDismissRequest = { remove = null }, title = { Text("Quitar marco del formulario") }, text = { Text("Se retirará al publicar la configuración. El archivo original de la imagen se conserva.") },
        confirmButton = { TextButton(onClick = { remove = null; model.removeFrame(id) }) { Text("Quitar") } }, dismissButton = { TextButton(onClick = { remove = null }) { Text("Cancelar") } }) }
}
