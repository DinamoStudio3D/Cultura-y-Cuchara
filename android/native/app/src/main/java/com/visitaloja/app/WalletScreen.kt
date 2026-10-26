package com.visitaloja.app

import androidx.compose.foundation.layout.*
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.time.Instant
import java.time.ZoneId
import kotlinx.coroutines.delay

@Composable
fun WalletScreen(account: AccountState, state: WalletState, directory: PlacesState, login: () -> Unit, retry: () -> Unit) {
    var section by rememberSaveable(account.uid) { mutableStateOf("passport") }
    var chosenMode by rememberSaveable(account.uid) { mutableStateOf<String?>(null) }
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) { while (true) { delay(30000); now = System.currentTimeMillis() } }
    val mode = chosenMode ?: state.mode
    val links = LocalUriHandler.current
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
        item { Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            FilterChip(section == "passport", { section = "passport" }, label = { Text("Pasaporte") }, leadingIcon = { Icon(Icons.Default.MenuBook, null, Modifier.size(18.dp)) })
            FilterChip(section == "cards", { section = "cards" }, label = { Text("Mis tarjetas") }, leadingIcon = { Icon(Icons.Default.CreditCard, null, Modifier.size(18.dp)) })
        } }
        if (state.uid != account.uid) { item { LinearProgressIndicator(Modifier.fillMaxWidth()) }; return@LazyColumn }
        if (state.errors.isNotEmpty()) item { WalletPanel("No pudimos consultar parte de tu recorrido", "Comprueba la conexión y vuelve a intentar. Tus datos guardados se conservan.") { TextButton(onClick = retry) { Text("Reintentar consulta") } } }
        if (state.cached.isNotEmpty() || directory.offline) item { Text("Mostrando información guardada. Conéctate y actualiza antes de utilizar una recompensa.", color = MaterialTheme.colorScheme.error, fontSize = 12.sp) }
        if (section == "passport") {
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
                if (passport.count == 6) item { Text("Completaste los seis espacios. La disponibilidad y el canje se validan al solicitar la recompensa.", fontSize = 13.sp, fontWeight = FontWeight.Bold) }
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
                    if (card.dailyBlocked && card.state in setOf("Activa", "Temporada activa")) Text("Regresa mañana para volver a sellar tu tarjeta de fidelidad.", fontSize = 12.sp, color = MaterialTheme.colorScheme.primary)
                } }
            }
            if ("rewards" in state.ready) items(state.rewards, key = { "loyaltyReward${it.text("id")}" }) { reward -> RewardPanel(reward, now, allowCode = "rewards" !in state.cached) }
        }
        item { WalletPanel("Tus visitas se actualizan aquí", "Los sellos se registran cuando el negocio confirma tu visita. Para generar un nuevo código de visita o solicitar una recompensa, utiliza por ahora la web.") {
            OutlinedButton(onClick = { links.openUri(if (section == "cards") "https://www.visitaloja.com/fidelidad.html" else "https://www.visitaloja.com/#pasaporte") }) { Text("Continuar en la web") }
            TextButton(onClick = retry) { Text("Actualizar mi recorrido") }
        } }
    }
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
    val expired = timeMillis(reward["expiresAt"])?.let { it <= now } ?: !passport
    val status = reward.text("status")
    val label = when { status == "delivered" -> "Entregada"; status != "pending" -> "No disponible"; expired -> "Vencida"; else -> "Pendiente de canje" }
    val title = reward.text("rewardTitle").ifBlank { reward.map("rewardSnapshot").text("title").ifBlank { "Tu recompensa" } }
    WalletPanel(title, (reward.text("placeName").takeIf { it.isNotBlank() }?.plus(" · ") ?: "") + label) {
        if (status == "pending" && !expired && allowCode && reward.text("claimCode").isNotBlank()) {
            Text(reward.text("claimCode"), fontSize = 24.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
            Text("Código ya registrado. Presentarlo no confirma su entrega; el encargado debe validarlo.", fontSize = 12.sp)
        }
    }
}
