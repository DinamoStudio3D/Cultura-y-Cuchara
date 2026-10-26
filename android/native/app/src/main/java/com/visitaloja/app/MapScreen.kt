package com.visitaloja.app

import android.Manifest
import android.content.Intent
import android.content.ActivityNotFoundException
import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import coil.compose.AsyncImage
import kotlinx.coroutines.delay

@Composable
fun MapScreen(state: PlacesState, query: String, category: String, onQuery: (String) -> Unit,
    onCategory: (String) -> Unit, detail: (Place) -> Unit, favourite: (String) -> Unit,
    list: () -> Unit, retry: () -> Unit) {
    val context = LocalContext.current
    var savedOnly by rememberSaveable { mutableStateOf(false) }
    var selection by rememberSaveable { mutableStateOf<String?>(null) }
    var nearbyIds by remember { mutableStateOf<List<String>>(emptyList()) }
    val points = remember(state.places, query, category, savedOnly, state.favourites) {
        MapPolicy.filtered(state.places, query, category, savedOnly, state.favourites)
    }
    val selected = points.find { it.id == selection }
    val livePoints by rememberUpdatedState(points)
    val controller = rememberNativeMapController()
    var ready by remember { mutableStateOf(false) }
    var mapError by remember { mutableStateOf(false) }
    var attempt by remember { mutableIntStateOf(0) }
    var message by remember { mutableStateOf<String?>(null) }
    var locating by remember { mutableStateOf(false) }
    val locator = remember(context) { MapLocation(context) }
    val owner = LocalLifecycleOwner.current
    DisposableEffect(locator, owner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_STOP) { locator.cancel(); locating = false }
        }
        owner.lifecycle.addObserver(observer)
        onDispose { locator.cancel(); owner.lifecycle.removeObserver(observer) }
    }
    val locate = {
        locating = true
        message = "Buscando tu ubicación aproximada…"
        locator.locate { lat, lng, error ->
            locating = false
            message = error ?: "Ubicación aproximada del dispositivo. No se guarda en tu cuenta."
            if (lat != null && lng != null) controller.position(lat, lng)
        }
    }
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { allowed ->
        if (allowed) locate() else message = "Puedes explorar sin ubicación. Para centrarte, permite Ubicación desde los ajustes de la app."
    }
    SideEffect {
        controller.onReady = { ready = true; mapError = false }
        controller.onError = { mapError = true }
        controller.onSelect = { ids ->
            nearbyIds = ids.filter { id -> livePoints.any { it.id == id } }
            selection = nearbyIds.firstOrNull()
        }
    }
    LaunchedEffect(points, selection, ready) {
        if (selection != null && selected == null) { selection = null; nearbyIds = emptyList() }
        controller.update(points, selected?.id)
    }
    val extentKey = points.map { Triple(it.id, it.latitude, it.longitude) }
    LaunchedEffect(ready, extentKey) {
        if (ready) { delay(100); controller.focus(points) }
    }
    LaunchedEffect(attempt) { delay(25000); if (!ready) mapError = true }
    Column(Modifier.fillMaxSize()) {
        Column(Modifier.padding(horizontal = 16.dp).padding(top = 6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("LOJA, A TU ALCANCE", fontSize = 9.sp, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                    Text("Tu mapa de Loja", fontSize = 24.sp, fontWeight = FontWeight.ExtraBold)
                }
                TextButton(onClick = list) { Icon(Icons.Default.ViewList, null, Modifier.size(18.dp)); Spacer(Modifier.width(5.dp)); Text("Lista") }
            }
            OutlinedTextField(value = query, onValueChange = onQuery, singleLine = true, modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("Buscar una parada o un cantón", fontSize = 13.sp) },
                leadingIcon = { Icon(Icons.Default.Search, null) },
                trailingIcon = { if (query.isNotBlank()) IconButton(onClick = { onQuery("") }) { Icon(Icons.Default.Close, "Borrar búsqueda") } },
                shape = RoundedCornerShape(16.dp), colors = OutlinedTextFieldDefaults.colors(unfocusedContainerColor = Color.White))
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                listOf("all" to "Todo", "cafe" to "Cafés", "food" to "Sabores", "hotel" to "Hospedaje", "turismo" to "Turismo").forEach { (id, label) ->
                    FilterChip(selected = category == id, onClick = { onCategory(id) }, label = { Text(label) })
                }
                FilterChip(selected = savedOnly, onClick = { savedOnly = !savedOnly }, label = { Text("Mis favoritos") }, leadingIcon = { Icon(Icons.Default.Favorite, null, Modifier.size(15.dp)) })
            }
        }
        Box(Modifier.weight(1f).fillMaxWidth().heightIn(min = 100.dp)) {
            NativeMapView(controller, Modifier.fillMaxSize())
            Surface(Modifier.align(Alignment.TopStart).padding(10.dp), shape = RoundedCornerShape(20.dp), color = Color.White.copy(alpha = .96f)) {
                Text(if (state.loading && state.places.isEmpty()) "Cargando paradas…" else "${points.size} paradas en el mapa", fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp))
            }
            Column(Modifier.align(Alignment.TopEnd).padding(10.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                MapControl("Acercar", Icons.Default.Add, ready) { controller.zoom(1.0) }
                MapControl("Alejar", Icons.Default.Remove, ready) { controller.zoom(-1.0) }
                MapControl("Mostrar todas las paradas filtradas", Icons.Default.CenterFocusStrong, ready) { controller.focus(points) }
                MapControl("Mi ubicación aproximada", Icons.Default.MyLocation, ready && !locating) { permission.launch(Manifest.permission.ACCESS_COARSE_LOCATION) }
            }
            if (!ready && !mapError) Surface(Modifier.align(Alignment.Center), shape = RoundedCornerShape(16.dp)) {
                Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) { CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp); Spacer(Modifier.width(12.dp)); Text("Abriendo tu mapa…", fontSize = 13.sp) }
            }
            if (mapError) Surface(Modifier.align(Alignment.Center).padding(20.dp), shape = RoundedCornerShape(18.dp), shadowElevation = 4.dp) {
                Column(Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("El mapa no terminó de cargar.", fontWeight = FontWeight.Bold)
                    Text("Comprueba la conexión. Las fichas siguen disponibles en Lista.", fontSize = 12.sp)
                    Row {
                        TextButton(onClick = { ready = false; mapError = false; attempt++; controller.reload() }) { Text("Reintentar") }
                        TextButton(onClick = list) { Text("Ver lista") }
                    }
                }
            }
        }
        message?.let {
            Row(Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.primaryContainer).padding(start = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(it, fontSize = 11.sp, modifier = Modifier.weight(1f))
                IconButton(onClick = { message = null }) { Icon(Icons.Default.Close, "Cerrar aviso") }
            }
        }
        if (selected != null) {
            val overlap = points.filter { it.id in nearbyIds }
            if (overlap.size > 1) Row(Modifier.horizontalScroll(rememberScrollState()).padding(horizontal = 12.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                overlap.forEach { place -> FilterChip(selected = selected.id == place.id, onClick = { selection = place.id }, label = { Text(place.title, maxLines = 1) }) }
            }
            Surface(color = Color.White, shadowElevation = 5.dp) {
                Column(Modifier.padding(horizontal = 16.dp, vertical = 10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        AsyncImage(model = selected.imageUrl, contentDescription = null, placeholder = painterResource(R.drawable.visitaloja_logo),
                            error = painterResource(R.drawable.visitaloja_logo), contentScale = ContentScale.Crop,
                            modifier = Modifier.size(60.dp).clip(RoundedCornerShape(12.dp)))
                        Column(Modifier.weight(1f).padding(start = 12.dp)) {
                            Text(selected.categoryLabel, fontSize = 10.sp, color = MaterialTheme.colorScheme.primary)
                            Text(selected.title, fontSize = 17.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text(selected.address, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                        IconButton(onClick = { favourite(selected.id) }) {
                            Icon(if (selected.id in state.favourites) Icons.Default.Favorite else Icons.Default.FavoriteBorder, "Guardar o quitar de favoritos")
                        }
                    }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(onClick = { detail(selected) }, modifier = Modifier.weight(1f), contentPadding = PaddingValues(8.dp)) { Text("Ver parada") }
                        OutlinedButton(onClick = {
                            val destination = "${selected.latitude},${selected.longitude}"
                            try { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=" + Uri.encode(destination + "(" + selected.title + ")")))) }
                            catch (_: ActivityNotFoundException) { Toast.makeText(context, "No hay una aplicación de mapas disponible.", Toast.LENGTH_LONG).show() }
                        }, modifier = Modifier.weight(1f), contentPadding = PaddingValues(8.dp)) { Icon(Icons.Default.Directions, null, Modifier.size(18.dp)); Spacer(Modifier.width(5.dp)); Text("Cómo llegar") }
                    }
                }
            }
        } else {
            Row(Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(when {
                    state.error != null && points.isEmpty() -> state.error
                    points.isEmpty() && !state.loading -> "No hay paradas con ubicación para estos filtros. Prueba otra búsqueda o abre Lista."
                    else -> "Toca un marcador para descubrir la parada. Los números agrupan lugares cercanos."
                }, fontSize = 11.sp, modifier = Modifier.weight(1f))
                if (state.error != null) TextButton(onClick = retry) { Text("Actualizar") }
            }
        }
    }
}

@Composable
private fun MapControl(label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, enabled: Boolean, click: () -> Unit) {
    Surface(shape = RoundedCornerShape(12.dp), color = Color.White, shadowElevation = 3.dp) {
        IconButton(onClick = click, enabled = enabled) { Icon(icon, label, tint = if (enabled) MaterialTheme.colorScheme.primary else Color.Gray) }
    }
}

@Composable
fun MapShortcut(open: () -> Unit) {
    Surface(onClick = open, modifier = Modifier.padding(horizontal = 22.dp).fillMaxWidth(), shape = RoundedCornerShape(22.dp),
        color = Color(0xFF075BB2)) {
        Row(Modifier.padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.Map, null, tint = Color.White, modifier = Modifier.size(42.dp))
            Column(Modifier.weight(1f).padding(horizontal = 14.dp)) {
                Text("LOJA SE DESCUBRE CAMINANDO", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = Color(0xFFB9DFFF))
                Text("Abre tu mapa", color = Color.White, fontSize = 21.sp, fontWeight = FontWeight.Bold)
                Text("Encuentra cada parada y elige tu próxima visita.", color = Color.White, fontSize = 12.sp)
            }
            Icon(Icons.Default.ArrowOutward, "Abrir mapa interactivo", tint = Color.White)
        }
    }
}
