package com.visitaloja.app

import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Event
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.time.format.DateTimeFormatter
import java.util.Locale

private val festivalBlue = Color(0xFF14294D)
private val festivalPink = Color(0xFFF8BDEB)
private val festivalDate = DateTimeFormatter.ofPattern("EEE d MMM", Locale.forLanguageTag("es-EC"))
private val festivalTime = DateTimeFormatter.ofPattern("HH:mm")

@Composable
fun FestivalShortcut(open: () -> Unit, modifier: Modifier = Modifier) {
    Card(onClick = open, modifier = modifier.fillMaxWidth(), shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = festivalBlue, contentColor = Color.White)) {
        Row(Modifier.padding(17.dp), verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Icon(Icons.Default.Event, null, tint = festivalPink)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("FESTIVAL DE ARTES VIVAS", color = festivalPink, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                Text("Programación FIAVL 2026", fontSize = 19.sp, fontWeight = FontWeight.Bold)
                Text("Consulta las actividades por día →", fontSize = 13.sp)
            }
        }
    }
}

@Composable
fun FestivalScreen(state: FestivalState, retry: () -> Unit, account: AccountState,
    toggleSaved: (String) -> Unit, signIn: () -> Unit, openParade: () -> Unit, openMap: () -> Unit) {
    val context = LocalContext.current
    fun open(url: String) {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
            context.startActivity(if (url == FestivalPolicy.PARADE) Intent.createChooser(intent, "Ver recorrido en el navegador").apply {
                putExtra(Intent.EXTRA_EXCLUDE_COMPONENTS, arrayOf(ComponentName(context, MainActivity::class.java)))
            } else intent)
        }
        catch (_: ActivityNotFoundException) {
            Toast.makeText(context, "No hay una aplicación para abrir este enlace.", Toast.LENGTH_SHORT).show()
        }
    }
    var savedOnly by rememberSaveable { mutableStateOf(false) }
    var freeOnly by rememberSaveable { mutableStateOf(false) }
    var upcomingOnly by rememberSaveable { mutableStateOf(false) }
    var category by rememberSaveable { mutableStateOf<String?>(null) }
    var selected by rememberSaveable { mutableStateOf<String?>(null) }
    var query by rememberSaveable { mutableStateOf("") }
    val grouped = remember(state.events) { state.events.groupBy(FestivalEvent::day).toSortedMap() }
    val days = grouped.keys.toList()
    val day = days.find { it.toString() == selected } ?: FestivalPolicy.defaultDay(days, state.now)
    val tokens = remember(query) { PlacePolicy.normalize(query).split(' ').filter(String::isNotBlank) }
    val visible = FestivalFilterPolicy.filter(state.events, day, query, savedOnly,
        if (account.uid != null) account.savedFestivalEvents else emptySet(), freeOnly, upcomingOnly, category, state.now)
    LazyColumn(modifier = Modifier.testTag("festival-agenda"), contentPadding = PaddingValues(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Text("LOJA · ARTES VIVAS", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold, fontSize = 12.sp)
            Text("FIAVL 2026", fontSize = 30.sp, fontWeight = FontWeight.ExtraBold)
            Text("Festival Internacional de Artes Vivas de Loja", color = MaterialTheme.colorScheme.onSurfaceVariant)
            TextButton(onClick = openMap) { Text("Ver eventos en el mapa") }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(!savedOnly, { savedOnly = false }, label = { Text("Programación") })
                FilterChip(savedOnly, { savedOnly = true }, label = { Text("Mi agenda") })
            }
            if (savedOnly && account.uid == null) TextButton(onClick = signIn) { Text("Ingresa para ver tu agenda") }
            else if (savedOnly && !account.favouritesReady) Text("Consultando tu agenda…")
        }
        if (state.loading) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
        if (state.offline) item {
            Text(if (state.events.isEmpty()) "No se pudo cargar la programación." else "Estás viendo una copia guardada. Conéctate para consultar cambios.",
                color = MaterialTheme.colorScheme.onSurfaceVariant)
            TextButton(onClick = retry) { Text("Actualizar programación") }
        }
        if (days.isNotEmpty()) {
            item {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    item { FilterChip(freeOnly, { freeOnly = !freeOnly }, label = { Text("Entrada libre") }) }
                    item { FilterChip(upcomingOnly, { upcomingOnly = !upcomingOnly }, label = { Text("Por comenzar") }) }
                }
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    item { FilterChip(category == null, { category = null }, label = { Text("Todas las categorías") }) }
                    items(state.events.map { it.category }.distinct().sorted()) { choice ->
                        FilterChip(category == choice, { category = choice }, label = { Text(choice) })
                    }
                }
            }
            item {
                OutlinedTextField(query, { query = it }, Modifier.fillMaxWidth(), singleLine = true,
                    label = { Text(if (savedOnly) "Buscar en Mi agenda" else "Buscar en todo el festival") },
                    trailingIcon = { if (query.isNotEmpty()) TextButton(onClick = { query = "" }) { Text("Borrar") } })
            }
            if (tokens.isEmpty() && !savedOnly) {
                item {
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(days) { date ->
                            FilterChip(selected = date == day, onClick = { selected = date.toString() },
                                label = { Text("${date.format(festivalDate)} · ${grouped[date].orEmpty().size}") })
                        }
                    }
                }
            }
            item {
                Text(if (visible.size == 1) "1 actividad" else "${visible.size} actividades",
                    fontWeight = FontWeight.Bold)
                if (visible.isEmpty()) {
                    Text("No hay actividades con estos filtros.")
                    TextButton(onClick = { query = ""; freeOnly = false; upcomingOnly = false; category = null }) { Text("Restablecer filtros") }
                }
            }
        }
        if (savedOnly && account.uid != null && account.favouritesReady && visible.isEmpty() && !state.loading)
            item { Text(if (account.savedFestivalEvents.isEmpty()) "Todavía no tienes actividades guardadas del festival." else "Prueba otros filtros para ver tus actividades guardadas.") }
        items(visible, key = FestivalEvent::id) { event ->
            OutlinedCard(modifier = Modifier.fillMaxWidth().testTag("festival-event"), shape = RoundedCornerShape(18.dp)) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(event.category, fontWeight = FontWeight.Bold, fontSize = 12.sp, color = MaterialTheme.colorScheme.primary)
                    Text(event.title, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                    Text("${event.day.format(festivalDate)} · ${event.time.format(festivalTime)}", fontWeight = FontWeight.SemiBold)
                    Text(event.place.ifBlank { "Ubicación pendiente" })
                    Text(event.status(state.now)?.let { "$it · " }.orEmpty() +
                        if (event.free) "Entrada libre" else "Consultar acceso",
                        fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    if (event.description.isNotBlank()) Text(event.description, fontSize = 14.sp)
                    val saved = event.id in account.savedFestivalEvents
                    TextButton(enabled = account.uid == null || !account.busy,
                        onClick = { if (account.uid == null) signIn() else toggleSaved(event.id) }) {
                        Text(if (saved) "Quitar de Mi agenda" else "Guardar en Mi agenda")
                    }
                    Column {
                        TextButton(onClick = { EventActions.calendar(context, event.title, event.description + "\n" + FestivalPolicy.PROGRAM, event.place, event.start, event.durationMinutes) }) { Text("Añadir al calendario") }
                        TextButton(onClick = { EventActions.share(context, event.title, event.start, event.place, FestivalPolicy.PROGRAM) }) { Text("Compartir") }
                    }
                    when {
                        event.mapUrl != null -> TextButton(onClick = { open(event.mapUrl) }) {
                            Text(if (event.precision.startsWith("referencia", true)) "Ver ubicación aproximada" else "Cómo llegar")
                        }
                        event.route -> TextButton(onClick = { if (event.routePoints.isNotEmpty()) openParade() else open(FestivalPolicy.PARADE) }) { Text("Ver recorrido del desfile") }
                        event.place.isNotBlank() -> Text("Ubicación en el mapa pendiente", fontSize = 12.sp)
                    }
                }
            }
        }
        item { Text("Horarios de Loja, Ecuador. La programación puede cambiar.", fontSize = 12.sp) }
    }
}
