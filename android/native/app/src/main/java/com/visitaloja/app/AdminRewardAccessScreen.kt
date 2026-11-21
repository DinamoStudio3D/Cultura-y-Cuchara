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

private data class RewardApproval(val uid: String, val business: String, val campaign: String)
@Composable
internal fun AdminRewardAccessEntry(uid: String) {
    val model: AdminRewardAccessViewModel = viewModel(key = "admin-reward-access")
    val observed by model.state.collectAsStateWithLifecycle(); val state = observed.takeIf { it.uid == uid } ?: AdminRewardAccessState()
    var open by remember(uid) { mutableStateOf(false) }; var tab by remember(uid) { mutableStateOf("requests") }
    var query by remember(uid) { mutableStateOf("") }; var campaign by remember(uid) { mutableStateOf("") }
    var allRequests by remember(uid) { mutableStateOf(false) }; var approval by remember(uid) { mutableStateOf<RewardApproval?>(null) }
    var toggle by remember(uid) { mutableStateOf<Pair<String, Boolean>?>(null) }
    DisposableEffect(uid) { onDispose { model.bind(null) } }
    OutlinedButton(onClick = { open = true; campaign = ""; model.bind(uid) }) { Text("Solicitudes y acceso de negocios a recompensas") }
    if (open) Dialog(onDismissRequest = { if (!state.busy) { open = false; model.bind(null) } }, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxSize().systemBarsPadding()) { LazyColumn(Modifier.fillMaxSize().imePadding(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item {
                Text("Negocios y recompensas", style = MaterialTheme.typography.headlineSmall)
                TextButton(onClick = { open = false; model.bind(null) }, enabled = !state.busy) { Text("Cerrar") }
                if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                state.message?.let { Text(it) }
                Text("Revisa las solicitudes existentes de cuentas que quieren validar recompensas. Aprobar añade una campaña de Chabaquito clásico; no crea usuarios ni concede administración general. Los premios del pasaporte se asignan en su propio editor.")
                OutlinedButton(onClick = { model.bind(uid) }, enabled = !state.busy) { Text("Actualizar solicitudes y permisos") }
                Row { FilterChip(tab == "requests", { tab = "requests"; query = "" }, label = { Text("Solicitudes") }, enabled = !state.busy); FilterChip(tab == "merchants", { tab = "merchants"; query = "" }, label = { Text("Negocios registrados") }, enabled = !state.busy) }
                OutlinedTextField(query, { query = it.take(150) }, label = { Text("Buscar nombre, correo o UID") }, modifier = Modifier.fillMaxWidth())
            }
            if (state.ready && tab == "requests") {
                item {
                    OutlinedTextField(campaign, { campaign = it.take(60) }, label = { Text("Campaña para aprobar · vacío usa la actual") }, enabled = !state.busy, modifier = Modifier.fillMaxWidth())
                    Text("Campaña actual: " + state.campaign + ". La campaña elegida debe existir en el catálogo de recompensas.")
                    Row { Checkbox(allRequests, { allRequests = it }); Text("Mostrar también solicitudes resueltas") }
                }
                val shown = state.requests.entries.filter { (allRequests || it.value["status"] == "pending") && PlacePolicy.normalize(it.key + " " + it.value.text("email") + " " + it.value.text("displayName")).contains(PlacePolicy.normalize(query)) }
                item { Text("${shown.size} solicitudes que coinciden · ${state.requests.size} cargadas") }
                if (shown.isEmpty()) item { Text("No hay solicitudes que coincidan.") }
                items(shown, key = { it.key }) { request ->
                    var business by remember(request.key, state.merchants[request.key]?.text("businessName")) { mutableStateOf(state.merchants[request.key]?.text("businessName").orEmpty()) }
                    OutlinedCard(Modifier.fillMaxWidth()) { Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(request.value.text("displayName").ifBlank { "Responsable del negocio" }, style = MaterialTheme.typography.titleMedium)
                        Text(request.value.text("email")); Text("UID: " + request.key, style = MaterialTheme.typography.bodySmall)
                        Text("Estado: " + when (request.value.text("status")) { "pending" -> "Pendiente"; "approved" -> "Aprobada"; else -> request.value.text("status").ifBlank { "Desconocido" } })
                        Text("Solicitud · Loja: " + AdminRewardResultPolicy.date(request.value["requestedAt"]).ifBlank { "Sin fecha" })
                        if (request.value["status"] == "pending") {
                            OutlinedTextField(business, { business = it.take(120) }, label = { Text("Nombre del negocio que autorizas") }, enabled = !state.busy, modifier = Modifier.fillMaxWidth())
                            OutlinedButton(onClick = { approval = RewardApproval(request.key, business, campaign.ifBlank { state.campaign }) }, enabled = !state.busy && business.isNotBlank()) { Text("Revisar aprobación") }
                        }
                    } }
                }
            } else if (state.ready) {
                item { Text("Estado compartido por herramientas del negocio: suspender puede impedir canjes y otras operaciones ya asignadas. Reactivar restablece esos accesos existentes. No se eliminan asignaciones, códigos ni historial.") }
                val shown = state.merchants.entries.filter { PlacePolicy.normalize(it.key + " " + it.value.text("businessName") + " " + it.value.text("displayName") + " " + it.value.text("email")).contains(PlacePolicy.normalize(query)) }
                item { Text("${shown.size} cuentas que coinciden · ${state.merchants.size} cargadas") }
                if (shown.isEmpty()) item { Text("No hay negocios registrados que coincidan.") }
                items(shown, key = { it.key }) { merchant -> val row = merchant.value
                    OutlinedCard(Modifier.fillMaxWidth()) { Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(row.text("businessName").ifBlank { row.text("displayName").ifBlank { merchant.key } }, style = MaterialTheme.typography.titleMedium)
                        Text(row.text("email")); Text("UID: " + merchant.key, style = MaterialTheme.typography.bodySmall)
                        Text(when (row["active"]) { true -> "Cuenta activa"; false -> "Cuenta suspendida"; else -> "Estado no configurado" })
                        Text("Campañas de Chabaquito: " + (row["campaignIds"] as? List<*>)?.filterIsInstance<String>()?.joinToString(", ").orEmpty().ifBlank { "Sin asignaciones" })
                        Text("Permisos de pasaporte existentes: " + (row["passportGrants"] as? List<*>)?.filterIsInstance<String>()?.joinToString(", ").orEmpty().ifBlank { "Sin asignaciones" })
                        OutlinedButton(onClick = { toggle = merchant.key to (row["active"] != true) }, enabled = !state.busy) { Text(if (row["active"] == true) "Revisar suspensión" else "Revisar reactivación") }
                    } }
                }
            }
        } }
    }
    approval?.let { choice -> AlertDialog(onDismissRequest = { approval = null }, title = { Text("Aprobar negocio para esta campaña") }, text = { Text("Negocio: ${choice.business}\nCampaña: ${choice.campaign}\nCuenta: ${choice.uid}\nSe añadirá esta campaña conservando los demás permisos. Una cuenta suspendida seguirá suspendida hasta que la reactives expresamente. No se crea una cuenta ni se otorga administración general.") }, confirmButton = { TextButton(onClick = { approval = null; model.approve(choice.uid, choice.business, choice.campaign) }, enabled = !state.busy) { Text("Confirmar aprobación") } }, dismissButton = { TextButton(onClick = { approval = null }) { Text("Cancelar") } }) }
    toggle?.let { (target, active) -> AlertDialog(onDismissRequest = { toggle = null }, title = { Text(if (active) "Reactivar estado de la cuenta" else "Suspender estado de la cuenta") }, text = { Text("Cuenta: $target\nEste estado se comparte entre las herramientas asignadas al negocio. " + if (active) "Volverá a permitir sus operaciones autorizadas existentes, incluidos canjes. No añade campañas ni cambia su rol general." else "Puede impedir canjes y otras operaciones autorizadas hasta que la reactives. Sus permisos e historial se conservan.") }, confirmButton = { TextButton(onClick = { toggle = null; model.toggle(target, active) }, enabled = !state.busy) { Text(if (active) "Confirmar reactivación" else "Confirmar suspensión") } }, dismissButton = { TextButton(onClick = { toggle = null }) { Text("Cancelar") } }) }
}
