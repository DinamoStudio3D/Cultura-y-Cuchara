package com.visitaloja.app

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import java.text.DateFormat
import java.util.Date

private val Blue = Color(0xFF075BB2)
private val Ink = Color(0xFF172D45)
private val Muted = Color(0xFF5C7289)
private val Pale = Color(0xFFF2F7FD)
private val AppColors = lightColorScheme(primary = Blue, onPrimary = Color.White, primaryContainer = Color(0xFFE5F1FF), onPrimaryContainer = Blue, background = Color.White, onBackground = Ink, surface = Color.White, onSurface = Ink, surfaceVariant = Pale, onSurfaceVariant = Muted, outlineVariant = Color(0xFFDCE7F2))
private data class Category(val id: String, val name: String, val icon: ImageVector)
private val categories = listOf(Category("cafe", "Cafeterías", Icons.Default.LocalCafe), Category("hotel", "Hospedaje", Icons.Default.Hotel), Category("food", "Gastronomía", Icons.Default.Restaurant), Category("turismo", "Turismo", Icons.Default.Explore))

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VisitaLojaApp(model: PlacesViewModel = viewModel(), account: AccountViewModel = viewModel()) {
    val guestState by model.state.collectAsStateWithLifecycle()
    val accountState by account.state.collectAsStateWithLifecycle()
    val snack = remember { SnackbarHostState() }
    LaunchedEffect(accountState.message) { accountState.message?.let { snack.showSnackbar(it) } }
    val state = guestState.copy(favourites = if (accountState.uid == null) guestState.favourites else accountState.favourites)
    val favourite: (String) -> Unit = { id -> if (accountState.uid == null) model.toggleFavourite(id) else account.toggleFavourite(id) }
    var tab by rememberSaveable { mutableStateOf("home") }
    var category by rememberSaveable { mutableStateOf("all") }
    var query by rememberSaveable { mutableStateOf("") }
    var selectedId by rememberSaveable { mutableStateOf<String?>(null) }
    val selected = state.places.find { it.id == selectedId }
    val navigate: (String, String) -> Unit = { target, filter -> tab = target; category = filter; query = "" }
    BackHandler(enabled = tab != "home" && selected == null) { tab = "home"; query = ""; category = "all" }
    MaterialTheme(colorScheme = AppColors) {
        Scaffold(
            snackbarHost = { SnackbarHost(snack) },
            topBar = { AppTopBar(state.loading, model::refresh, tab != "home") { navigate("home", "all") } },
            bottomBar = { AppNavigation(tab) { navigate(it, "all") } },
            containerColor = Color.White
        ) { padding ->
            Column(Modifier.padding(padding).fillMaxSize()) {
                if (state.offline) OfflineBanner(state.fetchedAt, state.loading, model::refresh)
                when (tab) {
                    "account" -> AccountScreen(accountState, guestState.favourites, account)
                    "home" -> HomeScreen(state, { navigate("explore", it) }, { selectedId = it.id }, favourite)
                    else -> {
                        if (tab == "saved" && accountState.uid != null) {
                            Text(if (accountState.busy) "Guardando cambios…" else accountState.favouritesError ?: if (!accountState.favouritesReady) "Consultando tu cuenta…" else if (accountState.fromCache) "Conéctate para sincronizar tus favoritos." else accountState.message ?: "Favoritos de tu cuenta, compartidos con la web.", fontSize = 12.sp, color = Blue, modifier = Modifier.padding(horizontal = 22.dp, vertical = 8.dp))
                        }
                        ExploreScreen(state, tab == "saved", query, category, { query = it }, { category = it }, { selectedId = it.id }, favourite, accountState.uid != null) { model.refresh() }
                    }
                }
            }
        }
        if (selected != null) {
            ModalBottomSheet(onDismissRequest = { selectedId = null }, containerColor = Color.White) {
                PlaceDetail(selected, selected.id in state.favourites, { favourite(selected.id) }) { selectedId = null }
            }
        }
    }
}

