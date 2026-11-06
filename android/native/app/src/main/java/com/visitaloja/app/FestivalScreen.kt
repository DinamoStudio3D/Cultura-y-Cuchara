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
fun FestivalScreen(state: FestivalState, retry: () -> Unit, openMap: () -> Unit) {
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
    var selected by rememberSaveable { mutableStateOf<String?>(null) }
    var query by rememberSaveable { mutableStateOf("") }
    val grouped = remember(state.events) { state.events.groupBy(FestivalEvent::day).toSortedMap() }
    val days = grouped.keys.toList()
    val day = days.find { it.toString() == selected } ?: FestivalPolicy.defaultDay(days, state.now)
    val tokens = remember(query) { PlacePolicy.normalize(query).split(' ').filter(String::isNotBlank) }
    val visible = remember(state.events, day, tokens) {
        if (tokens.isEmpty()) FestivalPolicy.forDay(grouped, day)
        else state.events.filter { event ->
            val searchable = PlacePolicy.normalize("${event.title} ${event.category} ${event.place}")
            tokens.all { it in searchable }
        }
    }
    LazyColumn(modifier = Modifier.testTag("festival-agenda"), contentPadding = PaddingValues(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Text("LOJA · ARTES VIVAS", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold, fontSize = 12.sp)
            Text("FIAVL 2026", fontSize = 30.sp, fontWeight = FontWeight.ExtraBold)
            Text("Festival Internacional de Artes Vivas de Loja", color = MaterialTheme.colorScheme.onSurfaceVariant)
            TextButton(onClick = openMap) { Text("Ver eventos en el mapa") }
        }
        if (state.loading) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
        if (state.offline) item {
            Text(if (state.events.isEmpty()) "No se pudo cargar la programación." else "Estás viendo una copia guardada. Conéctate para consultar cambios.",
                color = MaterialTheme.colorScheme.onSurfaceVariant)
            TextButton(onClick = retry) { Text("Actualizar programación") }
        }
        if (days.isNotEmpty()) {
            item {
                OutlinedTextField(query, { query = it }, Modifier.fillMaxWidth(), singleLine = true,
                    label = { Text("Buscar en todo el festival") },
                    trailingIcon = { if (query.isNotEmpty()) TextButton(onClick = { query = "" }) { Text("Borrar") } })
            }
            if (tokens.isEmpty()) {
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
                if (visible.isEmpty()) Text("Prueba con otro nombre, categoría o lugar.")
            }
        }
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
                    when {
                        event.mapUrl != null -> TextButton(onClick = { open(event.mapUrl) }) {
                            Text(if (event.precision.startsWith("referencia", true)) "Ver ubicación aproximada" else "Cómo llegar")
                        }
                        event.route -> TextButton(onClick = { open(FestivalPolicy.PARADE) }) { Text("Ver recorrido del desfile") }
                        event.place.isNotBlank() -> Text("Ubicación en el mapa pendiente", fontSize = 12.sp)
                    }
                }
            }
        }
        item { Text("Horarios de Loja, Ecuador. La programación puede cambiar.", fontSize = 12.sp) }
    }
}
