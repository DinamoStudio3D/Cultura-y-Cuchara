package com.visitaloja.app

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.repeatOnLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalTime

@OptIn(ExperimentalComposeUiApi::class)
@Composable
internal fun BusinessMenuEntry(place: Place) {
    val model: BusinessMenuViewModel = viewModel(key = "business-menu")
    val state by model.state.collectAsStateWithLifecycle()
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    DisposableEffect(place.id, lifecycle) {
        fun bind() = model.bind(if (lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)) place.id else null)
        val observer = LifecycleEventObserver { _, _ -> bind() }
        lifecycle.addObserver(observer);bind()
        onDispose { lifecycle.removeObserver(observer);model.bind(null) }
    }
    val now by produceState(System.currentTimeMillis(), lifecycle) {
        lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            while (isActive) { value = System.currentTimeMillis();delay(1000) }
        }
    }
    var menuOpen by remember(place.id) { mutableStateOf(false) }
    var request by remember(place.id) { mutableStateOf<BusinessRequest?>(null) }
    var english by remember(place.id) { mutableStateOf(false) }
    if (state.id != place.id) return
    val content = state.source
    if (content.loading) { LinearProgressIndicator(Modifier.fillMaxWidth());return }
    if (content.error || content.cached) {
        Text("Conéctate para consultar la carta y las opciones actuales del negocio.", fontSize = 12.sp)
        TextButton(onClick = { model.bind(place.id, true) }) { Text("Actualizar carta y pedidos") }
        return
    }
    val catalogue = model.current(now) ?: return
    val enabled = catalogue.dishes.isNotEmpty() || catalogue.orders || catalogue.reservations
    if (!enabled) return
    Column(Modifier.fillMaxWidth().semantics { testTagsAsResourceId = true }.testTag("business-commerce"), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (catalogue.dishes.isNotEmpty()) OutlinedButton(onClick = { menuOpen = true }, modifier = Modifier.fillMaxWidth().testTag("open-business-menu")) {
            Icon(Icons.Default.RestaurantMenu, null);Spacer(Modifier.width(8.dp));Text("Ver productos destacados · ${catalogue.dishes.size}")
        }
        if (catalogue.orders) Button(onClick = { request = BusinessRequest(english = english) }, modifier = Modifier.fillMaxWidth().testTag("business-order")) { Text("Pedir al negocio") }
        if (catalogue.reservations) OutlinedButton(onClick = { request = BusinessRequest(reservation = true, english = english) }, modifier = Modifier.fillMaxWidth().testTag("business-reserve")) { Text("Reservar una mesa") }
    }
    if (menuOpen && catalogue.dishes.isNotEmpty()) BusinessMenuDialog(catalogue, english, { english = it }, { menuOpen = false }) { dish -> request = BusinessRequest(dish = dish.key, english = english) }
    request?.let { draft ->
        val stillAvailable = if (draft.reservation) catalogue.reservations else catalogue.orders && (draft.dish == null || catalogue.dishes.any { it.key == draft.dish && it.available })
        if (stillAvailable) BusinessRequestDialog(catalogue, draft, now, model, { request = null })
        else LaunchedEffect(draft) { request = null }
    }
}

@OptIn(ExperimentalComposeUiApi::class)
@Composable
private fun BusinessDialog(title: String, tag: String, close: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    Dialog(onDismissRequest = close, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(color = Color(0xFFF0F7FF), modifier = Modifier.fillMaxSize().semantics { testTagsAsResourceId = true }.testTag(tag)) {
            Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding()) {
                Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(title, modifier = Modifier.weight(1f), fontSize = 20.sp, fontWeight = FontWeight.Bold)
                    IconButton(onClick = close) { Icon(Icons.Default.Close, "Cerrar $title") }
                }
                content()
            }
        }
    }
}

