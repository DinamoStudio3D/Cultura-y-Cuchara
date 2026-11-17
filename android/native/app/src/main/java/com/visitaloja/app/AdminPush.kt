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
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import org.json.JSONObject

internal object AdminPushPolicy {
    const val ENDPOINT = "https://www.visitaloja.com/api/chabaquito-ranking?action=notifications"
    private val paths = setOf("/", "/planes.html", "/cantones.html", "/fidelidad.html", "/agenda.html",
        "/loja-en-el-tiempo.html", "/mesa-turistica.html", "/aliados.html", "/que-hacer-en-loja",
        "/hoteles-en-loja", "/restaurantes-en-loja", "/cafeterias-en-loja", "/huecas-en-loja",
        "/panaderias-en-loja", "/heladerias-en-loja", "/bares-en-loja", "/entretenimiento-en-loja", "/artesanias-en-loja")
    fun validate(title: String, message: String, url: String) {
        require(title.trim().length in 1..80 && message.trim().length in 1..240) { "Revisa el título y mensaje." }
        require(url.length in 1..500 && url.startsWith("/") && !url.startsWith("//") &&
            url.none { it.isWhitespace() || it == '\\' || it.code < 32 }) { "El destino debe ser una página de VisitaLoja." }
        val uri = java.net.URI(url)
        require(uri.rawAuthority == null && uri.scheme == null &&
            (uri.path in paths || uri.path.matches(Regex("/parada/[a-zA-Z0-9_-]+/?")))) { "Selecciona una página pública de VisitaLoja." }
    }
    fun confirmation(total: Int, text: String, received: Boolean): Boolean =
        total in 1..400 && received && text == "ENVIAR $total"
}
internal data class AdminPushCampaign(val id: String, val title: String, val message: String, val url: String,
    val status: String, val total: Int, val testedAt: Long, val counts: Map<String, Int>) {
    companion object {
        fun read(json: JSONObject): AdminPushCampaign = AdminPushCampaign(json.getString("id"), json.optString("title"),
            json.optString("message"), json.optString("url"), json.optString("status"), json.optInt("total"),
            json.optLong("testedAt"), listOf("accepted", "pending", "skipped", "failed", "uncertain").associateWith {
                json.optJSONObject("counts")?.optInt(it) ?: 0 })
    }
}
internal data class AdminPushDevice(val id: String, val label: String)
internal data class AdminPushState(val uid: String? = null, val busy: Boolean = false, val ready: Boolean = false,
    val campaigns: List<AdminPushCampaign> = emptyList(), val devices: List<AdminPushDevice> = emptyList(),
    val audience: Int = 0, val overLimit: Boolean = false, val selected: AdminPushCampaign? = null,
    val title: String = "", val message: String = "", val url: String = "/", val draftId: String? = null,
    val received: Boolean = false, val deviceId: String = "", val notice: String? = null)

