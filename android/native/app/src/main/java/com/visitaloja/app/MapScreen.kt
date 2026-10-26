package com.visitaloja.app

import android.os.SystemClock
import android.provider.Settings
import kotlin.math.ceil
import androidx.lifecycle.viewmodel.compose.viewModel
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
import androidx.compose.foundation.verticalScroll
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
    val viewport: MapViewportViewModel = viewModel()
    val controller = rememberNativeMapController(viewport.camera)
    var ready by remember { mutableStateOf(false) }
    var mapError by remember { mutableStateOf(false) }
    var attempt by remember { mutableIntStateOf(0) }
    val owner = LocalLifecycleOwner.current
    val locator = remember(context) { MapLocation(context) }
    var tracking by rememberSaveable { mutableStateOf(false) }
    var following by remember { mutableStateOf(tracking) }
    var showLocation by remember { mutableStateOf(tracking) }
    var location by remember { mutableStateOf(MapLocationState()) }
    var foreground by remember { mutableStateOf(owner.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) }
    var restartLocation by remember { mutableIntStateOf(0) }
    var recenterPending by remember { mutableStateOf(false) }
    var refineAccuracy by remember { mutableStateOf<Float?>(null) }
    var now by remember { mutableLongStateOf(SystemClock.elapsedRealtime()) }
    val fix = location.fix?.takeIf { tracking && foreground && MapLocationPolicy.valid(it, now) }
    DisposableEffect(locator, owner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) foreground = true
            if (event == Lifecycle.Event.ON_PAUSE) {
                foreground = false
                locator.cancel()
                location = MapLocationState()
                controller.clearPosition()
            }
        }
        owner.lifecycle.addObserver(observer)
        onDispose { locator.cancel(); owner.lifecycle.removeObserver(observer); controller.clearPosition() }
    }
    LaunchedEffect(tracking, foreground, restartLocation) {
        locator.cancel()
        if (tracking && foreground) locator.start { now = SystemClock.elapsedRealtime(); location = it }
        else { location = location.copy(active = false, fix = null); controller.clearPosition() }
    }
    LaunchedEffect(tracking, foreground) {
        now = SystemClock.elapsedRealtime()
        while (tracking && foreground) { delay(1000); now = SystemClock.elapsedRealtime() }
    }
    val enableTracking: () -> Unit = {
        val fresh = location.fix?.takeIf { MapLocationPolicy.valid(it, SystemClock.elapsedRealtime()) }
        val running = tracking && location.active
        showLocation = true; tracking = true; following = true; recenterPending = true
        if (running && fresh != null) { controller.position(fresh, true, true); recenterPending = false }
        else restartLocation++
    }
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        if (locator.hasPermission()) enableTracking()
        else { tracking = false; following = false; showLocation = true; location = MapLocationState(problem = MapLocationProblem.PERMISSION) }
    }
    val settings = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { if (tracking) restartLocation++ }
    val requestPosition: () -> Unit = {
        if (locator.hasPermission()) enableTracking()
        else permission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
    }
    LaunchedEffect(ready, fix, following) {
        if (fix != null && ready) {
            val improved = following && refineAccuracy?.let { it > 100 && fix.accuracy < it / 2 } == true
            controller.position(fix, following, recenterPending || improved)
            if (recenterPending || improved) refineAccuracy = fix.accuracy
            recenterPending = false
        } else controller.clearPosition()
    }
    SideEffect {
        controller.onGesture = { following = false; refineAccuracy = null }
        controller.onCamera = viewport::update
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
    LaunchedEffect(selected?.id) {
        if (selected != null) { following = false; delay(200); controller.focusPlace(selected) }
    }
    // Favorite/server updates must not pull the camera away while exploring or following.
    LaunchedEffect(ready, query, category, savedOnly, state.loading) {
        if (ready && !state.loading && query.isNotBlank() && points.isNotEmpty() && !following) { delay(300); controller.focus(points) }
    }
    LaunchedEffect(attempt) { delay(25000); if (!ready) mapError = true }
    Column(Modifier.fillMaxSize()) {
        Column(Modifier.padding(horizontal = 16.dp).padding(top = 6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Explora Loja", fontSize = 21.sp, fontWeight = FontWeight.ExtraBold)
                }
                TextButton(onClick = list) { Icon(Icons.Default.ViewList, null, Modifier.size(18.dp)); Spacer(Modifier.width(5.dp)); Text("Lista") }
            }
            OutlinedTextField(value = query, onValueChange = { following = false; onQuery(it) }, singleLine = true, modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("Buscar una parada o un cantón", fontSize = 13.sp) },
                leadingIcon = { Icon(Icons.Default.Search, null) },
                trailingIcon = { if (query.isNotBlank()) IconButton(onClick = { following = false; onQuery("") }) { Icon(Icons.Default.Close, "Borrar búsqueda") } },
                shape = RoundedCornerShape(16.dp), colors = OutlinedTextFieldDefaults.colors(unfocusedContainerColor = Color.White))
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                listOf("all" to "Todo", "cafe" to "Cafés", "food" to "Sabores", "hotel" to "Hospedaje", "turismo" to "Turismo", "aliado" to "Aliados").forEach { (id, label) ->
                    FilterChip(selected = category == id, onClick = { following = false; onCategory(id) }, label = { Text(label) }, leadingIcon = {
                        Icon(when (id) { "cafe" -> Icons.Default.LocalCafe; "food" -> Icons.Default.Restaurant; "hotel" -> Icons.Default.Hotel; "turismo" -> Icons.Default.Park; "aliado" -> Icons.Default.Handshake; else -> Icons.Default.Map }, null, Modifier.size(17.dp),
                            tint = Color(android.graphics.Color.parseColor(MapPolicy.color(when (id) { "aliado" -> "partner"; else -> id }))))
                    })
                }
                FilterChip(selected = savedOnly, onClick = { following = false; savedOnly = !savedOnly }, label = { Text("Mis favoritos") }, leadingIcon = { Icon(Icons.Default.Favorite, null, Modifier.size(15.dp)) })
            }
        }
        Box(Modifier.weight(1f).fillMaxWidth().heightIn(min = 100.dp)) {
            NativeMapView(controller, Modifier.fillMaxSize())
            Surface(Modifier.align(Alignment.TopStart).padding(10.dp), shape = RoundedCornerShape(20.dp), color = Color.White.copy(alpha = .96f)) {
                Text(if (state.loading && state.places.isEmpty()) "Cargando paradas…" else "${points.size} paradas en el mapa", fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp))
            }
            Column(Modifier.align(Alignment.TopEnd).padding(10.dp).padding(bottom = 30.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                MapControl("Acercar", Icons.Default.Add, ready) { refineAccuracy = null; controller.zoom(1.0) }
                MapControl("Alejar", Icons.Default.Remove, ready) { refineAccuracy = null; controller.zoom(-1.0) }
                MapControl("Mostrar todas las paradas filtradas", Icons.Default.CenterFocusStrong, ready) { following = false; controller.focus(points) }
                MapControl("Volver al centro de Loja", Icons.Default.LocationCity, ready) { following = false; controller.city() }
                MapControl(if (following) "Siguiendo mi ubicación" else "Volver a mi ubicación", Icons.Default.MyLocation, ready, selected = following && fix != null, click = requestPosition)
            }
            Surface(onClick = {
                try { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://www.openstreetmap.org/copyright"))) }
                catch (_: ActivityNotFoundException) { }
            }, modifier = Modifier.align(Alignment.BottomStart).padding(start = 32.dp, bottom = 5.dp), color = Color.White.copy(alpha = .95f), shape = RoundedCornerShape(4.dp)) {
                Text("© OpenStreetMap contributors", fontSize = 9.sp, color = Color(0xFF17324D), modifier = Modifier.padding(horizontal = 5.dp, vertical = 2.dp))
            }
            if (mapError && ready) Surface(Modifier.align(Alignment.BottomCenter).padding(bottom = 25.dp, start = 8.dp, end = 8.dp), color = Color.White, shape = RoundedCornerShape(10.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Algunas calles no cargaron.", fontSize = 11.sp, modifier = Modifier.padding(start = 10.dp))
                    TextButton(onClick = { mapError = false; controller.reload() }) { Text("Reintentar", fontSize = 11.sp) }
                }
            }
            if (!ready && !mapError) Surface(Modifier.align(Alignment.Center), shape = RoundedCornerShape(16.dp)) {
                Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) { CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp); Spacer(Modifier.width(12.dp)); Text("Abriendo tu mapa…", fontSize = 13.sp) }
            }
            if (mapError && !ready) Surface(Modifier.align(Alignment.Center).padding(20.dp), shape = RoundedCornerShape(18.dp), shadowElevation = 4.dp) {
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
        if (showLocation) LocationStatus(location, fix, following, now,
            retry = { requestPosition() },
            improve = { permission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)) },
            settings = {
                tracking = true; following = true; recenterPending = true
                val intent = if (location.problem == MapLocationProblem.DISABLED) Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)
                    else Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + context.packageName))
                try { settings.launch(intent) } catch (_: ActivityNotFoundException) { Toast.makeText(context, "Abre los permisos de ubicación desde Ajustes del teléfono.", Toast.LENGTH_LONG).show() }
            },
            stop = { tracking = false; following = false; showLocation = false; locator.cancel(); location = MapLocationState(); controller.clearPosition() })
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
                    else -> "Toca un icono o un logo para ver la parada. Acerca el mapa para separarlos."
                }, fontSize = 11.sp, modifier = Modifier.weight(1f))
                if (state.error != null) TextButton(onClick = retry) { Text("Actualizar") }
            }
        }
    }
}