@Composable
private fun BusinessMenuDialog(menu: BusinessCatalogue, english: Boolean, language: (Boolean) -> Unit, close: () -> Unit, order: (BusinessDish) -> Unit) {
    var query by remember(menu.id) { mutableStateOf("") }
    var category by remember(menu.id, english) { mutableStateOf("") }
    val dishes = BusinessMenuPolicy.filter(menu.dishes, query, category, english)
    BusinessDialog(if (english) menu.menuTitleEn.ifBlank { menu.menuTitle } else menu.menuTitle, "business-menu-screen", close) {
        LazyColumn(Modifier.weight(1f).fillMaxWidth(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            item {
                Text(if (english) menu.titleEn.ifBlank { menu.title } else menu.title, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                Text(if (english) "Published prices. Confirm availability and conditions with the business." else "Precios publicados. Confirma disponibilidad y condiciones con el negocio.", fontSize = 12.sp, modifier = Modifier.padding(top = 6.dp))
                TextButton(onClick = { language(!english) }, modifier = Modifier.testTag("business-menu-language")) { Text(if (english) "Español" else "English") }
                OutlinedTextField(query, { query = it.take(120) }, modifier = Modifier.fillMaxWidth().testTag("business-menu-search"), singleLine = true, label = { Text(if (english) "Search products" else "Buscar productos") }, leadingIcon = { Icon(Icons.Default.Search, null) })
            }
            item {
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    (listOf("") + menu.dishes.map { BusinessMenuPolicy.category(it, english) }.distinct()).forEach { choice ->
                        FilterChip(category == choice, { category = choice }, { Text(choice.ifBlank { if (english) "All" else "Todos" }) })
                    }
                }
            }
            if (dishes.isEmpty()) item { Text(if (english) "No products match this search." else "No hay productos que coincidan con la búsqueda.") }
            items(dishes, key = { it.key }) { dish ->
                Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(20.dp), modifier = Modifier.testTag("business-dish-${dish.key}")) {
                    Column(Modifier.fillMaxWidth().padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        dish.image?.let { AsyncImage(it, null, Modifier.fillMaxWidth().height(180.dp), contentScale = ContentScale.Fit) }
                        Text(if (english) dish.nameEn.ifBlank { dish.name } else dish.name, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                        Text(dish.price, color = MaterialTheme.colorScheme.primary, fontSize = 19.sp, fontWeight = FontWeight.Bold)
                        val description = if (english) dish.descriptionEn.ifBlank { dish.description } else dish.description
                        if (description.isNotBlank()) Text(description, lineHeight = 23.sp)
                        if (dish.tags.isNotEmpty()) Text(dish.tags.joinToString(" · "), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        if (!dish.available) Text(if (english) "Currently unavailable" else "No disponible por ahora", color = MaterialTheme.colorScheme.error)
                        if (menu.orders) Button(onClick = { order(dish) }, enabled = dish.available, modifier = Modifier.fillMaxWidth()) { Text(if (english) "Ask for this product" else "Pedir este producto") }
                    }
                }
            }
        }
    }
}

@Composable
private fun BusinessRequestDialog(menu: BusinessCatalogue, initial: BusinessRequest, now: Long, model: BusinessMenuViewModel, close: () -> Unit) {
    var request by remember(menu.id, initial) { mutableStateOf(initial) }
    var preview by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val scope = rememberCoroutineScope()
    LaunchedEffect(menu) { preview = null }
    fun edit(next: BusinessRequest) { if (!busy) { request = next;preview = null;error = null } }
    val heading = if (request.reservation) "Solicitar reserva" else "Preparar pedido"
    BusinessDialog(heading, "business-request-screen", close) {
        Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text(menu.title, fontSize = 24.sp, fontWeight = FontWeight.ExtraBold)
            Text("El negocio confirmará disponibilidad, precio final y condiciones por WhatsApp.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (request.reservation) {
                OutlinedButton(onClick = {
                    val today = LocalDate.now(BusinessMenuPolicy.zone)
                    val selected = runCatching { LocalDate.parse(request.date) }.getOrDefault(today.plusDays(1))
                    DatePickerDialog(context, { _, year, month, day -> edit(request.copy(date = LocalDate.of(year, month + 1, day).toString())) }, selected.year, selected.monthValue - 1, selected.dayOfMonth).show()
                }, modifier = Modifier.fillMaxWidth().testTag("business-reservation-date")) { Text(request.date.ifBlank { "Seleccionar fecha" }) }
                OutlinedButton(onClick = {
                    val selected = runCatching { LocalTime.parse(request.time) }.getOrDefault(LocalTime.of(19, 0))
                    TimePickerDialog(context, { _, hour, minute -> edit(request.copy(time = String.format(java.util.Locale.ROOT, "%02d:%02d", hour, minute))) }, selected.hour, selected.minute, true).show()
                }, modifier = Modifier.fillMaxWidth().testTag("business-reservation-time")) { Text(request.time.ifBlank { "Seleccionar hora (Ecuador)" }) }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("${request.guests} personas", Modifier.weight(1f))
                    OutlinedButton(onClick = { edit(request.copy(guests = request.guests - 1)) }, enabled = !busy && request.guests > 1) { Text("−") }
                    Spacer(Modifier.width(8.dp));OutlinedButton(onClick = { edit(request.copy(guests = request.guests + 1)) }, enabled = !busy && request.guests < 30) { Text("+") }
                }
            } else menu.dishes.find { it.key == request.dish }?.let { dish ->
                Text(dish.name, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Text("Precio publicado: ${dish.price}")
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Cantidad: ${request.quantity}", Modifier.weight(1f))
                    OutlinedButton(onClick = { edit(request.copy(quantity = request.quantity - 1)) }, enabled = !busy && request.quantity > 1) { Text("−") }
                    Spacer(Modifier.width(8.dp));OutlinedButton(onClick = { edit(request.copy(quantity = request.quantity + 1)) }, enabled = !busy && request.quantity < 20) { Text("+") }
                }
            }
            OutlinedTextField(request.notes, { edit(request.copy(notes = it.take(1000))) }, modifier = Modifier.fillMaxWidth().testTag("business-request-notes"), label = { Text(if (request.reservation) "Indicaciones o necesidades (opcional)" else "¿Qué deseas pedir? Indicaciones") }, minLines = 3, maxLines = 6, enabled = !busy)
            Row(verticalAlignment = Alignment.CenterVertically) { Checkbox(request.english, { edit(request.copy(english = it)) }, enabled = !busy);Text("Preparar el mensaje en inglés") }
            error?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.testTag("business-request-error")) }
            if (preview == null) Button(onClick = {
                error = BusinessMenuPolicy.error(menu, request, System.currentTimeMillis())
                if (error == null) preview = BusinessMenuPolicy.message(menu, request)
            }, enabled = !busy, modifier = Modifier.fillMaxWidth().testTag("business-request-preview")) { Text("Revisar mensaje") }
            preview?.let { message ->
                Surface(color = Color.White, shape = RoundedCornerShape(16.dp)) { Text(message, Modifier.padding(18.dp).testTag("business-message-preview"), lineHeight = 24.sp) }
                Text("Se abrirá el chat con ${menu.phone}. El mensaje se envía cuando tú lo confirmes en WhatsApp.", fontSize = 12.sp)
                Button(onClick = {
                    if (!busy) scope.launch {
                        busy = true;error = null
                        val submitted = request
                        try {
                            val valid = model.verify(menu, submitted.dish != null)
                            val current = model.current(System.currentTimeMillis())
                            if (!valid || current != menu || request != submitted || BusinessMenuPolicy.message(menu, submitted) != message) { preview = null;error = "La información del negocio cambió. Revisa las opciones y prepara el mensaje de nuevo." }
                            else {
                                error = BusinessMenuPolicy.error(current, submitted, System.currentTimeMillis())
                                if (error == null && lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)) {
                                    val url = "https://wa.me/${current.phone}?text=" + Uri.encode(message)
                                    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                                    close()
                                }
                            }
                        } catch (cancelled: CancellationException) { throw cancelled }
                        catch (_: ActivityNotFoundException) { error = "No hay una aplicación disponible para abrir WhatsApp." }
                        catch (_: Exception) { error = "Conéctate para verificar la información actual del negocio y vuelve a intentar." }
                        finally { busy = false }
                    }
                }, enabled = !busy && BusinessMenuPolicy.error(menu, request, now) == null, modifier = Modifier.fillMaxWidth().testTag("business-open-whatsapp")) { Text(if (busy) "Comprobando…" else "Abrir WhatsApp con este mensaje") }
                TextButton(onClick = { preview = null }, enabled = !busy) { Text("Editar mensaje") }
            }
        }
    }
}