@Composable
private fun AppTopBar(loading: Boolean, refresh: () -> Unit, showBack: Boolean, back: () -> Unit) {
    Surface(color = Color.White) {
        Row(Modifier.statusBarsPadding().fillMaxWidth().padding(horizontal = 14.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            if (showBack) IconButton(onClick = back) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Volver a Inicio") }
            Image(painterResource(R.drawable.visitaloja_logo), "VisitaLoja.com", Modifier.size(54.dp))
            Column(Modifier.weight(1f).padding(start = 10.dp)) {
                Text("VisitaLoja", fontSize = 19.sp, fontWeight = FontWeight.ExtraBold)
                Row(verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Default.LocationOn, null, Modifier.size(13.dp), tint = Muted); Text("Loja, Ecuador", fontSize = 12.sp, color = Muted) }
            }
            Surface(color = Pale, shape = RoundedCornerShape(20.dp)) { Text("PRUEBA", color = Blue, fontSize = 9.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 8.dp, vertical = 5.dp)) }
            IconButton(onClick = refresh, enabled = !loading) { Icon(Icons.Default.Refresh, "Actualizar lugares", tint = Blue) }
        }
    }
}

@Composable
private fun AppNavigation(tab: String, navigate: (String) -> Unit) {
    NavigationBar(containerColor = Color.White, tonalElevation = 0.dp) {
        listOf(Triple("home", "Inicio", Icons.Default.Home), Triple("explore", "Explorar", Icons.Default.Explore), Triple("passport", "Pasaporte", Icons.Default.MenuBook), Triple("saved", "Favoritos", Icons.Default.FavoriteBorder), Triple("account", "Mi cuenta", Icons.Default.PersonOutline)).forEach { (id, label, icon) ->
            NavigationBarItem(selected = id == tab, onClick = { navigate(id) }, enabled = id in setOf("home", "explore", "saved", "account"), icon = { Icon(icon, null) }, label = { Text(label, fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis) }, colors = NavigationBarItemDefaults.colors(selectedIconColor = Blue, selectedTextColor = Blue, indicatorColor = Color(0xFFE5F1FF)))
        }
    }
}

@Composable
private fun OfflineBanner(time: Long, loading: Boolean, retry: () -> Unit) {
    Surface(color = Color(0xFFFFF5D9)) {
        Row(Modifier.fillMaxWidth().padding(start = 16.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.WifiOff, null, tint = Color(0xFF755500), modifier = Modifier.size(18.dp))
            Column(Modifier.weight(1f).padding(8.dp)) {
                Text("Mostrando la última consulta guardada", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFF624900))
                Text(DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(Date(time)), fontSize = 11.sp, color = Color(0xFF624900))
            }
            IconButton(onClick = retry, enabled = !loading) { Icon(Icons.Default.Refresh, "Intentar conectar") }
        }
    }
}

