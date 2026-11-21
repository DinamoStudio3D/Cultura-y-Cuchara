package com.visitaloja.app

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel

@Composable
internal fun AdminPlansEntry(uid: String) {
    val model: AdminPlansViewModel = viewModel(key = "admin-plans")
    val observed by model.state.collectAsStateWithLifecycle(); val state = observed.takeIf { it.uid == uid } ?: AdminPlansState()
    var open by remember(uid) { mutableStateOf(false) }; var group by remember(uid) { mutableStateOf("general") }
    var choose by remember(uid) { mutableStateOf(false) }; var discard by remember(uid) { mutableStateOf(false) }; var reload by remember(uid) { mutableStateOf(false) }
    var review by remember(uid) { mutableStateOf(false) }; var drafts by remember(uid) { mutableStateOf(false) }; var preview by remember(uid) { mutableStateOf(false) }
    var previewPlans by remember(uid) { mutableStateOf<List<Map<String, Any?>>>(emptyList()) }; var previewError by remember(uid) { mutableStateOf<String?>(null) }
    DisposableEffect(uid) { onDispose { model.bind(null) } }
    fun close() { if (state.busy) return; if (state.draft != state.initial) discard = true else { open = false; model.bind(null) } }
    OutlinedButton(onClick = { open = true; model.bind(uid) }) { Text("Administrar catálogo de planes") }
    if (open) Dialog(onDismissRequest = ::close, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxSize().systemBarsPadding()) { LazyColumn(Modifier.fillMaxSize().imePadding(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item {
                Text("Catálogo de planes", style = MaterialTheme.typography.headlineSmall)
                TextButton(onClick = ::close, enabled = !state.busy) { Text("Cerrar") }
                if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                state.message?.let { Text(it) }
                Text("Edita la oferta compartida con la web: textos, precios informativos, servicios, límites, visibilidad y plan recomendado. No cobra dinero, registra pagos ni cambia el plan asignado a un negocio.")
                Text("Los planes oficiales conservan ID y nombre comercial. Los datos antiguos se presentan según la oferta vigente que comparte la web. Sus beneficios se generan según el esquema compartido al previsualizar y publicar. No se eliminan planes ni fotos existentes.")
                Text("Los límites del catálogo pueden ser consultados por herramientas de negocios ya asociados. Revisa su alcance antes de publicar. La aplicación masiva de servicios a paradas, gestión de cobros y edición de preguntas frecuentes se completan por separado.")
                OutlinedButton(onClick = { if (state.draft != state.initial) reload = true else model.bind(uid) }, enabled = !state.busy) { Text("Actualizar catálogo y permisos") }
                OutlinedButton(onClick = { model.local("list"); drafts = true }, enabled = state.ready && !state.busy) { Text("Recuperar borrador de este teléfono") }
                OutlinedButton(onClick = { choose = true }, enabled = state.ready && !state.busy) { Text("Elegir presentación o plan") }
            }
            val current = state.groups.firstOrNull { it.id == group } ?: state.groups.firstOrNull()
            if (state.ready && current != null) {
                item { Text(current.title, style = MaterialTheme.typography.titleLarge) }
                items(current.fields, key = { it.key }) { field -> PlatformFieldControl(field, state.draft[field.key].orEmpty(), !state.busy) { model.edit(field.key, it) } }
                item {
                    OutlinedButton(onClick = {
                        previewError = null; previewPlans = emptyList()
                        try { val content = AdminPlanPolicy.build(state.base.orEmpty(), state.rows, state.draft, state.groups, state.catalog ?: error("Actualiza el catálogo."))
                            previewPlans = AdminPhotoPolicy.rows(content.first["plans"], 50)
                        } catch (e: Exception) { previewError = e.message }
                        preview = true
                    }, enabled = !state.busy) { Text("Validar y previsualizar planes") }
                    OutlinedButton(onClick = { model.local("save") }, enabled = !state.busy) { Text("Guardar borrador local") }
                    Button(onClick = { review = true }, enabled = !state.busy && state.draft != state.initial) { Text("Revisar y publicar catálogo") }
                }
            }
        } }
    }
    if (choose) Dialog(onDismissRequest = { choose = false }) { Surface { LazyColumn(Modifier.fillMaxHeight(.85f).padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item { Text("Presentación o plan"); TextButton(onClick = { choose = false }) { Text("Volver") } }
        items(state.groups, key = { it.id }) { row -> OutlinedButton(onClick = { group = row.id; choose = false }, modifier = Modifier.fillMaxWidth()) { Text(row.title) } }
    } } }
    if (preview) Dialog(onDismissRequest = { preview = false }) { Surface { LazyColumn(Modifier.fillMaxHeight(.85f).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Text("Vista previa sin publicar", style = MaterialTheme.typography.titleLarge); TextButton(onClick = { preview = false }) { Text("Volver") }; previewError?.let { Text(it) }; Text(state.draft["g|title"].orEmpty()); Text(state.draft["g|subtitle"].orEmpty()) }
        items(previewPlans, key = { it.text("id") }) { row -> OutlinedCard { Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(row.text("name"), style = MaterialTheme.typography.titleMedium); Text(if (row["active"] == true) "Visible" else "Oculto"); if (row["recommended"] == true) Text("Más recomendado")
            Text("Mensual USD ${row["monthly"]} · Anual USD ${row["annual"]}"); Text(row.text("description"))
            (row["benefits"] as? List<*>)?.filterIsInstance<String>()?.forEach { Text("• $it") }; Text(row.text("cta"))
        } } }
    } } }
    if (drafts) AdminDraftPicker(state.localDrafts, state.busy, state.message, { drafts = false }, { drafts = false; model.local("restore") }, { model.local("delete") })
    if (review) AlertDialog(onDismissRequest = { review = false }, title = { Text("Publicar catálogo de planes") }, text = { Text("Se publicarán precios, textos, servicios y límites de todos los planes, junto al contacto comercial y accesos web. Los planes oficiales antiguos se guardarán con el esquema vigente. No se registran cobros ni se reasignan suscripciones; los límites pueden afectar herramientas que consultan este catálogo. Las preguntas frecuentes y otros datos se conservan.") }, confirmButton = { TextButton(onClick = { review = false; model.save() }) { Text("Confirmar publicación") } }, dismissButton = { TextButton(onClick = { review = false }) { Text("Revisar de nuevo") } })
    if (discard || reload) AlertDialog(onDismissRequest = { discard = false; reload = false }, title = { Text("Descartar formulario sin publicar") }, text = { Text("El catálogo publicado y los borradores locales guardados se conservan.") }, confirmButton = { TextButton(onClick = { if (reload) model.bind(uid) else { open = false; model.bind(null) }; discard = false; reload = false }) { Text("Descartar") } }, dismissButton = { TextButton(onClick = { discard = false; reload = false }) { Text("Conservar") } })
}
