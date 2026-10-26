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
import androidx.compose.foundation.Image
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
import androidx.compose.ui.draw.shadow
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.*
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

@OptIn(ExperimentalMaterial3Api::class, ExperimentalComposeUiApi::class)
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
    var filtersOpen by rememberSaveable { mutableStateOf(false) }
    var locationDetailsOpen by remember { mutableStateOf(false) }
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
        controller.onManualCamera = { refineAccuracy = null }
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
    val stopLocation: () -> Unit = {
        tracking = false; following = false; showLocation = false; locationDetailsOpen = false
        locator.cancel(); location = MapLocationState(); controller.clearPosition()
    }
    val openSettings: () -> Unit = {
        tracking = true; following = true; recenterPending = true
        val intent = if (location.problem == MapLocationProblem.DISABLED) Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)
            else Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + context.packageName))
        try { settings.launch(intent) } catch (_: ActivityNotFoundException) { Toast.makeText(context, "Abre los permisos de ubicación desde Ajustes del teléfono.", Toast.LENGTH_LONG).show() }
    }
    BoxWithConstraints(Modifier.fillMaxSize().semantics { testTagsAsResourceId = true }.testTag("map-root")) {
        val compact = maxHeight < 380.dp
        val previewSpace = if (selected != null) { if (compact) 96.dp else 180.dp } else 0.dp
        Box(Modifier.fillMaxSize().testTag("map-canvas")) { NativeMapView(controller, Modifier.fillMaxSize()) }
        Surface(Modifier.align(Alignment.TopCenter).padding(horizontal = 12.dp, vertical = 10.dp).fillMaxWidth().testTag("map-search-bar"),
            shape = RoundedCornerShape(20.dp), color = Color.White, shadowElevation = 6.dp) {
            TextField(value = query, onValueChange = { following = false; onQuery(it) }, singleLine = true,
                modifier = Modifier.fillMaxWidth(), placeholder = { Text("Busca en VisitaLoja", fontSize = 13.sp) },
                leadingIcon = { Image(painterResource(R.drawable.visitaloja_logo), "VisitaLoja", Modifier.size(36.dp)) },
                trailingIcon = { Row(verticalAlignment = Alignment.CenterVertically) {
                    if (query.isNotBlank()) IconButton(onClick = { following = false; onQuery("") }, modifier = Modifier.size(38.dp)) { Icon(Icons.Default.Close, "Borrar búsqueda", Modifier.size(20.dp)) }
                    IconButton(onClick = { filtersOpen = true }, modifier = Modifier.size(42.dp)) {
                        BadgedBox(badge = { if (category != "all" || savedOnly) Badge() }) { Icon(Icons.Default.Tune, "Filtrar mapa", tint = MaterialTheme.colorScheme.primary) }
                    }
                    IconButton(onClick = list, modifier = Modifier.size(42.dp)) { Icon(Icons.Default.ViewList, "Ver lista", tint = MaterialTheme.colorScheme.primary) }
                } },
                colors = TextFieldDefaults.colors(focusedContainerColor = Color.White, unfocusedContainerColor = Color.White,
                    focusedIndicatorColor = Color.Transparent, unfocusedIndicatorColor = Color.Transparent), shape = RoundedCornerShape(20.dp))
        }
        if (!compact || (!showLocation && selected == null)) Surface(onClick = {
            following = false
            if (mapError) { mapError = false; controller.reload() } else controller.focus(points)
        }, modifier = Modifier.align(Alignment.TopStart).padding(start = 14.dp, top = 78.dp).widthIn(max = 220.dp), shape = RoundedCornerShape(18.dp), color = Color.White.copy(alpha = .96f), shadowElevation = 2.dp) {
            Row(Modifier.padding(horizontal = 10.dp, vertical = 7.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(if (mapError) Icons.Default.Refresh else Icons.Default.CenterFocusStrong, null, Modifier.size(14.dp), tint = MaterialTheme.colorScheme.primary)
                Text(when {
                    mapError -> "Reintentar cartografía"
                    state.loading && state.places.isEmpty() -> "Cargando paradas…"
                    points.isEmpty() -> "Sin coincidencias · Ver todas"
                    state.offline -> "${points.size} paradas guardadas"
                    else -> "${points.size} paradas · Ver todas"
                }, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(start = 6.dp))
            }
        }
        if (!compact) Surface(Modifier.align(Alignment.TopEnd).padding(end = 14.dp, top = 78.dp), shape = RoundedCornerShape(16.dp), color = Color.White, shadowElevation = 5.dp) {
            Column {
                IconButton(onClick = { refineAccuracy = null; controller.zoom(1.0) }, enabled = ready) { Icon(Icons.Default.Add, "Acercar", tint = MaterialTheme.colorScheme.primary) }
                HorizontalDivider(Modifier.width(48.dp), color = MaterialTheme.colorScheme.outlineVariant)
                IconButton(onClick = { refineAccuracy = null; controller.zoom(-1.0) }, enabled = ready) { Icon(Icons.Default.Remove, "Alejar", tint = MaterialTheme.colorScheme.primary) }
            }
        }
        val locationModifier = if (compact) Modifier.align(Alignment.TopEnd).padding(end = 14.dp, top = 82.dp)
            else Modifier.align(Alignment.BottomEnd).padding(end = 14.dp, bottom = 36.dp + previewSpace)
        FilledIconButton(onClick = requestPosition, enabled = ready, modifier = locationModifier.size(52.dp).shadow(5.dp, CircleShape).testTag("map-location-control"),
            colors = IconButtonDefaults.filledIconButtonColors(containerColor = if (following && fix != null) MaterialTheme.colorScheme.primary else Color.White,
                contentColor = if (following && fix != null) Color.White else MaterialTheme.colorScheme.primary)) {
            Icon(if (following && fix != null) Icons.Default.MyLocation else Icons.Default.LocationSearching, "Mi ubicación")
        }
        if (showLocation) {
            val accuracy = fix?.accuracy?.let { if (it < 1000) "±${ceil(it.toDouble()).toInt()} m" else String.format(java.util.Locale.getDefault(), "±%.1f km", it / 1000f) }
            Surface(onClick = { locationDetailsOpen = true }, modifier = Modifier.align(Alignment.BottomStart).padding(start = 14.dp, bottom = 38.dp + previewSpace)
                .widthIn(max = 225.dp).testTag("map-location-status"), color = Color.White.copy(alpha = .97f), shape = RoundedCornerShape(20.dp), shadowElevation = 3.dp) {
                Row(Modifier.padding(horizontal = 10.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(if (fix != null) Icons.Default.MyLocation else Icons.Default.LocationSearching, null, Modifier.size(15.dp), tint = MaterialTheme.colorScheme.primary)
                    Text(when {
                        location.problem == MapLocationProblem.PERMISSION -> "Permitir ubicación"
                        location.problem == MapLocationProblem.DISABLED -> "Activar GPS"
                        fix != null -> (if (following) "Siguiendo · " else "Mi ubicación · ") + accuracy
                        location.problem == MapLocationProblem.NO_SIGNAL -> "GPS sin señal · Ver opciones"
                        else -> "Buscando GPS…"
                    }, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(horizontal = 6.dp))
                    Icon(Icons.Default.ChevronRight, "Ver detalles de ubicación", Modifier.size(14.dp))
                }
            }
        }
        Surface(onClick = {
            try { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://www.openstreetmap.org/copyright"))) } catch (_: ActivityNotFoundException) { }
        }, modifier = Modifier.align(Alignment.BottomStart).padding(start = 32.dp, bottom = 4.dp), color = Color.White.copy(alpha = .95f), shape = RoundedCornerShape(4.dp)) {
            Text("© OpenStreetMap contributors", fontSize = 9.sp, color = Color(0xFF17324D), modifier = Modifier.padding(horizontal = 5.dp, vertical = 2.dp))
        }
        if (!ready && !mapError) Surface(Modifier.align(Alignment.Center), shape = RoundedCornerShape(16.dp)) {
            Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) { CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp); Spacer(Modifier.width(12.dp)); Text("Abriendo tu mapa…", fontSize = 13.sp) }
        }
        if (mapError && !ready) Surface(Modifier.align(Alignment.Center).padding(20.dp), shape = RoundedCornerShape(18.dp), shadowElevation = 4.dp) {
            Column(Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Text("No pudimos abrir el mapa.", fontWeight = FontWeight.Bold)
                Row {
                    TextButton(onClick = { ready = false; mapError = false; attempt++; controller.reload() }) { Text("Reintentar") }
                    TextButton(onClick = list) { Text("Ver lista") }
                }
            }
        }
        if (selected != null) Surface(Modifier.align(Alignment.BottomCenter).padding(start = 12.dp, end = 12.dp, bottom = 28.dp).fillMaxWidth().testTag("map-place-preview"),
            shape = RoundedCornerShape(18.dp), color = Color.White, shadowElevation = 7.dp) {
            Column(Modifier.padding(12.dp)) {
                val overlap = points.filter { it.id in nearbyIds }
                if (!compact && overlap.size > 1) Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    overlap.forEach { place -> FilterChip(selected = selected.id == place.id, onClick = { selection = place.id }, label = { Text(place.title, maxLines = 1) }) }
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    AsyncImage(model = selected.imageUrl, contentDescription = null, placeholder = painterResource(R.drawable.visitaloja_logo),
                        error = painterResource(R.drawable.visitaloja_logo), contentScale = ContentScale.Crop, modifier = Modifier.size(if (compact) 40.dp else 48.dp).clip(RoundedCornerShape(10.dp)))
                    Column(Modifier.weight(1f).padding(start = 10.dp)) {
                        Text(selected.title, fontSize = 15.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(selected.categoryLabel, fontSize = 11.sp, color = MaterialTheme.colorScheme.primary)
                    }
                    if (compact) IconButton(onClick = { detail(selected) }) { Icon(Icons.Default.OpenInNew, "Ver parada") }
                    else IconButton(onClick = { favourite(selected.id) }) { Icon(if (selected.id in state.favourites) Icons.Default.Favorite else Icons.Default.FavoriteBorder, "Guardar o quitar de favoritos") }
                    IconButton(onClick = { selection = null; nearbyIds = emptyList() }) { Icon(Icons.Default.Close, "Cerrar parada") }
                }
                if (!compact) Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = { detail(selected) }, modifier = Modifier.weight(1f), contentPadding = PaddingValues(8.dp)) { Text("Ver parada") }
                    OutlinedButton(onClick = {
                        val destination = "${selected.latitude},${selected.longitude}"
                        try { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=" + Uri.encode(destination + "(" + selected.title + ")")))) }
                        catch (_: ActivityNotFoundException) { Toast.makeText(context, "No hay una aplicación de mapas disponible.", Toast.LENGTH_LONG).show() }
                    }, modifier = Modifier.weight(1f), contentPadding = PaddingValues(8.dp)) { Icon(Icons.Default.Directions, null, Modifier.size(18.dp)); Spacer(Modifier.width(5.dp)); Text("Cómo llegar") }
                }
            }
        }
    }
    if (filtersOpen) ModalBottomSheet(onDismissRequest = { filtersOpen = false }) {
        Column(Modifier.fillMaxWidth().heightIn(max = 460.dp).verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(bottom = 20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Explora a tu manera", fontSize = 22.sp, fontWeight = FontWeight.Bold)
            listOf("all" to "Todo", "cafe" to "Cafés", "food" to "Sabores", "hotel" to "Hospedaje", "turismo" to "Turismo", "aliado" to "Aliados").chunked(3).forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { row.forEach { (id, label) ->
                    FilterChip(selected = category == id, onClick = { following = false; onCategory(id); filtersOpen = false }, label = { Text(label, fontSize = 12.sp) })
                } }
            }
            FilterChip(selected = savedOnly, onClick = { following = false; savedOnly = !savedOnly; filtersOpen = false }, label = { Text("Mis favoritos") }, leadingIcon = { Icon(Icons.Default.Favorite, null, Modifier.size(16.dp)) })
            HorizontalDivider()
            TextButton(onClick = { following = false; controller.focus(points); filtersOpen = false }) { Icon(Icons.Default.CenterFocusStrong, null); Spacer(Modifier.width(10.dp)); Text("Ver todas las paradas filtradas") }
            TextButton(onClick = { following = false; controller.city(); filtersOpen = false }) { Icon(Icons.Default.LocationCity, null); Spacer(Modifier.width(10.dp)); Text("Volver al centro de Loja") }
            TextButton(onClick = { retry(); controller.reload(); filtersOpen = false }) { Icon(Icons.Default.Refresh, null); Spacer(Modifier.width(10.dp)); Text("Actualizar mapa y paradas") }
            if (category != "all" || savedOnly || query.isNotBlank()) TextButton(onClick = { onCategory("all"); onQuery(""); savedOnly = false; filtersOpen = false }) { Text("Quitar filtros") }
        }
    }
    if (locationDetailsOpen) ModalBottomSheet(onDismissRequest = { locationDetailsOpen = false }) {
        LocationDetails(location, fix, following, now,
            center = { requestPosition(); locationDetailsOpen = false },
            improve = { permission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)) },
            settings = openSettings, stop = stopLocation, dismiss = { locationDetailsOpen = false })
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
private fun LocationDetails(state: MapLocationState, fix: MapFix?, following: Boolean, now: Long,
    center: () -> Unit, improve: () -> Unit, settings: () -> Unit, stop: () -> Unit, dismiss: () -> Unit) {
    val accuracy = fix?.accuracy?.let { if (it < 1000) "${ceil(it.toDouble()).toInt()} m" else String.format(java.util.Locale.getDefault(), "%.1f km", it / 1000f) }
    Column(Modifier.fillMaxWidth().heightIn(max = 420.dp).verticalScroll(rememberScrollState()).padding(horizontal = 22.dp).padding(bottom = 22.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Tu ubicación", fontSize = 22.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            IconButton(onClick = dismiss) { Icon(Icons.Default.Close, "Cerrar detalles") }
        }
        Text(when {
            state.problem == MapLocationProblem.PERMISSION -> "Permite la ubicación desde los ajustes del teléfono para encontrarte en el mapa."
            state.problem == MapLocationProblem.DISABLED -> "La ubicación del teléfono está desactivada."
            fix != null -> "Margen estimado: ±" + accuracy
            state.problem == MapLocationProblem.NO_SIGNAL -> "Aún no hay señal suficiente. Cerca de una ventana o al aire libre suele mejorar."
            else -> "Buscando una señal actual…"
        }, fontWeight = FontWeight.SemiBold)
        if (fix != null) Text(when {
            now - fix.elapsedMillis > 10000 -> "Última señal hace ${(now - fix.elapsedMillis) / 1000} s. Esperando una actualización."
            !state.precise -> "Android solo permite ubicación aproximada. Puedes activar la precisa."
            following -> "El mapa sigue tu posición. Puedes cambiar el zoom sin perder el seguimiento; arrastrar el mapa lo pausa."
            else -> "Has movido el mapa. Pulsa Centrar en mí para volver a seguir tu posición."
        }, fontSize = 13.sp)
        Button(onClick = center, modifier = Modifier.fillMaxWidth()) { Icon(Icons.Default.MyLocation, null); Spacer(Modifier.width(8.dp)); Text("Centrar en mí") }
        if (state.problem == MapLocationProblem.DISABLED || state.problem == MapLocationProblem.PERMISSION) OutlinedButton(onClick = settings, modifier = Modifier.fillMaxWidth()) { Text("Abrir ajustes") }
        else if (!state.precise) {
            OutlinedButton(onClick = improve, modifier = Modifier.fillMaxWidth()) { Text("Permitir ubicación precisa") }
            TextButton(onClick = settings) { Text("Abrir ajustes del teléfono") }
        }
        TextButton(onClick = stop) { Icon(Icons.Default.LocationOff, null); Spacer(Modifier.width(8.dp)); Text("Detener ubicación") }
        Text("Se actualiza solo mientras usas este mapa. No se guarda en tu cuenta.", fontSize = 11.sp)
    }
}