@Composable
private fun HomeScreen(state: PlacesState, explore: (String) -> Unit, detail: (Place) -> Unit, favourite: (String) -> Unit) {
    LazyColumn(contentPadding = PaddingValues(bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(22.dp)) {
        item {
            Column(Modifier.padding(horizontal = 22.dp).padding(top = 12.dp)) {
                Eyebrow("UN NUEVO LUGAR, UNA NUEVA HISTORIA")
                Text("¿Qué descubrimos hoy?", fontSize = 27.sp, fontWeight = FontWeight.ExtraBold, lineHeight = 33.sp, modifier = Modifier.padding(top = 5.dp, bottom = 16.dp))
                Surface(onClick = { explore("all") }, color = Pale, shape = RoundedCornerShape(16.dp)) {
                    Row(Modifier.fillMaxWidth().heightIn(min = 52.dp).padding(14.dp), verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Default.Search, null, tint = Blue); Text("Café, sabores y lugares por conocer…", fontSize = 13.sp, color = Muted, modifier = Modifier.padding(start = 10.dp)) }
                }
            }
        }
        item { Hero(explore) }
        item {
            Column(Modifier.padding(horizontal = 22.dp)) {
                SectionHeading("A tu manera", "Ver todo") { explore("all") }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    categories.forEach { category ->
                        Column(Modifier.weight(1f).clip(RoundedCornerShape(14.dp)).clickable { explore(category.id) }.padding(vertical = 6.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            Surface(shape = RoundedCornerShape(18.dp), color = Pale) { Box(Modifier.size(58.dp), contentAlignment = Alignment.Center) { Icon(category.icon, null, tint = Blue, modifier = Modifier.size(26.dp)) } }
                            Text(category.name, fontSize = 11.sp, textAlign = TextAlign.Center, fontWeight = FontWeight.Medium, modifier = Modifier.padding(top = 8.dp), maxLines = 2)
                        }
                    }
                }
            }
        }
        item {
            Column {
                Column(Modifier.padding(horizontal = 22.dp)) { Eyebrow("CADA PARADA TIENE ALGO ESPECIAL"); SectionHeading("Empieza por aquí", "Ver todas") { explore("all") } }
                when {
                    state.loading && state.places.isEmpty() -> LoadingPlaces()
                    state.error != null && state.places.isEmpty() -> Text(state.error, color = Muted, modifier = Modifier.padding(horizontal = 22.dp))
                    state.places.isEmpty() -> Text("Todavía no hay lugares publicados.", color = Muted, modifier = Modifier.padding(horizontal = 22.dp))
                    else -> LazyRow(contentPadding = PaddingValues(horizontal = 22.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                        items(state.places.take(6), key = Place::id) { place -> PlaceCard(place, place.id in state.favourites, { detail(place) }, { favourite(place.id) }, Modifier.width(244.dp), compact = true) }
                    }
                }
            }
        }
        item {
            Surface(Modifier.padding(horizontal = 22.dp), shape = RoundedCornerShape(18.dp), color = Pale) {
                Row(Modifier.padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.MenuBook, null, tint = Blue, modifier = Modifier.size(34.dp))
                    Column(Modifier.padding(start = 14.dp)) { Eyebrow("TU RECORRIDO TIENE RECOMPENSA"); Text("Mucho más que visitar.", fontWeight = FontWeight.Bold, fontSize = 17.sp); Text("Pasaporte y cuenta se incorporarán en la siguiente etapa de esta prueba.", fontSize = 12.sp, color = Muted, modifier = Modifier.padding(top = 5.dp)) }
                }
            }
        }
    }
}

@Composable
private fun Hero(explore: (String) -> Unit) {
    Box(Modifier.padding(horizontal = 22.dp).fillMaxWidth().height(244.dp).clip(RoundedCornerShape(24.dp))) {
        Image(painterResource(R.drawable.jipiro_cover), "Parque Jipiro, Loja", Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
        Box(Modifier.fillMaxSize().background(Brush.horizontalGradient(listOf(Color(0xEF092F5F), Color(0x40103E6C)))))
        Column(Modifier.padding(22.dp).align(Alignment.CenterStart)) {
            Text("LOJA SE VIVE", fontSize = 10.sp, color = Color(0xFFA7D8FF), fontWeight = FontWeight.Bold)
            Text("Tu próxima historia\nempieza aquí.", fontSize = 28.sp, lineHeight = 32.sp, color = Color.White, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 9.dp, bottom = 17.dp))
            Button(onClick = { explore("all") }, colors = ButtonDefaults.buttonColors(containerColor = Color.White, contentColor = Blue), shape = RoundedCornerShape(12.dp)) { Text("Descubrir lugares", fontSize = 12.sp, fontWeight = FontWeight.Bold); Spacer(Modifier.width(10.dp)); Icon(Icons.AutoMirrored.Filled.ArrowForward, null, Modifier.size(17.dp)) }
        }
        Text("Fotografía: Geovanny Muñoz", color = Color.White, fontSize = 9.sp, modifier = Modifier.align(Alignment.BottomEnd).padding(10.dp))
    }
}

