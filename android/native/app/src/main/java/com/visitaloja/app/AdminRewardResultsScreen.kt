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
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel

@Composable
internal fun AdminRewardResultsEntry(uid: String) {
    val model: AdminRewardResultsViewModel = viewModel(key = "admin-reward-results")
    val observed by model.state.collectAsStateWithLifecycle(); val state = observed.takeIf { it.uid == uid } ?: AdminRewardResultsState()
    var open by remember(uid) { mutableStateOf(false) }; var kind by remember(uid) { mutableStateOf("classic") }
    var campaignInput by remember(uid) { mutableStateOf("") }; var query by remember(uid) { mutableStateOf("") }
    var status by remember(uid) { mutableStateOf("") }; var mode by remember(uid) { mutableStateOf("") }
    var action by remember(uid) { mutableStateOf<Pair<AdminRewardResult, String>?>(null) }; var exportReview by remember(uid) { mutableStateOf(false) }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri ->
        if (uri != null) model.export(uri) else model.cancelExport()
    }
    DisposableEffect(uid) { onDispose { model.bind(null) } }
    val filtered = AdminRewardResultPolicy.filtered(state.rows, query, status, mode)
    OutlinedButton(onClick = { open = true; model.bind(uid, kind) }) { Text("Resultados y canjes de recompensas") }
    if (open) Dialog(onDismissRequest = { if (!state.busy) { open = false; model.bind(null) } }, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxSize().systemBarsPadding()) { LazyColumn(Modifier.fillMaxSize().imePadding(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item {
                Text("Resultados de recompensas", style = MaterialTheme.typography.headlineSmall)
                TextButton(onClick = { open = false; model.bind(null) }, enabled = !state.busy) { Text("Cerrar") }
                if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                state.message?.let { Text(it) }
                Text("Acceso de administración general. Consulta registros existentes de Chabaquito clásico y pasaporte; no emite códigos ni cambia existencias. Los cambios de estado se confirman y quedan en auditoría.")
                Row {
                    listOf("classic" to "Chabaquito", "passport" to "Pasaporte").forEach { (key, label) -> FilterChip(kind == key, { kind = key; campaignInput = ""; query = ""; status = ""; mode = ""; model.bind(uid, kind) }, label = { Text(label) }, enabled = !state.busy) }
                }
                OutlinedTextField(campaignInput, { campaignInput = it.take(60) }, label = { Text("ID de campaña · vacío para la actual") }, enabled = !state.busy, modifier = Modifier.fillMaxWidth())
                OutlinedButton(onClick = { model.bind(uid, kind, campaignInput) }, enabled = !state.busy) { Text("Consultar campaña") }
                Text("Campaña cargada: " + state.campaign.ifBlank { "Sin consultar" })
            }
            if (state.ready) {
                item {
                    Text("${state.rows.size} registros cargados · " + if (state.complete) "Consulta completa según la última lectura" else "Consulta parcial: quedan páginas por cargar")
                    val counts = state.rows.groupingBy { it.raw.text("status") }.eachCount()
                    Text("Sobre los cargados: ${counts["pending"] ?: 0} pendientes · ${counts["delivered"] ?: 0} entregados · ${counts["cancelled"] ?: 0} anulados")
                    Text("Búsqueda, filtros, orden por fecha y CSV se aplican a los registros cargados. Las páginas se consultan por ID para incluir registros antiguos sin fecha. Actualiza para recoger cambios recientes.")
                    OutlinedTextField(query, { query = it.take(150) }, label = { Text("Buscar código, visitante, correo o premio") }, modifier = Modifier.fillMaxWidth())
                    Row(Modifier.horizontalScroll(rememberScrollState())) { FilterChip(status.isBlank(), { status = "" }, label = { Text("Todos los estados") }); AdminRewardResultPolicy.statuses.forEach { (key, label) -> FilterChip(status == key, { status = key }, label = { Text(label) }) } }
                    if (kind == "passport") Row { FilterChip(mode.isBlank(), { mode = "" }, label = { Text("Ambas modalidades") }); FilterChip(mode == "turista", { mode = "turista" }, label = { Text("Turista") }); FilterChip(mode == "lojano", { mode = "lojano" }, label = { Text("Lojano") }) }
                    Text("${filtered.size} registros coinciden")
                    OutlinedButton(onClick = { exportReview = true }, enabled = !state.busy && filtered.isNotEmpty()) { Text("Exportar CSV de filtrados y cargados") }
                    if (!state.complete) OutlinedButton(onClick = { model.more() }, enabled = !state.busy && state.rows.size < 5000) { Text("Cargar hasta 100 más") }
                    if (state.rows.size >= 5000 && !state.complete) Text("Límite de 5000 registros cargados. El informe y el CSV siguen siendo parciales; utiliza la web para una revisión adicional.")
                }
                if (filtered.isEmpty()) item { Text("No hay registros cargados que coincidan.") }
                items(filtered, key = { it.id }) { item -> val row = item.raw
                    OutlinedCard(Modifier.fillMaxWidth()) { Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(row.text("claimCode").ifBlank { item.id }, style = MaterialTheme.typography.titleMedium)
                        Text(AdminRewardResultPolicy.statuses[row.text("status")] ?: row.text("status").ifBlank { "Estado desconocido" })
                        Text(row.text("userName").ifBlank { "Visitante" }); row.text("userEmail").takeIf { it.isNotBlank() }?.let { Text(it) }; row.text("userWhatsapp").takeIf { it.isNotBlank() }?.let { Text("WhatsApp registrado: $it") }
                        Text(AdminRewardResultPolicy.reward(row).ifBlank { "Premio no indicado" })
                        if (kind == "passport") { Text("Modalidad: " + row.text("mode")); row.text("merchantUid").takeIf { it.isNotBlank() }?.let { Text("Negocio asignado UID: $it", style = MaterialTheme.typography.bodySmall) } }
                        Text("Registro · Loja: " + AdminRewardResultPolicy.date(row["createdAt"] ?: row["completedAt"]).ifBlank { "Sin fecha" })
                        AdminRewardResultPolicy.date(row[if (kind == "passport") "deliveredAt" else "processedAt"]).takeIf { it.isNotBlank() }?.let { Text("Procesado · Loja: $it") }
                        Row(Modifier.horizontalScroll(rememberScrollState())) { listOf("delivered" to "Marcar entregado", "cancelled" to "Anular", "pending" to "Reabrir pendiente").forEach { (next, label) ->
                            if (AdminRewardResultPolicy.allowed(kind, row.text("status"), next)) TextButton(onClick = { action = item to next }, enabled = !state.busy) { Text(label) }
                        } }
                    } }
                }
            }
        } }
    }
    action?.let { (item, next) -> AlertDialog(onDismissRequest = { action = null }, title = { Text("Confirmar cambio de canje") }, text = { Text("Código: " + item.raw.text("claimCode").ifBlank { item.id } + "\nNuevo estado: " + AdminRewardResultPolicy.statuses[next] + "\nEsta acción registra una entrega o corrección administrativa; no entrega físicamente el premio ni devuelve cupo. Revisa el código antes de confirmar.") }, confirmButton = { TextButton(onClick = { action = null; model.change(item, next) }, enabled = !state.busy) { Text("Confirmar cambio") } }, dismissButton = { TextButton(onClick = { action = null }) { Text("Cancelar") } }) }
    if (exportReview) AlertDialog(onDismissRequest = { exportReview = false }, title = { Text("Exportar ${filtered.size} registros cargados") }, text = { Text("El CSV incluirá códigos y datos personales disponibles de los participantes que coinciden con los filtros. " + (if (state.complete) "La consulta de la campaña está completa según la última lectura." else "La consulta es parcial: no incluye las páginas sin cargar.") + " Elige dónde guardarlo y compártelo solo con personas autorizadas.") }, confirmButton = { TextButton(onClick = { exportReview = false; if (model.prepareExport(filtered.map { it.id }.toSet())) picker.launch("VisitaLoja-${state.kind}-${state.campaign}-cargados.csv") }, enabled = !state.busy) { Text("Elegir archivo CSV") } }, dismissButton = { TextButton(onClick = { exportReview = false }) { Text("Cancelar") } })
}
