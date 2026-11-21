package com.visitaloja.app

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage

@Composable
internal fun AdminPlaceEditorScreen(uid: String, id: String, creating: Boolean, close: () -> Unit, saved: () -> Unit) {
    val model: AdminPlaceEditorViewModel = viewModel(key = "admin-place-editor-" + id)
    val observed by model.state.collectAsStateWithLifecycle()
    val state = observed.takeIf { it.uid == uid && it.place == id } ?: AdminPlaceEditorState()
    var section by remember(uid, id) { mutableStateOf("data") }
    var review by remember(uid, id) { mutableStateOf(false) }
    var photo by remember(uid, id) { mutableStateOf<AdminPlacePhoto?>(null) }
    var discard by remember(uid, id) { mutableStateOf(false) }
    val context = LocalContext.current
    var uploadPurpose by remember(uid, id) { mutableStateOf("gallery") }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) model.upload(context, uri, uploadPurpose)
    }
    DisposableEffect(uid, id) { model.bind(uid, id, creating); onDispose { model.bind(null, "", false) } }
    LaunchedEffect(state.saved) { if (state.saved) saved() }
    val draft = state.draft
    fun edit(next: AdminPlaceDraft) = model.edit(next)
    fun requestClose() {
        if (state.busy) return
        if (state.ready && (state.creating || draft != AdminPlaceEditorPolicy.read(state.base.orEmpty(), false))) discard = true else close()
    }
    Dialog(onDismissRequest = ::requestClose, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxSize().systemBarsPadding()) {
            LazyColumn(Modifier.fillMaxSize().imePadding(), contentPadding = PaddingValues(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)) {
                item {
                    Text(if (state.creating || creating && !state.ready) "Crear parada" else "Editar parada",
                        style = MaterialTheme.typography.headlineSmall)
                    Text(draft.text["title"].orEmpty())
                    TextButton(onClick = ::requestClose, enabled = !state.busy) { Text("Cerrar editor") }
                    if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                    state.message?.let { Text(it) }
                    if (!state.ready && !state.busy && !state.saved)
                        OutlinedButton(onClick = { model.bind(uid, id, creating) }) { Text("Actualizar esta misma parada") }
                }
                if (state.ready) {
                    item {
                        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            listOf("data" to "Información", "location" to "Ubicación", "contact" to "Contacto y servicios",
                                "media" to "Fotos y video", "publication" to "Publicación").forEach { (key, title) ->
                                FilterChip(section == key, { section = key }, label = { Text(title) })
                            }
                        }
                    }
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            when (section) {
                                "data" -> {
                                    listOf("title", "titleEn", "description", "descEn", "tag", "dish", "dishEn").forEach { AdminPlaceTextField(it, draft, !state.busy, model::edit) }
                                    val categories = AdminPlaceEditorPolicy.categories.toList().toMutableList()
                                    if (draft.category.isNotBlank() && draft.category !in AdminPlaceEditorPolicy.categories) categories.add(draft.category to draft.category)
                                    AdminPlaceChoice("Categoría", draft.category, categories, !state.busy) { edit(draft.copy(category = it)) }
                                }
                                "location" -> {
                                    AdminPlaceChoice("Cantón", draft.canton, CantonPolicy.catalogue.map { it.id to it.name }, !state.busy) { edit(draft.copy(canton = it)) }
                                    listOf("address", "lat", "lng").forEach { AdminPlaceTextField(it, draft, !state.busy, model::edit) }
                                    Text("Usa las coordenadas exactas del establecimiento o lugar.")
                                    val lat = PlacePolicy.safeCoordinate(draft.text["lat"]?.toDoubleOrNull(), true)
                                    val lng = PlacePolicy.safeCoordinate(draft.text["lng"]?.toDoubleOrNull(), false)
                                    OutlinedButton(onClick = {
                                        runCatching { context.startActivity(Intent(Intent.ACTION_VIEW,
                                            Uri.parse("https://www.google.com/maps/search/?api=1&query=" + lat + "," + lng))) }
                                    }, enabled = lat != null && lng != null) { Text("Comprobar ubicación en el mapa") }
                                }
                                "contact" -> {
                                    listOf("hours", "hoursEn", "phone", "whatsapp", "website", "instagram", "facebook", "tiktok", "priceRange").forEach { AdminPlaceTextField(it, draft, !state.busy, model::edit) }
                                    Text("Formas de pago", style = MaterialTheme.typography.titleMedium)
                                    PlaceInfoPolicy.payments.forEach { (key, label) ->
                                        Row { Checkbox(key in draft.payments, { checked ->
                                            edit(draft.copy(payments = if (checked) draft.payments + key else draft.payments - key))
                                        }, enabled = !state.busy); Text(label) }
                                    }
                                    Text("Servicios", style = MaterialTheme.typography.titleMedium)
                                    PlaceInfoPolicy.amenities.forEach { (key, label) ->
                                        Row { Checkbox(key in draft.amenities, { checked ->
                                            edit(draft.copy(amenities = if (checked) draft.amenities + key else draft.amenities - key))
                                        }, enabled = !state.busy); Text(label) }
                                    }
                                }
                                "media" -> {
                                    listOf("customLogoUrl", "heroImage", "youtubeUrl", "audioUrl", "audioUrlEn").forEach { AdminPlaceTextField(it, draft, !state.busy, model::edit) }
                                    listOf("customLogoUrl", "heroImage").forEach { key ->
                                        AdminPlaceEditorPolicy.image(draft.text[key].orEmpty())?.let { url ->
                                            AsyncImage(url, AdminPlaceEditorPolicy.labels.getValue(key).first,
                                                Modifier.fillMaxWidth().height(140.dp), contentScale = ContentScale.Fit)
                                        }
                                    }
                                    listOf("logo" to "Elegir logo del teléfono", "hero" to "Elegir portada del teléfono",
                                        "gallery" to "Añadir foto del teléfono").forEach { (purpose, label) ->
                                        OutlinedButton(onClick = { uploadPurpose = purpose; picker.launch("image/*") },
                                            enabled = !state.busy && (purpose != "gallery" || draft.photos.size < minOf(100,
                                                maxOf(state.galleryLimit, AdminPlaceEditorPolicy.read(state.base.orEmpty(), false).photos.size)))) {
                                            Text(label)
                                        }
                                    }
                                    Text("Las imágenes se suben al seleccionarlas; solo se muestran en la ficha después de guardar. Si sales sin guardar, la ficha conserva sus imágenes anteriores.")
                                    Text("Galería: " + draft.photos.size + " · límite del plan: " + state.galleryLimit)
                                    Text("Añade enlaces de fotografías. Puedes cambiar el orden y los créditos. El logo y la portada independiente no cuentan como fotos de galería.")
                                    OutlinedButton(onClick = { photo = AdminPlacePhoto(java.util.UUID.randomUUID().toString(), "") },
                                        enabled = !state.busy && draft.photos.size < maxOf(state.galleryLimit,
                                            (state.base?.get("gallery") as? List<*>)?.size ?: 0) && draft.photos.size < 100) { Text("Añadir fotografía por enlace") }
                                }
                                "publication" -> {
                                    AdminPlaceChoice("Publicación", draft.publication,
                                        listOf("draft" to "Borrador", "published" to "Publicado", "hidden" to "Oculto"), !state.busy) {
                                        edit(draft.copy(publication = it))
                                    }
                                    Row { Checkbox(draft.active, { edit(draft.copy(active = it)) }, enabled = !state.busy); Text("Parada activa") }
                                    Text("Un borrador u oculto no aparece al público. Desactivar conserva la ficha y sus registros.")
                                    if (AdminPlaceEditorPolicy.usesPin(draft.category)) {
                                        Text(if (state.hasPin) "Ya tiene un PIN privado. Déjalo vacío para conservarlo." else "Esta categoría requiere un PIN privado de 4 a 6 números.")
                                        OutlinedTextField(draft.pin, { edit(draft.copy(pin = it.filter(Char::isDigit).take(6))) },
                                            label = { Text("Nuevo PIN privado") }, visualTransformation = PasswordVisualTransformation(),
                                            enabled = !state.busy, modifier = Modifier.fillMaxWidth())
                                    } else Text("Esta categoría no utiliza PIN de pasaporte. Al guardar se retirará un PIN anterior si lo tuviera.")
                                    Text("La creación utiliza confirmación de visitas por encargado. La configuración de QR autónomo y las asignaciones de personal se mantienen en sus herramientas correspondientes.")
                                }
                            }
                        }
                    }
                    if (section == "media") itemsIndexed(draft.photos, key = { _, item -> item.key }) { index, item ->
                        OutlinedCard(Modifier.fillMaxWidth()) {
                            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                AdminPlaceEditorPolicy.image(item.url)?.let { url ->
                                    AsyncImage(url, item.caption.ifBlank { "Fotografía de la parada" },
                                        Modifier.fillMaxWidth().height(180.dp), contentScale = ContentScale.Fit)
                                }
                                Text("Foto " + (index + 1) + if (index == 0) " · primera de la galería" else "")
                                if (item.credit.isNotBlank()) Text(item.credit)
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    TextButton(onClick = { photo = item }, enabled = !state.busy) { Text("Editar") }
                                    TextButton(onClick = {
                                        val images = draft.photos.toMutableList()
                                        images.add(index - 1, images.removeAt(index))
                                        edit(draft.copy(photos = images))
                                    }, enabled = !state.busy && index > 0) { Text("Subir") }
                                    TextButton(onClick = {
                                        val images = draft.photos.toMutableList()
                                        images.add(index + 1, images.removeAt(index))
                                        edit(draft.copy(photos = images))
                                    }, enabled = !state.busy && index < draft.photos.lastIndex) { Text("Bajar") }
                                }
                                TextButton(onClick = { edit(draft.copy(photos = draft.photos.filterNot { it.key == item.key })) },
                                    enabled = !state.busy) { Text("Quitar de la galería") }
                            }
                        }
                    }
                    item {
                        Button(onClick = { review = true }, enabled = !state.busy, modifier = Modifier.fillMaxWidth()) { Text("Revisar y guardar parada") }
                        Text("Los cambios se comparten con la web únicamente al guardar.")
                    }
                }
            }
        }
    }
    if (state.ready) photo?.let { selected ->
        key(selected.key) {
            var url by remember { mutableStateOf(selected.url) }
            var caption by remember { mutableStateOf(selected.caption) }
            var credit by remember { mutableStateOf(selected.credit) }
            AlertDialog(onDismissRequest = { photo = null }, title = { Text("Fotografía") },
                text = { Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(url, { url = it.take(2000) }, label = { Text("Enlace HTTPS de la imagen") })
                    OutlinedTextField(caption, { caption = it.take(300) }, label = { Text("Descripción de la fotografía") })
                    OutlinedTextField(credit, { credit = it.take(200) }, label = { Text("Crédito / autor") })
                    AdminPlaceEditorPolicy.image(url.trim())?.let { AsyncImage(it, null, Modifier.fillMaxWidth().height(160.dp), contentScale = ContentScale.Fit) }
                } }, confirmButton = { TextButton(onClick = {
                    val updated = selected.copy(url = url.trim(), caption = caption, credit = credit)
                    edit(draft.copy(photos = if (draft.photos.any { it.key == selected.key })
                        draft.photos.map { if (it.key == selected.key) updated else it } else draft.photos + updated))
                    photo = null
                }, enabled = AdminPlaceEditorPolicy.image(url.trim()) != null) { Text("Aplicar al borrador") } },
                dismissButton = { TextButton(onClick = { photo = null }) { Text("Cancelar") } })
        }
    }
    if (review && state.ready) AlertDialog(onDismissRequest = { review = false }, title = { Text("Guardar en VisitaLoja") },
        text = { Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(draft.text["title"].orEmpty())
            Text(AdminPlaceEditorPolicy.categories[draft.category] ?: draft.category)
            Text("Cantón: " + draft.canton + " · " + draft.text["lat"].orEmpty() + ", " + draft.text["lng"].orEmpty())
            Text("Publicación: " + draft.publication + (if (draft.active) " · activa" else " · desactivada"))
            Text(draft.photos.size.toString() + " fotografías")
            if (!AdminPlaceEditorPolicy.usesPin(draft.category)) Text("Sin PIN de pasaporte; se retirará uno anterior si existía.")
            else Text(if (draft.pin.isBlank()) "Se conserva el PIN privado existente." else "Se guardará el nuevo PIN en el registro privado.")
            Text("Esto crea o actualiza su ficha también en la web.")
        } }, confirmButton = { TextButton(onClick = { review = false; model.save() }, enabled = !state.busy) { Text("Guardar parada") } },
        dismissButton = { TextButton(onClick = { review = false }) { Text("Volver") } })
    if (discard) AlertDialog(onDismissRequest = { discard = false }, title = { Text("¿Cerrar sin guardar?") },
        text = { Text("Los cambios de este borrador se descartarán.") },
        confirmButton = { TextButton(onClick = { discard = false; close() }) { Text("Descartar y cerrar") } },
        dismissButton = { TextButton(onClick = { discard = false }) { Text("Continuar editando") } })
}

@Composable
private fun AdminPlaceChoice(label: String, value: String, options: List<Pair<String, String>>,
    enabled: Boolean, change: (String) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Column {
        Text(label, style = MaterialTheme.typography.labelLarge)
        Box {
            OutlinedButton(onClick = { expanded = true }, enabled = enabled) {
                Text(options.firstOrNull { it.first == value }?.second ?: "Seleccionar")
            }
            DropdownMenu(expanded, { expanded = false }, modifier = Modifier.heightIn(max = 340.dp)) {
                options.forEach { (key, title) -> DropdownMenuItem(text = { Text(title) }, onClick = { expanded = false; change(key) }) }
            }
        }
    }
}

@Composable
private fun AdminPlaceTextField(key: String, draft: AdminPlaceDraft, enabled: Boolean, change: (AdminPlaceDraft) -> Unit) {
    val meta = AdminPlaceEditorPolicy.labels.getValue(key)
    OutlinedTextField(draft.text[key].orEmpty(), { change(draft.copy(text = draft.text + (key to it.take(meta.second)))) },
        label = { Text(meta.first) }, enabled = enabled, modifier = Modifier.fillMaxWidth())
}