@Composable
private fun ExploreScreen(state: PlacesState, onlySaved: Boolean, query: String, category: String, onQuery: (String) -> Unit, onCategory: (String) -> Unit, detail: (Place) -> Unit, favourite: (String) -> Unit, signedIn: Boolean, retry: () -> Unit) {
    val places = remember(state.places, state.favourites, query, category, onlySaved) { state.places.filter { PlacePolicy.matches(it, query, if (onlySaved) "all" else category) && (!onlySaved || it.id in state.favourites) } }
    LazyColumn(contentPadding = PaddingValues(horizontal = 22.dp, vertical = 16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item {
            Column {
                Eyebrow(if (onlySaved) "TUS LUGARES, A MANO" else "ENCUENTRA TU PRÓXIMA PARADA")
                Text(if (onlySaved) "Tus favoritos" else "Explora Loja", fontSize = 29.sp, fontWeight = FontWeight.ExtraBold, modifier = Modifier.padding(top = 5.dp, bottom = 17.dp))
                OutlinedTextField(value = query, onValueChange = onQuery, modifier = Modifier.fillMaxWidth(), placeholder = { Text("Busca por nombre o categoría", fontSize = 13.sp) }, leadingIcon = { Icon(Icons.Default.Search, null, tint = Blue) }, trailingIcon = { if (query.isNotEmpty()) IconButton(onClick = { onQuery("") }) { Icon(Icons.Default.Close, "Borrar búsqueda") } }, singleLine = true, shape = RoundedCornerShape(16.dp))
                if (onlySaved) Text(if (signedIn) "Usas los mismos favoritos que en VisitaLoja.com." else "Guardados en este teléfono. Ingresa en Mi cuenta para consultar tus favoritos de la web.", fontSize = 12.sp, color = Muted, modifier = Modifier.padding(top = 12.dp))
            }
        }
        if (!onlySaved) item {
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                (listOf(Category("all", "Todo", Icons.Default.Explore)) + categories).forEach { choice -> FilterChip(selected = category == choice.id, onClick = { onCategory(choice.id) }, label = { Text(choice.name) }) }
            }
        }
        if (state.loading && state.places.isEmpty()) item { LoadingPlaces() }
        else if (state.error != null) item { ErrorPlaces(state.error, retry) }
        else if (places.isEmpty()) item {
            Column(Modifier.fillMaxWidth().padding(vertical = 28.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(if (onlySaved) Icons.Default.FavoriteBorder else Icons.Default.Search, null, Modifier.size(40.dp), tint = Blue)
                Text(if (onlySaved) "Tu próxima visita empieza guardando un lugar" else "Probemos otra búsqueda", fontSize = 18.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 14.dp))
                Text(if (onlySaved) "Toca el corazón de una parada para encontrarla aquí." else "No hay lugares publicados con esos filtros.", textAlign = TextAlign.Center, color = Muted, modifier = Modifier.padding(top = 9.dp))
                if (!onlySaved) TextButton(onClick = { onQuery(""); onCategory("all") }) { Text("Ver todos los lugares") }
            }
        } else {
            item { Text(if (places.size == 1) "1 lugar para descubrir" else "${places.size} lugares para descubrir", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = Muted) }
            items(places, key = Place::id) { place -> PlaceCard(place, place.id in state.favourites, { detail(place) }, { favourite(place.id) }, Modifier.fillMaxWidth()) }
        }
    }
}

@Composable
private fun PlaceImage(place: Place, modifier: Modifier = Modifier) {
    when (place.imageUrl) {
        "https://i.imgur.com/CpCnMpw.png" -> Image(painterResource(R.drawable.codeproim_logo), place.title, modifier.background(Pale), contentScale = ContentScale.Fit)
        null -> Image(painterResource(R.drawable.visitaloja_logo), place.title, modifier.background(Pale).padding(28.dp), contentScale = ContentScale.Fit)
        else -> AsyncImage(model = place.imageUrl, contentDescription = place.title, modifier = modifier.background(Pale), contentScale = ContentScale.Crop, error = painterResource(R.drawable.visitaloja_logo), placeholder = painterResource(R.drawable.visitaloja_logo))
    }
}

@Composable
private fun PlaceCard(place: Place, saved: Boolean, open: () -> Unit, favourite: () -> Unit, modifier: Modifier = Modifier, compact: Boolean = false) {
    OutlinedCard(modifier = modifier, shape = RoundedCornerShape(20.dp), colors = CardDefaults.outlinedCardColors(containerColor = Color.White)) {
        Box {
            Column(Modifier.clickable(onClick = open)) {
                Box(Modifier.fillMaxWidth().height(if (compact) 140.dp else 183.dp)) {
                    PlaceImage(place, Modifier.fillMaxSize())
                    Surface(Modifier.align(Alignment.BottomStart).padding(12.dp), color = Color.White.copy(alpha = .96f), shape = RoundedCornerShape(8.dp)) { Text(place.categoryLabel, fontSize = 10.sp, color = Blue, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 9.dp, vertical = 4.dp)) }
                }
                Column(Modifier.padding(16.dp)) { Text(place.title, fontWeight = FontWeight.Bold, fontSize = if (compact) 16.sp else 18.sp, maxLines = 2, overflow = TextOverflow.Ellipsis); Text(place.address.ifBlank { "Loja, Ecuador" }, color = Muted, fontSize = 12.sp, maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 5.dp)) }
            }
            Surface(Modifier.align(Alignment.TopEnd).padding(8.dp), shape = CircleShape, color = Color.White.copy(alpha = .96f)) { IconButton(onClick = favourite) { Icon(if (saved) Icons.Default.Favorite else Icons.Default.FavoriteBorder, if (saved) "Quitar ${place.title} de favoritos" else "Guardar ${place.title} en favoritos", tint = Blue) } }
        }
    }
}