internal class AdminPushViewModel : ViewModel() {
    private val auth = FirebaseAuth.getInstance()
    private val mutable = MutableStateFlow(AdminPushState())
    val state = mutable.asStateFlow()
    private var epoch = 0
    private fun same(uid: String, version: Int) = epoch == version && auth.currentUser?.uid == uid && mutable.value.uid == uid
    private suspend fun request(uid: String, version: Int, action: String, fields: JSONObject = JSONObject()): JSONObject {
        check(same(uid, version)) { "La sesión cambió." }
        val token = auth.currentUser!!.getIdToken(true).await().token ?: error("Inicia sesión.")
        check(same(uid, version)) { "La sesión cambió." }
        val result = withContext(Dispatchers.IO) { NativeApi.post(AdminPushPolicy.ENDPOINT, token, fields.put("action", action)) }
        check(same(uid, version)) { "La sesión cambió." }
        return result
    }
    fun bind(uid: String?) {
        ++epoch
        mutable.value = AdminPushState(uid = uid)
        if (uid != null) refresh()
    }
    private fun operation(work: suspend (String, Int) -> Unit) {
        val old = mutable.value
        val uid = old.uid ?: return
        if (old.busy) return
        val version = epoch
        mutable.value = old.copy(busy = true, notice = null)
        viewModelScope.launch {
            try { work(uid, version) }
            catch (e: CancellationException) { throw e }
            catch (e: Exception) {
                if (same(uid, version)) {
                    val denied = (e as? NativeHttpError)?.status in setOf(401, 403)
                    val base = if (denied) AdminPushState(uid = uid) else mutable.value
                    mutable.value = base.copy(ready = false, received = false,
                        notice = (e as? NativeHttpError)?.message ?: "No se pudo confirmar la operación. Actualiza el historial antes de repetir una prueba o envío.")
                }
            }
            finally { if (same(uid, version)) mutable.value = mutable.value.copy(busy = false) }
        }
    }
    fun refresh() = operation { uid, version ->
        val overview = request(uid, version, "overview")
        val own = request(uid, version, "devices").optJSONArray("devices")
        val history = overview.optJSONArray("campaigns")
        val old = mutable.value
        val selected = old.selected?.let { request(uid, version, "detail", JSONObject().put("campaignId", it.id)) }
        val devices = if (own == null) emptyList() else (0 until own.length()).map { i ->
            val row = own.getJSONObject(i)
            AdminPushDevice(row.getString("id"), row.optString("label", "Dispositivo") + " · " + row.optString("platform"))
        }
        mutable.value = old.copy(ready = true, campaigns = if (history == null) emptyList() else
            (0 until history.length()).map { AdminPushCampaign.read(history.getJSONObject(it)) },
            devices = devices, deviceId = old.deviceId.takeIf { id -> devices.any { it.id == id } } ?: "",
            audience = overview.optInt("devices"), overLimit = overview.optBoolean("overLimit"),
            selected = selected?.let { AdminPushCampaign.read(it) }, received = false, notice = "Historial actualizado. No se ha realizado un envío.")
    }
    fun choose(campaign: AdminPushCampaign) = operation { uid, version ->
        val detail = AdminPushCampaign.read(request(uid, version, "detail", JSONObject().put("campaignId", campaign.id)))
        mutable.value = mutable.value.copy(selected = detail, title = detail.title, message = detail.message, url = detail.url,
            draftId = detail.id, ready = true, received = false)
    }
    fun newDraft() {
        val old = mutable.value
        if (!old.busy && old.ready) mutable.value = old.copy(selected = null, draftId = null, title = "", message = "", url = "/", received = false)
    }
    fun edit(field: String, value: String) {
        val old = mutable.value
        if (old.busy || old.selected != null || old.draftId != null) return
        mutable.value = when (field) {
            "title" -> old.copy(title = value.take(80))
            "message" -> old.copy(message = value.take(240))
            "url" -> old.copy(url = value.take(500))
            else -> old
        }
    }
    fun device(id: String) {
        if (!mutable.value.busy && mutable.value.devices.any { it.id == id }) mutable.value = mutable.value.copy(deviceId = id)
    }
    fun received(value: Boolean) { if (!mutable.value.busy) mutable.value = mutable.value.copy(received = value) }
    fun prepare() {
        val old = mutable.value
        if (!old.ready || old.busy || old.selected != null) return
        try { AdminPushPolicy.validate(old.title, old.message, old.url) }
        catch (_: Exception) { mutable.value = old.copy(notice = "Revisa título, mensaje y destino público de VisitaLoja."); return }
        val id = old.draftId ?: java.util.UUID.randomUUID().toString()
        // Retain the exact ID and payload after an uncertain prepare so it can be recovered idempotently.
        mutable.value = old.copy(draftId = id)
        operation { uid, version ->
            val detail = request(uid, version, "prepare", JSONObject().put("campaignId", id).put("title", old.title.trim())
                .put("message", old.message.trim()).put("url", old.url))
            mutable.value = mutable.value.copy(selected = AdminPushCampaign.read(detail), ready = true, received = false,
                notice = "Aviso preparado. Todavía no se ha enviado al público.")
        }
    }
    fun test() {
        val old = mutable.value
        val campaign = old.selected ?: return
        if (!old.ready || campaign.status != "prepared" || old.devices.none { it.id == old.deviceId }) return
        operation { uid, version ->
            val result = request(uid, version, "test", JSONObject().put("campaignId", campaign.id).put("deviceId", old.deviceId))
            val detail = request(uid, version, "detail", JSONObject().put("campaignId", campaign.id))
            mutable.value = mutable.value.copy(selected = AdminPushCampaign.read(detail), received = false,
                notice = result.optString("message") + " La aceptación de Firebase no confirma la recepción en el teléfono.")
        }
    }
    fun dispatch(confirmation: String) {
        val old = mutable.value
        val campaign = old.selected ?: return
        if (!old.ready || campaign.status !in setOf("prepared", "sending") || campaign.testedAt <= 0 ||
            !AdminPushPolicy.confirmation(campaign.total, confirmation, old.received)) return
        operation { uid, version ->
            val detail = request(uid, version, "dispatch", JSONObject().put("campaignId", campaign.id)
                .put("confirmation", confirmation).put("testReceived", old.received))
            mutable.value = mutable.value.copy(selected = AdminPushCampaign.read(detail), received = false,
                notice = "Lote procesado. Consulta el estado antes de continuar; no se reenvían automáticamente los resultados inciertos.")
        }
    }
}

