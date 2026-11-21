package com.visitaloja.app

import android.app.DatePickerDialog
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import java.time.LocalDate
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import java.time.Instant
import java.time.format.DateTimeFormatter
import java.util.Locale

private fun eventDate(event: LojaEvent, english: Boolean = false) = Instant.ofEpochMilli(event.start).atZone(AgendaPolicy.zone)
    .format(DateTimeFormatter.ofPattern("EEE d MMM · HH:mm", Locale.forLanguageTag(if (english) "en-US" else "es-EC")))

@Composable
fun HomeAgenda(state: AgendaState, open: () -> Unit, detail: (String) -> Unit, english: Boolean = false) {
    val next = AgendaPolicy.upcoming(state.events, state.now).firstOrNull()
    Column(Modifier.padding(horizontal=18.dp).testTag("home-agenda"),verticalArrangement=Arrangement.spacedBy(10.dp)) {
        Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically) {
            Text(if (english) "What’s on in Loja" else "Qué pasa en Loja",fontSize=20.sp,fontWeight=FontWeight.Bold,modifier=Modifier.weight(1f))
            TextButton(onClick=open){Text(if (english) "See agenda" else "Ver agenda",fontSize=12.sp)}
        }
        OutlinedCard(onClick={if(next==null)open() else detail(next.id)},modifier=Modifier.fillMaxWidth(),shape=RoundedCornerShape(16.dp),colors=CardDefaults.outlinedCardColors(containerColor=Color.White)) {
            if(next==null) Row(Modifier.padding(16.dp),horizontalArrangement=Arrangement.spacedBy(12.dp),verticalAlignment=Alignment.CenterVertically) {
                Icon(Icons.Default.Event,null,tint=MaterialTheme.colorScheme.primary)
                Column(Modifier.weight(1f)) { Text(if (english) "Loja events" else "Agenda de Loja",fontWeight=FontWeight.Bold);Text(if (english) { if (state.loading) "Checking the schedule…" else if (state.error) "Try again to see published events." else "The next published event will appear here." } else if(state.loading)"Consultando la programación…" else if(state.error)"Reintenta para consultar los eventos publicados." else "Aquí aparecerá el próximo evento publicado.",fontSize=12.sp,color=MaterialTheme.colorScheme.onSurfaceVariant) }
            } else Row(Modifier.padding(12.dp),horizontalArrangement=Arrangement.spacedBy(13.dp),verticalAlignment=Alignment.CenterVertically) {
                if(next.image!=null)AsyncImage(next.image,if (english) "Poster for ${next.title}" else "Afiche de ${next.title}",Modifier.width(94.dp).height(132.dp),contentScale=ContentScale.Fit,placeholder=painterResource(R.drawable.visitaloja_logo),error=painterResource(R.drawable.visitaloja_logo))
                Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(7.dp)) {
                    Text(eventDate(next, english),fontSize=11.sp,color=MaterialTheme.colorScheme.primary,fontWeight=FontWeight.Bold)
                    Text(next.title,fontSize=17.sp,fontWeight=FontWeight.Bold,maxLines=3,overflow=TextOverflow.Ellipsis)
                    Text(next.location.ifBlank{next.category},fontSize=12.sp,color=MaterialTheme.colorScheme.onSurfaceVariant,maxLines=2,overflow=TextOverflow.Ellipsis)
                    Text(if (english) "View details →" else "Ver detalles →",fontSize=12.sp,color=MaterialTheme.colorScheme.primary)
                }
            }
        }
        if(state.cached&&next!=null)Text(if (english) "Saved schedule; refresh to confirm changes." else "Programación guardada; actualiza para confirmar cambios.",fontSize=11.sp,color=MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
fun AgendaScreen(state: AgendaState, detail: (String) -> Unit, retry: () -> Unit, english: Boolean = false) {
    var query by rememberSaveable { mutableStateOf("") }
    var period by rememberSaveable { mutableStateOf("all") }
    var dateSelection by rememberSaveable { mutableStateOf<String?>(null) }
    val selectedDate = dateSelection?.let { runCatching { LocalDate.parse(it) }.getOrNull() }
    val today = Instant.ofEpochMilli(state.now).atZone(AgendaPolicy.zone).toLocalDate()
    val context = LocalContext.current
    val events = AgendaPolicy.filter(state.events, state.now, period, query, selectedDate)
    val days = events.groupBy { Instant.ofEpochMilli(it.start).atZone(AgendaPolicy.zone).toLocalDate() }
    LazyColumn(contentPadding = PaddingValues(22.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item {
            Text((if (english) "EXPERIENCE LOJA" else "PLANES PARA VIVIR LOJA"), fontSize = 11.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
            Text((if (english) "Your next outing" else "Tu próxima salida"), fontSize = 29.sp, fontWeight = FontWeight.ExtraBold, modifier = Modifier.padding(top = 8.dp))
            Text((if (english) "Music, culture, food and gatherings in the city." else "Música, cultura, gastronomía y encuentros en la ciudad."), fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp))
        }
        item { OutlinedTextField(value = query, onValueChange = { query = it }, modifier = Modifier.fillMaxWidth(), singleLine = true,
            label = { Text((if (english) "Search events or venues" else "Busca un evento o lugar")) }, leadingIcon = { Icon(Icons.Default.Search, null) },
            trailingIcon = { if (query.isNotBlank()) IconButton(onClick = { query = "" }) { Icon(Icons.Default.Close, (if (english) "Clear search" else "Borrar búsqueda")) } }, shape = RoundedCornerShape(16.dp)) }
        item { Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("all" to (if (english) "Upcoming" else "Próximos"), "today" to (if (english) "Today" else "Hoy"), "tomorrow" to (if (english) "Tomorrow" else "Mañana"), "week" to (if (english) "7 days" else "7 días")).forEach { (id, label) ->
                FilterChip(selected = selectedDate == null && period == id, onClick = { period = id; dateSelection = null }, modifier = Modifier.testTag("agenda-period-$id"), label = { Text(label) })
            }
        } }
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                OutlinedButton(onClick = {
                    val initial = selectedDate ?: today
                    val localized = android.view.ContextThemeWrapper(context, context.theme)
                    localized.applyOverrideConfiguration(android.content.res.Configuration(context.resources.configuration).apply {
                        setLocale(Locale.forLanguageTag(if (english) "en-US" else "es-EC"))
                    })
                    DatePickerDialog(localized, { _, year, month, day -> dateSelection = LocalDate.of(year, month + 1, day).toString() }, initial.year, initial.monthValue - 1, initial.dayOfMonth).show()
                }, modifier = Modifier.weight(1f).testTag("agenda-choose-date")) {
                    Icon(Icons.Default.CalendarMonth, null); Spacer(Modifier.width(8.dp))
                    Text(selectedDate?.format(DateTimeFormatter.ofPattern("d MMM yyyy", Locale.forLanguageTag(if (english) "en-US" else "es-EC"))) ?: (if (english) "Choose a date" else "Elegir fecha"))
                }
                if (selectedDate != null) IconButton(onClick = { dateSelection = null; period = "all" }) { Icon(Icons.Default.Close, (if (english) "Clear selected date" else "Quitar fecha seleccionada")) }
            }
        }
        if (state.cached || state.error) item { Text((if (english) "No recent server confirmation. Refresh and check with the organizer before attending." else "No hay confirmación reciente del servidor. Actualiza y confirma con el organizador antes de asistir."), fontSize = 12.sp, color = MaterialTheme.colorScheme.error) }
        if (state.loading) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
        if (state.error) item { OutlinedButton(onClick = retry) { Text((if (english) "Try again" else "Reintentar consulta")) } }
        if (events.isEmpty() && !state.loading && !state.error) item {
            Column(Modifier.padding(vertical = 24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Icon(Icons.Default.EventAvailable, null, Modifier.size(36.dp), tint = MaterialTheme.colorScheme.primary)
                Text((if (english) "A new outing is on its way" else "Un nuevo plan está por llegar"), fontSize = 22.sp, fontWeight = FontWeight.Bold)
                Text(if (query.isNotBlank() || period != "all" || selectedDate != null) (if (english) "No events match these filters. Try another search or browse upcoming events." else "No hay eventos con estos filtros. Prueba otra búsqueda o consulta los próximos.") else (if (english) "No upcoming events have been published yet. Check the schedule again later." else "Todavía no hay próximos eventos publicados. Vuelve a consultar la programación más adelante."), color = MaterialTheme.colorScheme.onSurfaceVariant)
                TextButton(onClick = { query = ""; period = "all"; dateSelection = null; retry() }) { Text((if (english) "Show all and refresh" else "Ver todos y actualizar")) }
            }
        }
        if (events.isNotEmpty()) item { Text("${events.size} ${if (events.size == 1) (if (english) "event" else "evento") else (if (english) "events" else "eventos")}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        days.forEach { (date, dayEvents) ->
            item(key = "day-$date") {
                val label = when (date) { today -> (if (english) "Today" else "Hoy"); today.plusDays(1) -> (if (english) "Tomorrow" else "Mañana"); else -> date.format(DateTimeFormatter.ofPattern("EEEE", Locale.forLanguageTag(if (english) "en-US" else "es-EC"))) }
                Text("$label · ${date.format(DateTimeFormatter.ofPattern("d MMM yyyy", Locale.forLanguageTag(if (english) "en-US" else "es-EC")))}", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(top = 8.dp).testTag("agenda-day-$date"))
            }
            items(dayEvents, key = { "event-${it.id}" }) { event -> EventCard(event, { detail(event.id) }, Modifier.fillMaxWidth(), english) }
        }
        item { Text((if (english) "Dates and times in Loja, Ecuador." else "Fechas y horas de Loja, Ecuador."), fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
    }
}

@Composable
private fun EventCard(event: LojaEvent, open: () -> Unit, modifier: Modifier, english: Boolean = false) {
    OutlinedCard(onClick = open, modifier = modifier, shape = RoundedCornerShape(20.dp)) {
        if (event.image != null) AsyncImage(model = event.image, contentDescription = (if (english) "Poster for ${event.title}" else "Afiche de ${event.title}"), modifier = Modifier.fillMaxWidth().height(180.dp), contentScale = ContentScale.Fit, placeholder = painterResource(R.drawable.visitaloja_logo), error = painterResource(R.drawable.visitaloja_logo))
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Text(eventDate(event, english), fontSize = 12.sp, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
            Text(event.title, fontSize = 19.sp, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text(event.category + if (event.location.isNotBlank()) " · ${event.location}" else "", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text((if (english) "View details →" else "Ver detalles →"), color = MaterialTheme.colorScheme.primary, fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
fun EventDetail(event: LojaEvent, english: Boolean = false) {
    var posterOpen by rememberSaveable(event.id) { mutableStateOf(false) }
    if (posterOpen && event.image != null) Dialog(onDismissRequest = { posterOpen = false }, properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
        Surface(color = Color(0xFF10243A), modifier = Modifier.fillMaxSize()) {
            Column(Modifier.fillMaxSize().systemBarsPadding().padding(12.dp)) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text(event.title, color = Color.White, modifier = Modifier.weight(1f), maxLines = 2, overflow = TextOverflow.Ellipsis)
                    IconButton(onClick = { posterOpen = false }) { Icon(Icons.Default.Close, (if (english) "Close poster" else "Cerrar afiche"), tint = Color.White) }
                }
                AsyncImage(model = event.image, contentDescription = (if (english) "Full poster for ${event.title}" else "Afiche completo de ${event.title}"), modifier = Modifier.weight(1f).fillMaxWidth().testTag("event-poster-fullscreen"), contentScale = ContentScale.Fit, error = painterResource(R.drawable.visitaloja_logo), placeholder = painterResource(R.drawable.visitaloja_logo))
            }
        }
    }
    val context = LocalContext.current
    fun open(intent: Intent) { try { context.startActivity(intent) } catch (_: ActivityNotFoundException) { Toast.makeText(context, (if (english) "No compatible app is available." else "No hay una aplicación compatible disponible."), Toast.LENGTH_LONG).show() } }
    LazyColumn(contentPadding = PaddingValues(22.dp), verticalArrangement = Arrangement.spacedBy(16.dp), modifier = Modifier.navigationBarsPadding()) {
        if (event.image != null) item {
            Column {
                AsyncImage(model = event.image, contentDescription = (if (english) "Enlarge poster for ${event.title}" else "Ampliar afiche de ${event.title}"), modifier = Modifier.fillMaxWidth().height(360.dp).clickable { posterOpen = true }.testTag("event-poster-expand"), contentScale = ContentScale.Fit, error = painterResource(R.drawable.visitaloja_logo), placeholder = painterResource(R.drawable.visitaloja_logo))
                TextButton(onClick = { posterOpen = true }) { Icon(Icons.Default.ZoomIn, null); Spacer(Modifier.width(6.dp)); Text((if (english) "View full poster" else "Ver afiche completo")) }
            }
        }
        item { Text(event.category, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold); Text(event.title, fontSize = 28.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 6.dp)) }
        item { Text(eventDate(event, english), fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary); Text((if (english) "Loja, Ecuador time" else "Hora de Loja, Ecuador"), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        if (event.location.isNotBlank()) item { Text(event.location) }
        if (event.description.isNotBlank()) item { Text(event.description, lineHeight = 23.sp) }
        if (event.location.isNotBlank() || event.latitude != null && event.longitude != null) item { Button(onClick = {
            val destination = if (event.latitude != null && event.longitude != null) "${event.latitude},${event.longitude}" else "${event.location}, Loja, Ecuador"
            open(Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=" + Uri.encode(destination))))
        }, modifier = Modifier.fillMaxWidth()) { Icon(Icons.Default.Directions, null); Spacer(Modifier.width(8.dp)); Text((if (english) "Get directions" else "Cómo llegar")) } }
        item { OutlinedButton(onClick = { EventActions.calendar(context, event.title, event.description + "\nhttps://www.visitaloja.com/#agenda", event.location, event.start, english = english) }, modifier = Modifier.fillMaxWidth()) {
            Icon(Icons.Default.CalendarMonth, null); Spacer(Modifier.width(8.dp)); Text((if (english) "Add to calendar" else "Añadir al calendario"))
        } }
        item { OutlinedButton(onClick = {
            val send = Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_SUBJECT, event.title); putExtra(Intent.EXTRA_TEXT, EventActionPolicy.share(event.title, event.start, event.location, "https://www.visitaloja.com/#agenda", english)) }
            open(Intent.createChooser(send, (if (english) "Share event" else "Compartir evento")))
        }, modifier = Modifier.fillMaxWidth()) { Icon(Icons.Default.Share, null); Spacer(Modifier.width(8.dp)); Text((if (english) "Share event" else "Compartir evento")) } }
        item { Text((if (english) "Confirm availability, changes and conditions with the organizer before attending." else "Confirma disponibilidad, cambios y condiciones con el organizador antes de asistir."), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
    }
}
