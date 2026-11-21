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
internal fun AdminPassportRewardsEntry(uid: String) {
    val model: AdminPassportRewardsViewModel = viewModel(key = "admin-passport-rewards")
    val observed by model.state.collectAsStateWithLifecycle(); val state = observed.takeIf { it.uid == uid } ?: PassportRewardState()
    var open by remember(uid) { mutableStateOf(false) }; var mode by remember(uid) { mutableStateOf("tourist") }
    var selected by remember(uid) { mutableStateOf("primary") }; var discard by remember(uid) { mutableStateOf(false) }
    var reload by remember(uid) { mutableStateOf(false) }; var review by remember(uid) { mutableStateOf(false) }
    var drafts by remember(uid) { mutableStateOf(false) }; var preview by remember(uid) { mutableStateOf(false) }
    var remove by remember(uid) { mutableStateOf(false) }; var merchants by remember(uid) { mutableStateOf(false) }
    var query by remember(uid) { mutableStateOf("") }
    val dirty = state.draft != state.initial
    DisposableEffect(uid) { onDispose { model.bind(null) } }
    fun close() { if (state.busy) return; if (dirty) discard = true else { open = false; model.bind(null) } }
    val current = state.draft[mode]
    val id = selected.takeIf { it == "primary" || current?.choices?.containsKey(it) == true } ?: "primary"
    val row = if (id == "primary") current?.primary else current?.choices?.get(id)
    OutlinedButton(onClick = { open = true; model.bind(uid) }) { Text("Administrar premios del pasaporte") }
    if (open) Dialog(onDismissRequest = ::close, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxSize().systemBarsPadding()) { LazyColumn(Modifier.fillMaxSize().imePadding(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item {
                Text("Premios del pasaporte", style = MaterialTheme.typography.headlineSmall)
                TextButton(onClick = ::close, enabled = !state.busy) { Text("Cerrar") }
                if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                state.message?.let { Text(it) }
                Text("Campaña: " + state.base?.text("campaignId").orEmpty())
                Text("Configura el premio principal y hasta nueve alternativas por modalidad. El visitante elige una recompensa y recibe un único código por campaña y modalidad. Estos cambios se comparten con la web.")
                Text("El nombre, periodo y activación general se gestionan en Configuración de pasaporte. Este editor conserva el ID de campaña y los registros de sellos y canjes.")
                OutlinedButton(onClick = { if (dirty) reload = true else model.bind(uid) }, enabled = !state.busy) { Text("Actualizar campaña, negocios y permisos") }
                OutlinedButton(onClick = { model.local("list"); drafts = true }, enabled = state.ready && !state.busy) { Text("Recuperar borrador de este teléfono") }
            }
            if (state.ready && current != null && row != null) {
                item {
                    Row { AdminPassportRewardPolicy.modes.forEach { (key, label) -> FilterChip(mode == key, { mode = key; selected = "primary" }, label = { Text(label) }, enabled = !state.busy) } }
                    Text(if (mode == "tourist") "Turista: una parada de hospedaje y cinco gastronómicas distintas." else "Lojano: seis paradas gastronómicas distintas.")
                    Text("Elegir premio para editar", style = MaterialTheme.typography.titleMedium)
                    OutlinedButton(onClick = { selected = "primary" }, enabled = !state.busy) { Text("Principal · " + current.primary["title"].orEmpty()) }
                }
                items(current.choices.entries.toList(), key = { it.key }) { choice ->
                    OutlinedButton(onClick = { selected = choice.key }, enabled = !state.busy, modifier = Modifier.fillMaxWidth()) { Text(choice.value["title"].orEmpty().ifBlank { "Alternativa sin nombre" } + if (choice.value["active"] == "false") " · oculta" else "") }
                }
                item {
                    OutlinedButton(onClick = { model.add(mode) }, enabled = !state.busy && current.choices.size < 9) { Text("Añadir alternativa") }
                    Text(if (id == "primary") "Editar premio principal" else "Editar alternativa", style = MaterialTheme.typography.titleLarge)
                    Row { Checkbox(row["active"] == "true", { model.edit(mode, id, "active", it.toString()) }, enabled = !state.busy); Text(if (id == "primary") "Ofrecer premios en esta modalidad" else "Ofrecer esta alternativa") }
                    if (id == "primary") Text("La visibilidad del principal también controla la modalidad completa, igual que en la web. Si lo desactivas, tampoco se podrán solicitar sus alternativas.")
                }
                items(AdminPassportRewardPolicy.fields.entries.filter { id == "primary" || it.key in setOf("title", "description") }, key = { it.key }) { field ->
                    OutlinedTextField(row[field.key].orEmpty(), { model.edit(mode, id, field.key, it.take(field.value.second)) }, label = { Text(field.value.first) }, enabled = !state.busy, modifier = Modifier.fillMaxWidth())
                }
                item {
                    val recipient = row["merchantUid"].orEmpty(); val merchant = state.merchants[recipient]
                    Text("Negocio de entrega: " + if (recipient.isBlank()) "Sin negocio asignado" else merchant?.text("businessName")?.ifBlank { recipient } ?: "No disponible · $recipient")
                    OutlinedButton(onClick = { query = ""; merchants = true }, enabled = !state.busy) { Text("Elegir negocio autorizado") }
                    TextButton(onClick = { model.edit(mode, id, "merchantUid", "") }, enabled = !state.busy && recipient.isNotBlank()) { Text("Quitar asignación de este premio") }
                    Text("Solo se muestran cuentas de negocios de canje ya registradas y activas. Esta selección no crea usuarios ni les otorga administración general.")
                    if (id != "primary") TextButton(onClick = { remove = true }, enabled = !state.busy) { Text("Retirar esta alternativa") }
                    OutlinedButton(onClick = { preview = true }, enabled = !state.busy) { Text("Ver premios preparados") }
                    OutlinedButton(onClick = { model.local("save") }, enabled = !state.busy) { Text("Guardar borrador local") }
                    Button(onClick = { review = true }, enabled = !state.busy && dirty) { Text("Revisar y publicar premios y permisos") }
                }
            }
        } }
    }
    if (merchants) Dialog(onDismissRequest = { merchants = false }) {
        Surface { LazyColumn(Modifier.fillMaxHeight(.85f).padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item { Text("Negocio que entrega", style = MaterialTheme.typography.titleLarge); OutlinedTextField(query, { query = it.take(150) }, label = { Text("Buscar negocio") }); TextButton(onClick = { merchants = false }) { Text("Volver") } }
            val matches = state.merchants.entries.filter { it.value["active"] == true && PlacePolicy.normalize(it.value.text("businessName") + " " + it.key).contains(PlacePolicy.normalize(query)) }
            if (matches.isEmpty()) item { Text("No hay negocios de canje activos que coincidan. Las cuentas se gestionan por separado.") }
            items(matches, key = { it.key }) { merchant -> OutlinedButton(onClick = { model.edit(mode, id, "merchantUid", merchant.key); merchants = false }, enabled = !state.busy) { Text(merchant.value.text("businessName").ifBlank { merchant.key }) } }
        } }
    }
    if (preview) Dialog(onDismissRequest = { preview = false }) {
        Surface { LazyColumn(Modifier.fillMaxHeight(.85f).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item { Text("Vista previa sin publicar", style = MaterialTheme.typography.titleLarge); TextButton(onClick = { preview = false }) { Text("Volver") } }
            state.draft.forEach { (key, value) ->
                item { Text(AdminPassportRewardPolicy.modes[key].orEmpty(), style = MaterialTheme.typography.titleLarge); Text(if (value.primary["active"] == "true") "Modalidad habilitada" else "Modalidad oculta") }
                val entries = listOf("primary" to value.primary) + value.choices.toList()
                items(entries, key = { key + "|" + it.first }) { (choiceId, reward) ->
                    OutlinedCard { Column(Modifier.padding(12.dp)) {
                        Text(reward["title"].orEmpty().ifBlank { "Sin nombre" }, style = MaterialTheme.typography.titleMedium)
                        Text(reward["description"].orEmpty()); Text(if (reward["active"] == "true") "Ofrecido" else "Oculto")
                        Text("Entrega: " + state.merchants[reward["merchantUid"]]?.text("businessName").orEmpty().ifBlank { if (choiceId == "primary") reward["url"].orEmpty().ifBlank { "Sin configurar" } else "Sin negocio asignado" })
                        if (choiceId == "primary") DiscoveryPolicy.media(reward["imageUrl"].orEmpty())?.let { AsyncImage(it, reward["title"], Modifier.fillMaxWidth().height(150.dp), contentScale = ContentScale.Fit) }
                    } }
                }
            }
            item { Text("La oferta final también depende de la activación y fechas de la campaña. Esta muestra no emite códigos.") }
        } }
    }
    if (drafts) AdminDraftPicker(state.localDrafts, state.busy, state.message, { drafts = false }, { drafts = false; model.local("restore") }, { model.local("delete") })
    if (remove) AlertDialog(onDismissRequest = { remove = false }, title = { Text("Retirar alternativa del borrador") }, text = { Text("Dejará de ofrecerse al publicar. Los códigos y registros ya emitidos no se eliminan.") }, confirmButton = { TextButton(onClick = { model.remove(mode, id); selected = "primary"; remove = false }) { Text("Retirar alternativa") } }, dismissButton = { TextButton(onClick = { remove = false }) { Text("Conservar") } })
    if (review) AlertDialog(onDismissRequest = { review = false }, title = { Text("Publicar premios y permisos de entrega") }, text = { Text("Se guardarán los premios de ambas modalidades y se actualizarán juntos los permisos de canje de la campaña actual. Se retirarán las asignaciones que ya no correspondan; los permisos de otras campañas se conservan. Revisa los negocios antes de confirmar. No se borran códigos ni canjes anteriores.") }, confirmButton = { TextButton(onClick = { review = false; model.save() }) { Text("Confirmar publicación") } }, dismissButton = { TextButton(onClick = { review = false }) { Text("Seguir revisando") } })
    if (discard || reload) AlertDialog(onDismissRequest = { discard = false; reload = false }, title = { Text("Descartar cambios del formulario") }, text = { Text("Los premios publicados y los borradores locales que guardaste se conservan.") }, confirmButton = { TextButton(onClick = { if (reload) model.bind(uid) else { open = false; model.bind(null) }; discard = false; reload = false }) { Text("Descartar") } }, dismissButton = { TextButton(onClick = { discard = false; reload = false }) { Text("Conservar formulario") } })
}
