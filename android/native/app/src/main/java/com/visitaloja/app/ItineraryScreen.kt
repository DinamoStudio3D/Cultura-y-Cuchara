package com.visitaloja.app

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import org.json.JSONArray

/** Only published favourites enter the route. No visit, stamp or reward is issued here. */
object ItineraryPolicy {
    fun reconcile(order: List<String>, favourites: Set<String>, places: List<Place>): List<String> {
        val allowed = places.filter(PlacePolicy::published).map { it.id }.toSet().intersect(favourites)
        return (order + favourites).distinct().filter { it in allowed }
    }
    fun move(order: List<String>, id: String, direction: Int): List<String> {
        if (direction !in setOf(-1, 1)) return order
        val index = order.indexOf(id)
        val target = index + direction
        if (index < 0 || target !in order.indices) return order
        return order.toMutableList().apply { this[index] = order[target]; this[target] = id }
    }

}

private fun itineraryDirections(place: Place): String {
        val lat = PlacePolicy.safeCoordinate(place.latitude, true)
        val lng = PlacePolicy.safeCoordinate(place.longitude, false)
        return if (lat != null && lng != null) "https://www.google.com/maps/dir/?api=1&destination=${Uri.encode("$lat,$lng")}" 
        else "https://www.google.com/maps/search/?api=1&query=${Uri.encode(place.address.ifBlank { place.title })}"
    }

@Composable
fun ItineraryScreen(state: PlacesState, uid: String?, ready: Boolean, openPlace: (Place) -> Unit, explore: () -> Unit) {
    val context = LocalContext.current
    // A separate file per identity prevents guest/account journey state from leaking across sessions.
    val preferences = remember(uid) { context.getSharedPreferences("visitaloja_itinerary_${uid ?: "guest"}", Context.MODE_PRIVATE) }
    var order by remember(uid) { mutableStateOf(runCatching { JSONArray(preferences.getString("order", "[]")).let { array -> (0 until array.length()).map { array.getString(it) } } }.getOrDefault(emptyList())) }
    var current by remember(uid) { mutableStateOf(preferences.getString("current", null)) }
    var message by remember(uid) { mutableStateOf<String?>(null) }
    val ids = ItineraryPolicy.reconcile(order, state.favourites, state.places)
    val stops = ids.mapNotNull { id -> state.places.find { it.id == id } }
    fun save(next: List<String>, active: String?) {
        order = next; current = active
        preferences.edit().putString("order", JSONArray(next).toString()).putString("current", active).apply()
    }
    // Do not erase a saved journey while account favourites or the directory are still loading.
    LaunchedEffect(ids, ready, state.loading, state.offline, current) {
        if (ready && !state.loading && !state.offline) save(ids, current?.takeIf { it in ids })
    }
    fun launch(intent: Intent) {
        try { context.startActivity(intent) } catch (_: ActivityNotFoundException) { message = "No hay una aplicación disponible para abrir esta opción." }
    }
    LazyColumn(Modifier.fillMaxSize().testTag("itinerary-screen"), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Text("MI RUTA", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelLarge)
            Text("Loja, a tu ritmo", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
            Text("Organiza tus favoritos y recorre las paradas una a una. El orden y el avance se guardan en este móvil.")
            Text("Avanzar aquí no registra visitas ni entrega sellos.", style = MaterialTheme.typography.bodySmall)
        }
        message?.let { text -> item { Text(text, color = MaterialTheme.colorScheme.primary) } }
        if (!ready) item { LinearProgressIndicator(Modifier.fillMaxWidth()); Text("Esperando tus favoritos. Si no carga, comprueba la conexión y reintenta desde Mi cuenta.") }
        else if (stops.isEmpty()) item {
            Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Tu próxima aventura empieza aquí", fontWeight = FontWeight.Bold)
                Text("Guarda lugares en Favoritos para añadirlos a tu ruta.")
                Button(onClick = explore) { Text("Explorar paradas") }
            } }
        }
        if (ready && stops.isNotEmpty()) {
            item {
                val active = stops.find { it.id == current }
                Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("${stops.size} paradas en tu recorrido", fontWeight = FontWeight.Bold)
                    if (active == null) Button(onClick = { save(ids, ids.first()); message = null }, modifier = Modifier.testTag("itinerary-start")) { Text("Iniciar recorrido") }
                    else {
                        val index = ids.indexOf(active.id)
                        Text("Parada ${index + 1} de ${ids.size}", color = MaterialTheme.colorScheme.primary)
                        Text(active.title, style = MaterialTheme.typography.titleLarge)
                        Button(onClick = { launch(Intent(Intent.ACTION_VIEW, Uri.parse(itineraryDirections(active)))) }) { Text("Cómo llegar") }
                        OutlinedButton(onClick = {
                            val next = ids.getOrNull(index + 1)
                            save(ids, next)
                            message = if (next == null) "¡Recorrido terminado! Tus favoritos siguen guardados." else "Siguiente parada preparada."
                        }, modifier = Modifier.testTag("itinerary-next")) { Text(if (index == ids.lastIndex) "Finalizar recorrido" else "Siguiente parada") }
                        TextButton(onClick = { save(ids, null) }) { Text("Pausar recorrido") }
                    }
                    OutlinedButton(onClick = {
                        val text = "Mi ruta de VisitaLoja\n\n" + stops.mapIndexed { index, place -> "${index + 1}. ${place.title}\n${PlacePolicy.publicUrl(place)}" }.joinToString("\n\n")
                        launch(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text), "Compartir mi ruta"))
                    }) { Text("Compartir ruta") }
                } }
            }
            itemsIndexed(stops, key = { _, place -> place.id }) { index, place ->
                Card(Modifier.fillMaxWidth().testTag("itinerary-stop-${place.id}")) { Column(Modifier.padding(16.dp)) {
                    Text("${index + 1}. ${place.title}", fontWeight = FontWeight.Bold)
                    Text(place.address, style = MaterialTheme.typography.bodySmall)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        IconButton(onClick = { save(ItineraryPolicy.move(ids, place.id, -1), current) }, enabled = index > 0) { Icon(Icons.Default.ArrowUpward, "Subir ${place.title}") }
                        IconButton(onClick = { save(ItineraryPolicy.move(ids, place.id, 1), current) }, enabled = index < stops.lastIndex) { Icon(Icons.Default.ArrowDownward, "Bajar ${place.title}") }
                        TextButton(onClick = { openPlace(place) }) { Text("Ver parada") }
                    }
                } }
            }
        }
    }
}