@Composable
private fun PlaceDetail(place: Place, saved: Boolean, favourite: () -> Unit, dismiss: () -> Unit) {
    val context = LocalContext.current
    Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).navigationBarsPadding()) {
        Box(Modifier.fillMaxWidth().height(220.dp)) { PlaceImage(place, Modifier.fillMaxSize()); FilledIconButton(onClick = dismiss, modifier = Modifier.align(Alignment.TopEnd).padding(12.dp), colors = IconButtonDefaults.filledIconButtonColors(containerColor = Color.White, contentColor = Ink)) { Icon(Icons.Default.Close, "Cerrar ficha") } }
        Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text(place.categoryLabel, color = Blue, fontWeight = FontWeight.Bold, fontSize = 12.sp)
            Text(place.title, fontSize = 28.sp, fontWeight = FontWeight.Bold, lineHeight = 33.sp)
            if (place.address.isNotBlank()) Text(place.address, color = Blue, fontSize = 13.sp)
            if (place.description.isNotBlank()) Text(place.description, color = Muted, fontSize = 14.sp, lineHeight = 23.sp)
            Button(onClick = favourite, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(13.dp)) { Icon(if (saved) Icons.Default.Favorite else Icons.Default.FavoriteBorder, null); Spacer(Modifier.width(9.dp)); Text(if (saved) "Guardado en favoritos" else "Guardar en favoritos") }
            if (place.address.isNotBlank() || place.latitude != null && place.longitude != null) OutlinedButton(onClick = {
                val destination = if (place.latitude != null && place.longitude != null) "${place.latitude},${place.longitude}" else place.address + ", Loja, Ecuador"
                val uri = Uri.parse("geo:0,0?q=" + Uri.encode(destination))
                try { context.startActivity(Intent(Intent.ACTION_VIEW, uri)) } catch (_: ActivityNotFoundException) { Toast.makeText(context, "No hay una aplicación de mapas disponible.", Toast.LENGTH_LONG).show() }
            }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(13.dp)) { Icon(Icons.Default.Directions, null); Spacer(Modifier.width(9.dp)); Text("Cómo llegar") }
            Text("Información publicada por VisitaLoja. Confirma los horarios y condiciones con el negocio antes de tu visita.", color = Muted, fontSize = 11.sp)
        }
    }
}

@Composable
private fun SectionHeading(title: String, action: String, click: () -> Unit) {
    Row(Modifier.fillMaxWidth().padding(bottom = 10.dp), verticalAlignment = Alignment.CenterVertically) { Text(title, fontSize = 19.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f)); TextButton(onClick = click) { Text(action, fontSize = 12.sp, fontWeight = FontWeight.Bold) } }
}
@Composable
private fun Eyebrow(value: String) { Text(value, fontSize = 9.sp, fontWeight = FontWeight.Bold, color = Color(0xFF64829E)) }
@Composable
private fun LoadingPlaces() { Column(Modifier.fillMaxWidth().padding(28.dp), horizontalAlignment = Alignment.CenterHorizontally) { CircularProgressIndicator(Modifier.size(28.dp), strokeWidth = 3.dp); Text("Buscando lugares para ti…", color = Muted, modifier = Modifier.padding(top = 14.dp)) } }
@Composable
private fun ErrorPlaces(message: String, retry: () -> Unit) { Column(Modifier.fillMaxWidth().padding(vertical = 18.dp), horizontalAlignment = Alignment.CenterHorizontally) { Icon(Icons.Default.CloudOff, null, tint = Blue); Text(message, textAlign = TextAlign.Center, color = Muted, modifier = Modifier.padding(vertical = 14.dp)); Button(onClick = retry) { Text("Volver a intentar") } } }