@Composable
internal fun AdminPushEntry(uid: String) {
    val model: AdminPushViewModel = viewModel(key = "admin-push")
    val observed by model.state.collectAsStateWithLifecycle()
    val state = observed.takeIf { it.uid == uid } ?: AdminPushState(uid)
    var open by remember(uid) { mutableStateOf(false) }
    var confirming by remember(uid) { mutableStateOf(false) }
    var confirmation by remember(uid) { mutableStateOf("") }
    DisposableEffect(uid) { onDispose { model.bind(null) } }
    OutlinedButton(onClick = { open = true; model.bind(uid) }) { Text("Preparar y enviar avisos") }
    if (open) Dialog(onDismissRequest = { if (!state.busy) { open = false; model.bind(null) } },
        properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxSize().systemBarsPadding()) {
            LazyColumn(Modifier.fillMaxSize().imePadding(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                item {
                    Text("Avisos · administración", style = MaterialTheme.typography.headlineSmall)
                    TextButton(onClick = { open = false; model.bind(null) }, enabled = !state.busy) { Text("Cerrar avisos") }
                    if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                    state.notice?.let { Text(it) }
                    OutlinedButton(onClick = model::refresh, enabled = !state.busy) { Text("Actualizar historial y permisos") }
                    Text(if (state.overLimit) "Hay más de 400 dispositivos; el servicio no permite preparar ese envío." else "${state.audience} dispositivos suscritos")
                    OutlinedButton(onClick = model::newDraft, enabled = state.ready && !state.busy) { Text("Nuevo aviso") }
                    val editable = state.ready && !state.busy && state.selected == null && state.draftId == null
                    OutlinedTextField(state.title, { model.edit("title", it) }, label = { Text("Título (hasta 80 caracteres)") }, enabled = editable, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(state.message, { model.edit("message", it) }, label = { Text("Mensaje (hasta 240 caracteres)") }, enabled = editable, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(state.url, { model.edit("url", it) }, label = { Text("Destino, por ejemplo /agenda.html") }, enabled = editable, modifier = Modifier.fillMaxWidth())
                    Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(16.dp)) { Text("Vista previa"); Text(state.title, style = MaterialTheme.typography.titleMedium); Text(state.message); Text(state.url) } }
                    if (state.selected == null) Button(onClick = model::prepare, enabled = state.ready && !state.busy && !state.overLimit) { Text(if (state.draftId == null) "Preparar sin enviar" else "Recuperar aviso preparado") }
                }
                val campaign = state.selected
                if (campaign != null) item {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("Público preparado: ${campaign.total} dispositivos")
                        Text(when (campaign.status) { "prepared" -> "Preparado · sin enviar"; "sending" -> "Envío iniciado · puede continuar"; "completed" -> "Proceso finalizado"; else -> campaign.status })
                        Text("Aceptados: ${campaign.counts["accepted"]} · pendientes: ${campaign.counts["pending"]} · omitidos: ${campaign.counts["skipped"]} · fallidos: ${campaign.counts["failed"]} · inciertos: ${campaign.counts["uncertain"]}")
                        if (campaign.status == "prepared") {
                            Text("Elige un dispositivo propio suscrito para la prueba.")
                            if (state.devices.isEmpty()) Text("Activa primero Avisos con esta misma cuenta en un dispositivo.")
                            state.devices.forEach { device ->
                                FilterChip(state.deviceId == device.id, { model.device(device.id) }, label = { Text(device.label) }, enabled = !state.busy)
                            }
                            OutlinedButton(onClick = model::test, enabled = state.ready && !state.busy && state.deviceId.isNotBlank()) { Text("Enviar prueba solo al dispositivo seleccionado") }
                        }
                        if (campaign.testedAt > 0 && campaign.status in setOf("prepared", "sending")) {
                            Row { Checkbox(state.received, model::received, enabled = !state.busy); Text("Recibí la prueba de este aviso") }
                            Text("Cada confirmación procesa hasta 25 dispositivos pendientes. Se respetan las bajas.")
                            Button(onClick = { confirmation = ""; confirming = true }, enabled = state.ready && !state.busy && state.received) { Text("Revisar envío general") }
                        }
                    }
                }
                item { Text("Historial de los últimos 30 avisos", style = MaterialTheme.typography.titleMedium) }
                items(state.campaigns, key = { it.id }) { campaign ->
                    OutlinedButton(onClick = { model.choose(campaign) }, enabled = !state.busy, modifier = Modifier.fillMaxWidth()) { Text("${campaign.title} · ${campaign.status}") }
                }
            }
        }
    }
    if (open && confirming) state.selected?.let { campaign ->
        AlertDialog(onDismissRequest = { confirming = false }, title = { Text("Confirmar envío general") },
            text = { Column {
                Text("«${campaign.title}» al público preparado de ${campaign.total} dispositivos. Se procesará un lote de hasta 25 pendientes.")
                OutlinedTextField(confirmation, { confirmation = it }, label = { Text("Escribe ENVIAR ${campaign.total}") }, enabled = !state.busy)
            } },
            confirmButton = { TextButton(onClick = { confirming = false; model.dispatch(confirmation) },
                enabled = state.ready && !state.busy && AdminPushPolicy.confirmation(campaign.total, confirmation, state.received)) { Text("Confirmar envío") } },
            dismissButton = { TextButton(onClick = { confirming = false }) { Text("Cancelar") } })
    }
}
