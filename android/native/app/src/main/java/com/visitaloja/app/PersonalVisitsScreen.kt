package com.visitaloja.app

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.repeatOnLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import java.time.Instant
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive

@Composable
internal fun PersonalVisitsScreen(uid: String, directory: PlacesState, back: () -> Unit, visit: (Place) -> Unit, model: PersonalVisitsViewModel = viewModel()) {
    val state by model.state.collectAsStateWithLifecycle()
    var query by rememberSaveable(uid) { mutableStateOf("") }
    var status by rememberSaveable(uid) { mutableStateOf<String?>(null) }
    var period by rememberSaveable(uid) { mutableStateOf("all") }
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    LaunchedEffect(uid) { model.bind(uid) }
    DisposableEffect(model) { onDispose { model.bind(null) } }
    LaunchedEffect(lifecycle) { lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) { while (isActive) { now = System.currentTimeMillis(); delay(30_000) } } }
    val rows = if (state.uid == uid) PersonalVisitsPolicy.filter(state.rows, query, status, period, now) else emptyList()
    fun date(value: Any?): String = timeMillis(value)?.let { DateTimeFormatter.ofPattern("d MMM yyyy · HH:mm", Locale.forLanguageTag("es-EC")).withZone(AgendaPolicy.zone).format(Instant.ofEpochMilli(it)) } ?: "Sin fecha"
    fun money(value: Double) = java.text.NumberFormat.getCurrencyInstance(Locale.forLanguageTag("es-EC")).format(value)
    LazyColumn(contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            TextButton(onClick = back) { Text("← Volver al pasaporte") }
            Text("Mis visitas", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
            Text("Sellados registrados por los negocios. Fechas y horas de Loja, Ecuador.")
            OutlinedTextField(query, { query = it.take(120) }, Modifier.fillMaxWidth(), label = { Text("Buscar negocio o referencia") }, singleLine = true)
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("all" to "Todo el historial", "today" to "Hoy", "week" to "Últimos 7 días").forEach { (key, label) -> FilterChip(period == key, { period = key }, label = { Text(label) }) }
            }
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(null to "Todas", "confirmed" to "Confirmadas", "reversed" to "Anuladas").forEach { (key, label) -> FilterChip(status == key, { status = key }, label = { Text(label) }) }
            }
            TextButton(onClick = { query = ""; status = null; period = "all" }) { Text("Restablecer filtros") }
            OutlinedButton(onClick = { model.bind(uid) }, enabled = !state.busy) { Text("Actualizar historial") }
        }
        if (state.uid == uid) {
            if (state.busy) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
            state.error?.let { error -> item { Text(error, color = MaterialTheme.colorScheme.error); TextButton(onClick = model::load) { Text("Reintentar") } } }
            if (state.loaded) item {
                Text("${rows.size} visitas visibles · ${rows.filter { it.text("status") == "confirmed" }.map { it.text("placeId") }.filter(String::isNotBlank).distinct().size} negocios con visitas confirmadas", fontWeight = FontWeight.Bold)
                Text("Consumo confirmado: ${money(PersonalVisitsPolicy.confirmedSpend(rows))}")
                if (state.more) Text("Resumen parcial de los registros cargados. Carga más para completar tu consulta.", style = MaterialTheme.typography.bodySmall)
            }
            if (state.loaded && rows.isEmpty()) item { Text(if (state.more) "No hay coincidencias entre los registros cargados. Puedes cargar más." else "No hay visitas con estos filtros.") }
            items(rows, key = { it.text("id") }) { row ->
                OutlinedCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                        Text(row.text("placeName").ifBlank { "Parada de VisitaLoja" }, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                        Text(when(row.text("status")) { "confirmed" -> "Visita confirmada"; "reversed" -> "Visita anulada"; else -> "Estado por confirmar" })
                        Text("Sellado: ${date(row["confirmedAt"] ?: row["createdAt"])}")
                        if (row.text("status") == "confirmed") Text("Consumo registrado: ${money(MerchantBusinessPolicy.amount(row["purchaseAmount"]))}")
                        row.text("receiptRef").takeIf { it.isNotBlank() }?.let { Text("Referencia: $it", style = MaterialTheme.typography.bodySmall) }
                        if (row.text("status") == "reversed") {
                            Text("Anulación: ${date(row["reversedAt"])}")
                            row.text("reversalReason").takeIf { it.isNotBlank() }?.let { Text("Motivo: $it") }
                        }
                        directory.places.find { it.id == row.text("placeId") }?.let { place -> TextButton(onClick = { visit(place) }) { Text("Ver mi tarjeta y código de visita") } }
                    }
                }
            }
            if (state.more && state.loaded) item { Button(onClick = model::load, enabled = !state.busy, modifier = Modifier.fillMaxWidth()) { Text("Cargar más visitas") } }
        }
    }
}
