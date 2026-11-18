package com.visitaloja.app

import android.content.Intent
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage

@Composable
internal fun AdminArchiveEntry(uid: String, kind: String) {
    val model: AdminArchiveViewModel = viewModel(key = "admin-archive-" + kind)
    val audioPlayer: DiscoveryAudioViewModel = viewModel()
    val audio by audioPlayer.state.collectAsStateWithLifecycle()
    val observed by model.state.collectAsStateWithLifecycle()
    val state = observed.takeIf { it.uid == uid } ?: ArchiveState(kind = kind)
    val title = if (kind == "history") "Loja en el Tiempo" else "Podcast"
    val context = LocalContext.current
    var open by remember(uid) { mutableStateOf(false) }
    var query by remember(uid) { mutableStateOf("") }
    var review by remember(uid) { mutableStateOf(false) }
    var discard by remember(uid) { mutableStateOf(false) }
    var refresh by remember(uid) { mutableStateOf(false) }
    var preview by remember(uid) { mutableStateOf(false) }
    var drafts by remember(uid) { mutableStateOf(false) }
    var delete by remember(uid) { mutableStateOf<ArchiveRow?>(null) }
    var uploadField by rememberSaveable(uid, kind) { mutableStateOf("imgPast") }
    val mediaPicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri -> if (uri != null) model.upload(uri, uploadField) }
    val prefix = "admin-archive:$uid:$kind:"
    DisposableEffect(uid) { onDispose { model.bind(null, kind); if (audioPlayer.state.value.key?.startsWith(prefix) == true) audioPlayer.close() } }
    DisposableEffect(preview) { onDispose { if (audioPlayer.state.value.key?.startsWith(prefix) == true) audioPlayer.close() } }
    fun closeDraft() {
        if (state.busy) return
        val draft = state.draft ?: return
        if (draft.original == null || draft.text != ArchivePolicy.draft(kind, draft.id, draft.original).text) discard = true else model.dismiss()
    }
    OutlinedButton(onClick = { open = true; model.bind(uid, kind) }) { Text("Administrar " + title) }
    if (open) Dialog(onDismissRequest = { if (!state.busy && state.draft == null) { open = false; model.bind(null, kind) } }, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxSize().systemBarsPadding()) {
            LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                item {
                    Text(title, style = MaterialTheme.typography.headlineSmall)
                    TextButton(onClick = { open = false; model.bind(null, kind) }, enabled = !state.busy) { Text("Cerrar") }
                    if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                    state.message?.let { Text(it) }
                    OutlinedButton(onClick = { model.bind(uid, kind) }, enabled = !state.busy) { Text("Actualizar contenido y permisos") }
                    OutlinedButton(onClick = { model.local("list"); drafts = true }, enabled = state.ready && !state.busy) { Text("Recuperar borradores de este teléfono") }
                    if (kind == "history" || state.rows.isEmpty()) Button(onClick = { model.select(null) }, enabled = state.ready && !state.busy) { Text(if (kind == "history") "Crear punto histórico" else "Configurar podcast") }
                    if (kind == "history") {
                        OutlinedTextField(query, { query = it.take(150) }, label = { Text("Buscar en los puntos cargados") }, modifier = Modifier.fillMaxWidth())
                        Text(state.rows.size.toString() + " puntos cargados" + if (state.more) " · hay más por cargar" else "")
                    } else Text("Edita el contenido destacado del podcast. Sus enlaces deben corresponder a archivos ya publicados, como en el panel web.")
                }
                items(state.rows.filter { PlacePolicy.normalize(it.raw.text("title") + " " + it.raw.text("desc")).contains(PlacePolicy.normalize(query)) }, key = { it.id }) { row ->
                    OutlinedCard(Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(row.raw.text("title").ifBlank { row.id }, style = MaterialTheme.typography.titleMedium)
                            if (kind == "podcast") Text(if (row.raw["visible"] == false) "Oculto por visibilidad" else "Visibilidad habilitada")
                            OutlinedButton(onClick = { model.select(row.id) }, enabled = !state.busy) { Text("Editar") }
                            if (kind == "history") TextButton(onClick = { delete = row }, enabled = !state.busy) { Text("Eliminar punto histórico") }
                        }
                    }
                }
                if (state.more) item { OutlinedButton(onClick = model::load, enabled = !state.busy) { Text("Cargar 50 puntos más") } }
            }
        }
    }
    val draft = state.draft
    if (open && draft != null) Dialog(onDismissRequest = ::closeDraft, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxSize().systemBarsPadding()) {
            LazyColumn(Modifier.fillMaxSize().imePadding(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                item {
                    Text(title, style = MaterialTheme.typography.headlineSmall)
                    TextButton(onClick = ::closeDraft, enabled = !state.busy) { Text("Volver") }
                    if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                    state.message?.let { Text(it) }
                    if (kind == "history") Text("Guardar publica el punto y su ubicación. Para trabajar sin publicar, guarda un borrador en este teléfono.")
                    else {
                        Row { Checkbox(draft.text["visible"] == "true", { model.edit(draft.copy(text = draft.text + ("visible" to it.toString()))) }, enabled = !state.busy); Text("Mostrar podcast") }
                        if (draft.original?.get("active") == false || draft.original?.get("hidden") == true || draft.original?.get("published") == false) Text("Este contenido tiene otro bloqueo de visibilidad anterior. Se conservará al editar.")
                    }
                }
                items(ArchivePolicy.fields(kind).keys.toList(), key = { it }) { key ->
                    val info = ArchivePolicy.fields(kind).getValue(key)
                    OutlinedTextField(draft.text[key].orEmpty(), { model.edit(draft.copy(text = draft.text + (key to it.take(info.second)))) },
                        label = { Text(info.first) }, enabled = !state.busy, modifier = Modifier.fillMaxWidth())
                    if (kind == "history" && key in setOf("imgPast", "imgPresent", "audioUrl", "audioUrlEn")) OutlinedButton(onClick = {
                        uploadField = key; mediaPicker.launch(if (key.startsWith("audio")) "audio/*" else "image/*")
                    }, enabled = !state.busy) { Text(if (key.startsWith("audio")) "Elegir audio · hasta 20 MB" else "Elegir foto del teléfono") }
                    if (key in setOf("imgPast", "imgPresent", "coverUrl")) DiscoveryPolicy.media(draft.text[key].orEmpty())?.let {
                        AsyncImage(it, info.first, Modifier.fillMaxWidth().height(180.dp), contentScale = ContentScale.Fit)
                    }
                }
                if (kind == "history") item {
                    val lat = draft.text["lat"]?.toDoubleOrNull()?.let { PlacePolicy.safeCoordinate(it, true) }
                    val lng = draft.text["lng"]?.toDoubleOrNull()?.let { PlacePolicy.safeCoordinate(it, false) }
                    OutlinedButton(onClick = { runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com/maps/search/?api=1&query=$lat,$lng"))) } }, enabled = lat != null && lng != null && !state.busy) { Text("Comprobar ubicación en el mapa") }
                }
                item {
                    OutlinedButton(onClick = { preview = true }, enabled = !state.busy) { Text("Previsualizar imágenes y narración") }
                    OutlinedButton(onClick = { model.local("save") }, enabled = !state.busy) { Text("Guardar borrador local") }
                    Button(onClick = { review = true }, enabled = !state.busy) { Text("Revisar guardado") }
                    TextButton(onClick = { refresh = true }, enabled = !state.busy) { Text("Descartar formulario y actualizar") }
                }
            }
        }
    }
    if (drafts) AdminDraftPicker(state.localDrafts, state.busy, state.message, { drafts = false }, { id -> drafts = false; model.local("restore", id) }, { id -> model.local("delete", id) })
    if (preview && draft != null) Dialog(onDismissRequest = { preview = false }) {
        Surface {
            LazyColumn(Modifier.fillMaxHeight(.85f).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                item { Text("Vista previa sin publicar", style = MaterialTheme.typography.titleLarge); TextButton(onClick = { preview = false }) { Text("Volver al editor") }; Text(draft.text["title"].orEmpty()) }
                items(if (kind == "history") listOf("imgPast", "imgPresent") else listOf("coverUrl")) { key ->
                    Text(if (key == "imgPast") draft.text["labelPast"].orEmpty() else if (key == "imgPresent") draft.text["labelPresent"].orEmpty() else "Portada")
                    DiscoveryPolicy.media(draft.text[key].orEmpty())?.let { AsyncImage(it, "Fotografía completa", Modifier.fillMaxWidth().height(220.dp), contentScale = ContentScale.Fit) }
                }
                item { Text(draft.text[if (kind == "history") "desc" else "label"].orEmpty()); if (kind == "history") { Text(draft.text["titleEn"].orEmpty()); Text(draft.text["descEn"].orEmpty()) } }
                items(if (kind == "history") listOf("audioUrl", "audioUrlEn") else listOf("audioUrl")) { key ->
                    val source = draft.text[key].orEmpty().ifBlank { if (kind == "podcast") "cancion-muestra-vive-loja.mp3" else "" }
                    PlaceMediaPolicy.audio(source)?.let { url ->
                        val audioKey = prefix + draft.id + ":" + key
                        OutlinedButton(onClick = { audioPlayer.play(audioKey, title + if (key.endsWith("En")) " · EN" else " · ES", url) }) { Text(if (audio.key == audioKey && audio.playing) "Pausar narración" else if (key.endsWith("En")) "Escuchar audio EN" else "Escuchar audio ES") }
                        if (audio.key == audioKey) { if (audio.buffering) LinearProgressIndicator(Modifier.fillMaxWidth()); audio.error?.let { Text(it) } }
                    }
                }
            }
        }
    }
    if (review && draft != null) AlertDialog(onDismissRequest = { review = false }, title = { Text("Guardar en VisitaLoja") },
        text = { Text(draft.text["title"].orEmpty() + "\nLos cambios se aplicarán al contenido compartido con la web. Se conservarán sus campos adicionales y bloqueos de visibilidad anteriores.") },
        confirmButton = { TextButton(onClick = { review = false; model.save() }) { Text("Confirmar guardado") } }, dismissButton = { TextButton(onClick = { review = false }) { Text("Volver") } })
    if (discard || refresh) AlertDialog(onDismissRequest = { discard = false; refresh = false }, title = { Text("Descartar formulario sin guardar") }, text = { Text("Los cambios de este formulario se perderán. Los borradores ya guardados y el contenido publicado se conservan.") },
        confirmButton = { TextButton(onClick = { if (refresh) model.bind(uid, kind) else model.dismiss(); discard = false; refresh = false }) { Text("Descartar") } }, dismissButton = { TextButton(onClick = { discard = false; refresh = false }) { Text("Conservar formulario") } })
    delete?.let { row -> AlertDialog(onDismissRequest = { delete = null }, title = { Text("Eliminar punto histórico") }, text = { Text(row.raw.text("title").ifBlank { row.id } + "\nSe eliminará el registro del servidor. Sus fotografías y audios no se borrarán.") },
        confirmButton = { TextButton(onClick = { delete = null; model.remove(row.id) }) { Text("Eliminar registro") } }, dismissButton = { TextButton(onClick = { delete = null }) { Text("Cancelar") } }) }
}
