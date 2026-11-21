package com.visitaloja.app

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel

@Composable
internal fun AdminSubscriptionsEntry(uid: String) {
    val model: AdminSubscriptionsViewModel = viewModel(key = "admin-business-subscriptions")
    val observed by model.state.collectAsStateWithLifecycle(); val state = observed.takeIf { it.uid == uid } ?: AdminSubscriptionState()
    var open by remember(uid) { mutableStateOf(false) }; var query by remember(uid) { mutableStateOf("") }; var filter by remember(uid) { mutableStateOf("") }
    var all by remember(uid) { mutableStateOf(false) }; var discard by remember(uid) { mutableStateOf(false) }; var review by remember(uid) { mutableStateOf(false) }
    var plans by remember(uid) { mutableStateOf(false) }; var drafts by remember(uid) { mutableStateOf(false) }
    DisposableEffect(uid) { onDispose { model.bind(null) } }
    fun back() { val d = state.draft ?: return; if (state.busy) return; if (d.text != AdminSubscriptionPolicy.read(d.id, d.base).text) discard = true else model.dismiss() }
    OutlinedButton(onClick = { open = true; model.bind(uid) }) { Text("Suscripciones por negocio") }
    if (open) Dialog(onDismissRequest = { if (state.draft != null) back() else if (!state.busy) { open = false; model.bind(null) } }, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxSize().systemBarsPadding()) { LazyColumn(Modifier.fillMaxSize().imePadding(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item {
                Text("Suscripciones por negocio", style = MaterialTheme.typography.headlineSmall)
                TextButton(onClick = { if (state.draft != null) back() else { open = false; model.bind(null) } }, enabled = !state.busy) { Text(if (state.draft == null) "Cerrar" else "Volver al listado") }
                if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                state.message?.let { Text(it) }
            }
            val d = state.draft
            if (state.ready && d == null) {
                item {
                    Text("Gestiona plan, estado, vigencia, contacto y servicios de una parada. No cobra dinero ni añade registros al historial de pagos. Cambiar el plan o estado puede afectar sus servicios y visibilidad pagada.")
                    OutlinedButton(onClick = { model.bind(uid) }, enabled = !state.busy) { Text("Actualizar paradas y catálogo") }
                    OutlinedButton(onClick = { model.local("list"); drafts = true }, enabled = !state.busy) { Text("Recuperar borrador local") }
                    Text("${state.rows.size} paradas cargadas · " + if (state.complete) "Consulta completa según la última lectura" else "Quedan páginas por cargar")
                    Text("Los filtros se aplican solo a las paradas cargadas; los vencimientos se calculan al mostrar esta vista, en hora de Loja.")
                    OutlinedTextField(query, { query = it.take(150) }, label = { Text("Buscar negocio, contacto o teléfono") }, modifier = Modifier.fillMaxWidth())
                    Row { Checkbox(all, { all = it }); Text("Incluir gratuitas y sin plan") }
                    Row(Modifier.horizontalScroll(rememberScrollState())) { FilterChip(filter.isBlank(), { filter = "" }, label = { Text("Todos los estados") }); AdminSubscriptionPolicy.filters.forEach { (key, label) -> FilterChip(filter == key, { filter = key }, label = { Text(label) }) } }
                    if (!state.complete) OutlinedButton(onClick = { model.more() }, enabled = !state.busy && state.rows.size < 5000) { Text("Cargar hasta 100 más") }
                    if (state.rows.size >= 5000 && !state.complete) Text("Límite de 5000 paradas. Este listado sigue siendo parcial.")
                }
                val now = System.currentTimeMillis()
                val shown = state.rows.filter { row -> val s = row.data.map("subscription")
                    (all || AdminSubscriptionPolicy.paid(row.data)) && (filter.isBlank() || AdminSubscriptionPolicy.state(row.data, now) == filter) && PlacePolicy.normalize(row.data.text("title") + " " + s.text("contactName") + " " + s.text("contactWhatsapp")).contains(PlacePolicy.normalize(query))
                }
                item { Text("${shown.size} paradas coinciden entre las cargadas") }
                if (shown.isEmpty()) item { Text("No hay coincidencias. Puedes incluir paradas gratuitas o cargar más páginas.") }
                items(shown, key = { it.id }) { row -> val s = row.data.map("subscription")
                    OutlinedCard(Modifier.fillMaxWidth()) { Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(row.data.text("title").ifBlank { row.id }, style = MaterialTheme.typography.titleMedium)
                        Text("Plan: " + state.plans.firstOrNull { it.text("id") == s.text("plan") }?.text("name").orEmpty().ifBlank { s.text("plan").ifBlank { "Gratis / sin asignación" } })
                        Text(AdminSubscriptionPolicy.filters[AdminSubscriptionPolicy.state(row.data, now)].orEmpty())
                        val end = s["endAt"].takeUnless { it == "" } ?: s["endDate"]
                        Text("Fin de beneficios · Loja: " + AdminSubscriptionPolicy.moment(end, true)?.let { AdminRewardResultPolicy.date(it) }.orEmpty().ifBlank { "Sin fecha definida" })
                        OutlinedButton(onClick = { model.select(row.id) }, enabled = !state.busy) { Text("Gestionar suscripción") }
                    } }
                }
            } else if (state.ready && d != null) {
                item {
                    Text(d.base.text("title").ifBlank { d.id }, style = MaterialTheme.typography.titleLarge)
                    Text("Parada: " + d.id)
                    Text("Plan preparado: " + state.plans.firstOrNull { it.text("id") == d.text["plan"] }?.text("name").orEmpty().ifBlank { d.text["plan"].orEmpty() })
                    OutlinedButton(onClick = { plans = true }, enabled = !state.busy) { Text("Elegir plan y preparar sus servicios") }
                    Text("Elegir plan copia sus servicios al formulario. No modifica el importe registrado ni publica hasta que confirmes. Puedes ajustar los servicios individualmente.")
                }
                items(AdminSubscriptionPolicy.fields(), key = { it.key }) { field -> PlatformFieldControl(field, d.text[field.key].orEmpty(), !state.busy) { model.edit(field.key, it) } }
                item {
                    Text("Preparar vigencia desde el fin vigente o desde ahora; también selecciona estado Activo. No registra un pago.")
                    Row(Modifier.horizontalScroll(rememberScrollState())) { listOf(1, 3, 6, 12).forEach { months -> TextButton(onClick = { model.renew(months) }, enabled = !state.busy) { Text("+$months meses") } } }
                    Text("El importe, método y referencia son datos informativos actuales. Este formulario no añade, elimina ni altera los registros del historial de pagos.")
                    OutlinedButton(onClick = { model.local("save") }, enabled = !state.busy) { Text("Guardar borrador local") }
                    Button(onClick = { review = true }, enabled = !state.busy && d.text != AdminSubscriptionPolicy.read(d.id, d.base).text) { Text("Revisar y guardar suscripción") }
                    Text("Historial de pagos existente · consulta", style = MaterialTheme.typography.titleMedium)
                }
                val history = d.base.map("subscription")["paymentHistory"] as? List<*>
                if (history.isNullOrEmpty()) item { Text("No hay registros de pagos en el historial.") }
                else {
                    item { Text("${history.size} registros almacenados. Se muestran los últimos 120 sin modificarlos.") }
                    items(history.takeLast(120).reversed()) { value ->
                        val row = (value as? Map<*, *>)?.entries?.associate { it.key.toString() to it.value }
                        if (row == null) Text("Registro antiguo con formato no compatible; se conserva sin modificar.")
                        else { Text("USD " + row["amount"] + " · " + row.text("method")); Text(AdminRewardResultPolicy.date(row["paidAt"]).ifBlank { "Sin fecha" }); Text(row.text("notes")) }
                    }
                }
            }
        } }
    }
    if (plans) Dialog(onDismissRequest = { plans = false }) { Surface { LazyColumn(Modifier.fillMaxHeight(.85f).padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { Text("Elegir plan visible"); TextButton(onClick = { plans = false }) { Text("Volver") } }
        items(state.plans, key = { it.text("id") }) { row -> OutlinedButton(onClick = { model.plan(row.text("id")); plans = false }, enabled = !state.busy && row["active"] != false) { Text(row.text("name") + if (row["active"] == false) " · oculto" else "") } }
    } } }
    if (drafts) AdminDraftPicker(state.localDrafts, state.busy, state.message, { drafts = false }, { id -> drafts = false; model.local("restore", id) }, { id -> model.local("delete", id) })
    if (review) AlertDialog(onDismissRequest = { review = false }, title = { Text("Guardar suscripción de esta parada") }, text = { Text("Negocio: " + state.draft?.base?.text("title").orEmpty() + "\nPlan: " + state.draft?.text?.get("plan").orEmpty() + "\nEstado: " + state.draft?.text?.get("status").orEmpty() + "\nFin: " + state.draft?.text?.get("endAt").orEmpty() + "\nSe actualizarán vigencia, contacto, servicios e importe informativo de este formulario. No se cobra dinero ni se registra un pago. Se conservan galería, productos e historial. Los cambios pueden activar o suspender beneficios del negocio.") }, confirmButton = { TextButton(onClick = { review = false; model.save() }) { Text("Confirmar guardado") } }, dismissButton = { TextButton(onClick = { review = false }) { Text("Seguir editando") } })
    if (discard) AlertDialog(onDismissRequest = { discard = false }, title = { Text("Descartar formulario") }, text = { Text("Los datos publicados y los borradores locales guardados se conservan.") }, confirmButton = { TextButton(onClick = { model.dismiss(); discard = false }) { Text("Descartar") } }, dismissButton = { TextButton(onClick = { discard = false }) { Text("Conservar") } })
}
