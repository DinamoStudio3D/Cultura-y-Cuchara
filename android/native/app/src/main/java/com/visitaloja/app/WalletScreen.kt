package com.visitaloja.app

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import java.time.Instant
import java.time.ZoneId
import kotlinx.coroutines.delay

@Composable
fun WalletScreen(account: AccountState, state: WalletState, directory: PlacesState, login: () -> Unit, retry: () -> Unit, visit: (Place) -> Unit, claim: PassportClaimViewModel) {
    var section by rememberSaveable(account.uid) { mutableStateOf("passport") }
    var rewardQuery by rememberSaveable(account.uid) { mutableStateOf("") }
    var rewardType by rememberSaveable(account.uid) { mutableStateOf("all") }
    var rewardFilter by rememberSaveable(account.uid) { mutableStateOf("all") }
    var chosenMode by rememberSaveable(account.uid) { mutableStateOf<String?>(null) }
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) { while (true) { delay(1000); now = System.currentTimeMillis() } }
    val mode = chosenMode ?: state.mode
    val links = LocalUriHandler.current
    val claimState by claim.state.collectAsStateWithLifecycle()
    var selectedOption by rememberSaveable(account.uid, mode, state.config.text("campaignId")) { mutableStateOf("") }
    var confirmingClaim by remember(account.uid, mode, state.config.text("campaignId")) { mutableStateOf(false) }
    if (section == "visits" && account.uid != null) {
        PersonalVisitsScreen(account.uid, directory, { section = "passport" }, visit)
        return
    }
    LazyColumn(contentPadding = PaddingValues(22.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item {
            Text("CADA VISITA, UNA HISTORIA", color = MaterialTheme.colorScheme.primary, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            Text("Tu recorrido en Loja", fontSize = 29.sp, fontWeight = FontWeight.ExtraBold, modifier = Modifier.padding(top = 8.dp))
            Text("Tu pasaporte y las tarjetas de tus lugares favoritos.", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp))
        }
        if (account.uid == null) {
            item { WalletPanel("Todo tu recorrido, en una cuenta", "Ingresa con la misma cuenta de la web para consultar tus sellos, tarjetas y recompensas.") { Button(onClick = login) { Text("Ingresar en Mi cuenta") } } }
            return@LazyColumn
        }
        item { Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            FilterChip(section == "passport", { section = "passport" }, label = { Text("Pasaporte") }, leadingIcon = { Icon(Icons.Default.MenuBook, null, Modifier.size(18.dp)) })
            FilterChip(section == "cards", { section = "cards" }, label = { Text("Mis tarjetas") }, leadingIcon = { Icon(Icons.Default.CreditCard, null, Modifier.size(18.dp)) })
            FilterChip(section == "visits", { section = "visits" }, label = { Text("Mis visitas") }, leadingIcon = { Icon(Icons.Default.History, null, Modifier.size(18.dp)) })
            FilterChip(section == "rewards", { section = "rewards" }, label = { Text("Mis premios") }, leadingIcon = { Icon(Icons.Default.Redeem, null, Modifier.size(18.dp)) })
        } }
        if (state.uid != account.uid) { item { LinearProgressIndicator(Modifier.fillMaxWidth()) }; return@LazyColumn }
        if (state.errors.isNotEmpty()) item { WalletPanel("No pudimos consultar parte de tu recorrido", "Comprueba la conexión y vuelve a intentar. Tus datos guardados se conservan.") { TextButton(onClick = retry) { Text("Reintentar consulta") } } }
        if (state.cached.isNotEmpty() || directory.offline) item { Text("Mostrando información guardada. Conéctate y actualiza antes de utilizar una recompensa.", color = MaterialTheme.colorScheme.error, fontSize = 12.sp) }
        if (section == "rewards") {
            val loaded = state.ready.containsAll(setOf("rewards", "completions"))
            val allRewards = state.rewards.map { WalletReward(it, false) } + state.completions.map { WalletReward(it, true) }
            val visibleRewards = WalletRewardPolicy.filter(allRewards, rewardQuery, rewardType, rewardFilter, now)
            item {
                Text("Mis premios", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                Text("Fidelidad y pasaporte en un solo lugar. Los premios pendientes aparecen primero, por fecha de vencimiento.", style = MaterialTheme.typography.bodySmall)
                OutlinedTextField(rewardQuery, { rewardQuery = it.take(120) }, label = { Text("Buscar premio o negocio") }, modifier = Modifier.fillMaxWidth(), singleLine = true,
                    trailingIcon = { if (rewardQuery.isNotBlank()) IconButton(onClick = { rewardQuery = "" }) { Icon(Icons.Default.Close, "Borrar búsqueda") } })
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("all" to "Todos", "loyalty" to "Fidelidad", "passport" to "Pasaporte").forEach { (key, label) ->
                        FilterChip(rewardType == key, { rewardType = key }, label = { Text(label) })
                    }
                }
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("all" to "Todos", "pending" to "Pendientes", "delivered" to "Entregados", "expired" to "Vencidos", "unavailable" to "No disponibles").forEach { (key, label) ->
                        FilterChip(rewardFilter == key, { rewardFilter = key }, label = { Text(label) })
                    }
                }
                Text("${visibleRewards.size} premios visibles", style = MaterialTheme.typography.bodySmall)
            }
            if (!loaded) item { LinearProgressIndicator(Modifier.fillMaxWidth()); Text("Consultando tus recompensas…") }
            if (loaded && visibleRewards.isEmpty()) item {
                WalletPanel("No hay premios con estos filtros", if (allRewards.isEmpty()) "Tus recompensas aparecerán al completar las metas de fidelidad o registrar un premio de pasaporte." else "Prueba con otro estado o negocio.") {
                    TextButton(onClick = { rewardQuery = ""; rewardType = "all"; rewardFilter = "all" }) { Text("Ver todos los premios") }
                }
            }
            items(visibleRewards, key = { it.key }) { reward ->
                RewardPanel(reward.row, now, reward.passport, allowCode = if (reward.passport) "completions" !in state.cached && "completions" in state.ready else "rewards" !in state.cached && "rewards" in state.ready)
            }
        } else if (section == "passport") {
            item { Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                FilterChip(mode == "turista", { chosenMode = "turista" }, label = { Text("Vista turista") })
                FilterChip(mode == "lojano", { chosenMode = "lojano" }, label = { Text("Vista lojano") })
            }; Text("Cambiar esta vista no modifica el modo guardado en tu cuenta.", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            if (!state.ready.containsAll(setOf("campaign", "stamps")) || directory.loading && directory.places.isEmpty()) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
            else if (!state.campaignExists) item { WalletPanel("Pasaporte no disponible", "Todavía no hay una campaña publicada para consultar.") }
            else if (directory.error != null && directory.places.isEmpty()) item { WalletPanel("No pudimos consultar las paradas", "Actualiza los lugares desde el botón de la parte superior para calcular tu recorrido.") }
            else {
                val passport = WalletPolicy.passport(state.config, state.stamps, directory.places, mode, now)
                item { WalletPanel(passport.title, if (mode == "turista") "Tu meta: 1 hotel y 5 paradas gastronómicas distintas." else "Tu meta: 6 paradas gastronómicas distintas.") {
                    Text("${passport.count} de 6 sellos", fontSize = 26.sp, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.primary)
                    LinearProgressIndicator(progress = { passport.count / 6f }, modifier = Modifier.fillMaxWidth())
                    Text(if (passport.active) "Campaña vigente" else "Campaña fuera de vigencia", fontSize = 12.sp)
                    if (passport.description.isNotBlank()) Text(passport.description, fontSize = 13.sp)
                } }
                items(passport.slots.indices.toList(), key = { "slot$it" }) { i ->
                    val place = passport.slots[i]
                    OutlinedCard(shape = RoundedCornerShape(16.dp)) { Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                        Icon(if (place != null) Icons.Default.Verified else if (mode == "turista" && i == 0) Icons.Default.Hotel else Icons.Default.Restaurant, null, tint = MaterialTheme.colorScheme.primary)
                        Column { Text(place?.title ?: if (mode == "turista" && i == 0) "Tu próxima estancia" else "Tu próxima parada gastronómica", fontWeight = FontWeight.Bold)
                            Text(if (place != null) "Visita confirmada" else "Sello pendiente", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                    } }
                }
                item { Text("Cada parada aporta un solo sello al pasaporte. Las visitas repetidas pueden seguir sumando en su tarjeta de fidelidad.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                if (passport.active) items(passport.rewards) { reward -> WalletPanel("Recompensa · ${reward.first}", reward.second) }
                if ("completions" in state.ready) items(state.completions.filter { it.text("campaignId") == passport.campaignId && it.text("mode") == mode }, key = { "passportReward${it.text("id")}" }) { reward ->
                    RewardPanel(reward, now, passport = true, allowCode = state.cached.isEmpty())
                }
                if (passport.count == 6 && passport.active) item {
                    val benefit = state.config.map(if (mode == "turista") "tourist" else "local")
                    val existing = state.completions.any { it.text("campaignId") == passport.campaignId && it.text("mode") == mode }
                    val choices = benefit.map("choices").entries.mapNotNull { (id, raw) ->
                        val reward = raw as? Map<*, *> ?: return@mapNotNull null
                        if (reward["active"] != true) null else id to (reward["title"] as? String ?: "Recompensa")
                    }
                    if (!existing && benefit["active"] != false) {
                        WalletPanel("Elige tu recompensa", "El sistema verificará tus visitas y registrará una sola recompensa para esta campaña y modalidad.") {
                            if (benefit["choices"] is Map<*, *>) {
                                choices.forEach { (id, title) -> FilterChip(selected = selectedOption == id, onClick = { selectedOption = id }, enabled = !claimState.busy, label = { Text(title) }) }
                                if (choices.isEmpty()) Text("No hay opciones de recompensa activas en este momento.")
                            }
                            if (!account.profileComplete) Button(onClick = login) { Text("Completar mi perfil") }
                            else Button(onClick = { confirmingClaim = true }, enabled = account.profileReady && !claimState.busy && claimState.uid == account.uid && state.ready.contains("completions") && state.cached.isEmpty() && (benefit["choices"] !is Map<*, *> || choices.any { it.first == selectedOption })) { Text("Solicitar mi recompensa") }
                        }
                    }
                    if (claimState.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                    if (claimState.uid == account.uid) claimState.message?.let { Text(it, fontSize = 13.sp, fontWeight = FontWeight.Bold) }
                }
            }
        } else {
            if (!state.ready.containsAll(setOf("programs", "counters")) || directory.loading && directory.places.isEmpty()) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
            else if (directory.error != null && directory.places.isEmpty()) item { WalletPanel("No pudimos consultar las paradas", "Actualiza los lugares para ver tus tarjetas.") }
            else {
                val today = Instant.ofEpochMilli(now).atZone(ZoneId.of("America/Guayaquil")).toLocalDate().toString()
                val cards = WalletPolicy.cards(state.programs, state.counters, directory.places, now, today)
                if (cards.isEmpty()) item { WalletPanel("Aquí comienza tu próxima recompensa", "No encontramos tarjetas activas para mostrar. Los negocios participantes y tus visitas aparecerán aquí.") }
                items(cards, key = LoyaltyCard::id) { card -> WalletPanel(card.placeName, "${card.title} · ${card.state}") {
                    Text("${card.progress} / ${card.target} sellos", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                    LinearProgressIndicator(progress = { card.progress.toFloat() / card.target }, modifier = Modifier.fillMaxWidth())
                    Text(card.reward, fontWeight = FontWeight.Bold)
                    if (card.description.isNotBlank()) Text(card.description, fontSize = 13.sp)
                    Text("${card.visits} visitas registradas en esta tarjeta", fontSize = 12.sp)
                    val place = directory.places.find { it.id == card.placeId }
                    if (place != null && card.state in setOf("Activa", "Temporada activa")) Button(onClick = { visit(place) }, enabled = !card.dailyBlocked, modifier = Modifier.fillMaxWidth()) { Text("Generar código de visita") }
                    if (card.dailyBlocked && card.state in setOf("Activa", "Temporada activa")) Text("Regresa mañana para volver a sellar tu tarjeta de fidelidad.", fontSize = 12.sp, color = MaterialTheme.colorScheme.primary)
                } }
            }
            if ("rewards" in state.ready) items(state.rewards, key = { "loyaltyReward${it.text("id")}" }) { reward -> RewardPanel(reward, now, allowCode = "rewards" !in state.cached) }
        }
        item { WalletPanel("Tu recorrido, en la app", "Abre una tarjeta o la ficha de una parada para generar tu código de visita. El negocio confirma los sellos. Al completar un ciclo de fidelidad, la recompensa registrada aparecerá aquí con su código de canje.") {
            TextButton(onClick = retry) { Text("Actualizar mi recorrido") }
        } }
    }
    if (confirmingClaim) AlertDialog(onDismissRequest = { confirmingClaim = false }, title = { Text("¿Registrar esta recompensa?") },
        text = { val benefit = state.config.map(if (mode == "turista") "tourist" else "local"); val title = benefit.map("choices").map(selectedOption).text("title").ifBlank { benefit.text("title") }; Text("Elegiste: $title. Tu elección quedará asociada a esta campaña y modalidad. Si ya registraste un premio, se conservará el existente. El encargado validará el código para entregártelo.") },
        confirmButton = { TextButton(onClick = { confirmingClaim = false; claim.claim(state.config.text("campaignId").ifBlank { "pasaporte-2026" }, mode, selectedOption) }) { Text("Confirmar solicitud") } },
        dismissButton = { TextButton(onClick = { confirmingClaim = false }) { Text("Cancelar") } })

}

@Composable
private fun WalletPanel(title: String, description: String, content: @Composable ColumnScope.() -> Unit = {}) {
    OutlinedCard(shape = RoundedCornerShape(22.dp), colors = CardDefaults.outlinedCardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(title, fontSize = 18.sp, fontWeight = FontWeight.Bold)
            if (description.isNotBlank()) Text(description, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            content()
        }
    }
}

@Composable
private fun RewardPanel(reward: Map<String, Any?>, now: Long, passport: Boolean = false, allowCode: Boolean) {
    val clipboard = LocalClipboardManager.current
    var copied by remember(reward.text("id")) { mutableStateOf(false) }
    val entry = WalletReward(reward, passport)
    val status = WalletRewardPolicy.status(entry, now)
    val label = WalletRewardPolicy.label(status)
    val title = entry.title
    var showQr by remember(reward.text("id")) { mutableStateOf(false) }
    val usable = status == "pending" && allowCode && reward.text("claimCode").isNotBlank()
    WalletPanel(title, (if (passport) "Pasaporte" else "Fidelidad") + " · " + (reward.text("placeName").takeIf { it.isNotBlank() }?.plus(" · ") ?: "") + label) {
        fun date(value: Any?): String? = timeMillis(value)?.let { java.time.format.DateTimeFormatter.ofPattern("d MMM yyyy · HH:mm", java.util.Locale.forLanguageTag("es-EC")).withZone(ZoneId.of("America/Guayaquil")).format(Instant.ofEpochMilli(it)) }
        (date(reward["createdAt"]) ?: date(reward["completedAt"]))?.let { Text("Registrado: $it", fontSize = 12.sp) }
        reward.text("rewardDescription").ifBlank { reward.map("rewardSnapshot").text("description") }.takeIf { it.isNotBlank() }?.let { Text(it, fontSize = 13.sp) }
        date(reward["expiresAt"])?.let { Text("Vence: $it (hora de Ecuador)", fontSize = 12.sp) }
        if (status == "delivered") date(reward["deliveredAt"])?.let { Text("Entregado: $it", fontSize = 12.sp) }
        if (passport) reward.text("mode").takeIf { it in setOf("turista", "lojano") }?.let { Text("Modalidad: $it", fontSize = 12.sp) }
        if (status == "pending" && !allowCode) Text("Conéctate y actualiza para mostrar el código de canje.", fontSize = 12.sp)
        if (usable) {
            Text(reward.text("claimCode"), fontSize = 24.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
            Button(onClick = { showQr = true }) { Text("Mostrar QR para canjear") }
            TextButton(onClick = { clipboard.setText(AnnotatedString(reward.text("claimCode"))); copied = true }) { Text(if (copied) "Código copiado" else "Copiar código") }
            Text("Código ya registrado. Presentarlo no confirma su entrega; el encargado debe validarlo.", fontSize = 12.sp)
        }
    }
    if (showQr && usable) RewardQrDialog(reward.text("claimCode")) { showQr = false }
}