@Composable
private fun MapControl(label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, enabled: Boolean, selected: Boolean = false, click: () -> Unit) {
    Surface(shape = RoundedCornerShape(12.dp), color = if (selected) MaterialTheme.colorScheme.primaryContainer else Color.White, shadowElevation = 3.dp) {
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

@Composable
private fun LocationStatus(state: MapLocationState, fix: MapFix?, following: Boolean, now: Long,
    retry: () -> Unit, improve: () -> Unit, settings: () -> Unit, stop: () -> Unit) {
    val accuracy = fix?.accuracy?.let { if (it < 1000) "${ceil(it.toDouble()).toInt()} m" else String.format(java.util.Locale.getDefault(), "%.1f km", it / 1000f) }
    val text = when {
        state.problem == MapLocationProblem.PERMISSION -> "Falta permiso de ubicación. Puedes seguir usando el mapa."
        state.problem == MapLocationProblem.DISABLED -> "La ubicación del teléfono está desactivada."
        fix != null -> (if (state.precise && fix.accuracy <= 100) "Ubicación actual" else "Ubicación aproximada") + " · margen estimado ±" + accuracy
        state.problem == MapLocationProblem.NO_SIGNAL -> "Aún no hay señal suficiente. Prueba cerca de una ventana o al aire libre."
        else -> "Buscando una ubicación actual…"
    }
    Surface(color = MaterialTheme.colorScheme.primaryContainer) {
        Column(Modifier.padding(horizontal = 14.dp, vertical = 8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(if (fix != null) Icons.Default.MyLocation else Icons.Default.LocationSearching, null, Modifier.size(20.dp))
                Text(text, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f).padding(start = 8.dp))
                IconButton(onClick = stop, modifier = Modifier.size(40.dp)) { Icon(Icons.Default.Close, "Detener ubicación") }
            }
            if (fix != null) Text(when {
                now - fix.elapsedMillis > 10000 -> "Última señal hace ${(now - fix.elapsedMillis) / 1000} s; esperando una actualización."
                !state.precise -> "Android solo permite ubicación aproximada. Puedes activar la precisa."
                fix.accuracy > 100 -> "El GPS está afinando la posición. El círculo muestra el margen de error."
                following -> "La posición se actualiza mientras tienes abierto el mapa."
                else -> "Puedes explorar libremente. Pulsa Mi ubicación para volver a seguirte."
            }, fontSize = 11.sp)
            Row(Modifier.horizontalScroll(rememberScrollState())) {
                if (state.problem == MapLocationProblem.DISABLED || state.problem == MapLocationProblem.PERMISSION) TextButton(onClick = settings) { Text("Abrir ajustes") }
                else if (!state.precise) {
                    TextButton(onClick = improve) { Text("Mejorar precisión") }
                    TextButton(onClick = settings) { Text("Ajustes") }
                }
                TextButton(onClick = retry) { Text(if (fix != null) "Centrar en mí" else "Reintentar") }
            }
        }
    }
}
