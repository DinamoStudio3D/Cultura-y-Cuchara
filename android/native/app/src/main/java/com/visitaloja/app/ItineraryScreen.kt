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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.delay
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
fun ItineraryScreen(state: PlacesState, uid: String?, ready: Boolean, openPlace: (Place) -> Unit, explore: () -> Unit, refresh: () -> Unit) {
    val context = LocalContext.current
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(lifecycle) { lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) { while (true) { now = System.currentTimeMillis(); delay(30_000) } } }
    // A separate file per identity prevents guest/account journey state from leaking across sessions.
    val preferences = remember(uid) { context.getSharedPreferences("visitaloja_itinerary_${uid ?: "guest"}", Context.MODE_PRIVATE) }
    var order by remember(uid) { mutableStateOf(runCatching { JSONArray(preferences.getString("order", "[]")).let { array -> (0 until array.length()).map { array.getString(it) } } }.getOrDefault(emptyList())) }
    var planning by rememberSaveable(uid) { mutableStateOf(false) }
    var planned by remember(uid) { mutableStateOf(runCatching { JSONArray(preferences.getString("plannedOrder", "[]")).let { array -> (0 until array.length()).map { array.getString(it) } } }.getOrDefault(emptyList())) }
    var usePlan by remember(uid) { mutableStateOf(preferences.getBoolean("usePlan", false)) }
    var plannedTransport by remember(uid) { mutableStateOf(preferences.getString("plannedTransport", "walk").orEmpty()) }
    var plannedCurrent by remember(uid) { mutableStateOf(preferences.getString("plannedCurrent", null)) }
    var current by remember(uid) { mutableStateOf(preferences.getString("current", null)) }
    var message by remember(uid) { mutableStateOf<String?>(null) }
    val routeReady = if (usePlan) RoutePlannerPolicy.fresh(state, now) else ready
    fun canAct(): Boolean {
        if (!usePlan || RoutePlannerPolicy.fresh(state, System.currentTimeMillis())) return true
        message = "Actualiza las paradas antes de continuar con tu plan."
        return false
    }
    val ids = if (usePlan) RoutePlannerPolicy.reconcile(planned, state.places) else ItineraryPolicy.reconcile(order, state.favourites, state.places)
    val stops = ids.mapNotNull { id -> state.places.find { it.id == id } }
    fun save(next: List<String>, active: String?) {
        if (!canAct()) return
        if (usePlan) {
            planned=next;plannedCurrent=active
            preferences.edit().putString("plannedOrder",JSONArray(next).toString()).putString("plannedCurrent",active).apply()
        } else {
            order = next; current = active
            preferences.edit().putString("order", JSONArray(next).toString()).putString("current", active).apply()
        }
    }
    // Do not erase a saved journey while account favourites or the directory are still loading.
    LaunchedEffect(ids, routeReady, state.loading, state.offline, state.error, current, plannedCurrent, usePlan) {
        if (routeReady && !state.loading && !state.offline && state.error==null && state.fetchedAt>0) save(ids, (if(usePlan)plannedCurrent else current)?.takeIf { it in ids })
    }
    fun launch(intent: Intent) {
        if (!canAct()) return
        try { context.startActivity(intent) } catch (_: ActivityNotFoundException) { message = "No hay una aplicación disponible para abrir esta opción." }
    }
    if(planning) {
        key(uid) { RoutePlannerScreen(state,refresh,{planning=false},openPlace,{next,mode->
            val clean=RoutePlannerPolicy.reconcile(next,state.places)
            if(RoutePlannerPolicy.fresh(state,System.currentTimeMillis())&&clean.size==next.size&&clean.isNotEmpty()) {
                planned=clean;plannedCurrent=null;plannedTransport=mode;usePlan=true
                preferences.edit().putString("plannedOrder",JSONArray(clean).toString()).putString("plannedCurrent",null).putString("plannedTransport",mode).putBoolean("usePlan",true).apply()
                planning=false;message="Propuesta guardada en este móvil. Tus favoritos se conservan."
            }
        }) }
        return
    }
    LazyColumn(Modifier.fillMaxSize().testTag("itinerary-screen"), contentPadding = PaddingValues(start=20.dp,end=20.dp,top=20.dp,bottom=88.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Text("MI RUTA", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelLarge)
            Text("Loja, a tu ritmo", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
            Text("Prepara una propuesta o recorre tus favoritos. El orden y el avance se guardan en este móvil para esta cuenta.")
            Text("Avanzar aquí no registra visitas ni entrega sellos.", style = MaterialTheme.typography.bodySmall)
        }
        item {
            Button(onClick={planning=true},modifier=Modifier.fillMaxWidth().testTag("itinerary-planner")){Text("Preparar un recorrido")}
            Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                FilterChip(selected=!usePlan,onClick={usePlan=false;preferences.edit().putBoolean("usePlan",false).apply()},label={Text("Mis favoritos")},modifier=Modifier.testTag("itinerary-favourites-mode"))
                if(planned.isNotEmpty())FilterChip(selected=usePlan,onClick={usePlan=true;preferences.edit().putBoolean("usePlan",true).apply()},label={Text("Mi plan")},modifier=Modifier.testTag("itinerary-plan-mode"))
            }
            if(usePlan)TextButton(onClick={planned=emptyList();plannedCurrent=null;usePlan=false;preferences.edit().remove("plannedOrder").remove("plannedCurrent").remove("plannedTransport").putBoolean("usePlan",false).apply();message="Plan eliminado de este móvil. Tus favoritos siguen guardados."}){Text("Eliminar este plan")}
        }
        message?.let { text -> item { Text(text, color = MaterialTheme.colorScheme.primary) } }
        if (!routeReady) item {
            if (state.loading) LinearProgressIndicator(Modifier.fillMaxWidth())
            Text(if(usePlan) "Tu plan sigue guardado. Actualiza las paradas para comprobar su disponibilidad y continuar." else "Esperando tus favoritos. Si no carga, comprueba la conexión y reintenta desde Mi cuenta.")
            if(usePlan) OutlinedButton(onClick=refresh,enabled=!state.loading,modifier=Modifier.testTag("itinerary-refresh")){Text("Actualizar paradas")}
        }
        else if (stops.isEmpty()) item {
            Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Tu próxima aventura empieza aquí", fontWeight = FontWeight.Bold)
                Text(if(usePlan) "Las paradas del plan ya no están disponibles. Actualiza y prepara otra propuesta." else "Guarda lugares en Favoritos o prepara una propuesta para empezar.")
                Button(onClick = explore) { Text("Explorar paradas") }
            } }
        }
        if (routeReady && stops.isNotEmpty()) {
            item {
                val active = stops.find { it.id == if(usePlan)plannedCurrent else current }
                Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("${stops.size} paradas en tu recorrido", fontWeight = FontWeight.Bold)
                    if (active == null) Button(onClick = { if(canAct()) { save(ids, ids.first()); message = null } }, modifier = Modifier.testTag("itinerary-start")) { Text("Iniciar recorrido") }
                    else {
                        val index = ids.indexOf(active.id)
                        Text("Parada ${index + 1} de ${ids.size}", color = MaterialTheme.colorScheme.primary)
                        Text(active.title, style = MaterialTheme.typography.titleLarge)
                        Button(onClick = { launch(Intent(Intent.ACTION_VIEW, Uri.parse(itineraryDirections(active) + if(usePlan) "&travelmode=${if(plannedTransport=="drive")"driving" else "walking"}" else ""))) }) { Text("Cómo llegar") }
                        OutlinedButton(onClick = {
                            if(canAct()) {
                            val next = ids.getOrNull(index + 1)
                            save(ids, next)
                            message = if (next == null) if(usePlan) "¡Plan terminado! Puedes volver a iniciarlo." else "¡Recorrido terminado! Tus favoritos siguen guardados." else "Siguiente parada preparada."
                            }
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
                        IconButton(onClick = { save(ItineraryPolicy.move(ids, place.id, -1), if(usePlan)plannedCurrent else current) }, enabled = index > 0) { Icon(Icons.Default.ArrowUpward, "Subir ${place.title}") }
                        IconButton(onClick = { save(ItineraryPolicy.move(ids, place.id, 1), if(usePlan)plannedCurrent else current) }, enabled = index < stops.lastIndex) { Icon(Icons.Default.ArrowDownward, "Bajar ${place.title}") }
                        TextButton(onClick = { openPlace(place) }) { Text("Ver parada") }
                    }
                } }
            }
        }
    }
}
