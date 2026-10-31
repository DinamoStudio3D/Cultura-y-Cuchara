package com.visitaloja.app

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

private fun eventDate(event: LojaEvent) = Instant.ofEpochMilli(event.start).atZone(AgendaPolicy.zone)
    .format(DateTimeFormatter.ofPattern("EEE d MMM · HH:mm", Locale.forLanguageTag("es-EC")))

@Composable
fun HomeAgenda(state: AgendaState, open: () -> Unit, detail: (String) -> Unit) {
    val next = AgendaPolicy.upcoming(state.events, state.now).firstOrNull()
    Column(Modifier.padding(horizontal=18.dp).testTag("home-agenda"),verticalArrangement=Arrangement.spacedBy(10.dp)) {
        Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically) {
            Text("Qué pasa en Loja",fontSize=20.sp,fontWeight=FontWeight.Bold,modifier=Modifier.weight(1f))
            TextButton(onClick=open){Text("Ver agenda",fontSize=12.sp)}
        }
        OutlinedCard(onClick={if(next==null)open() else detail(next.id)},modifier=Modifier.fillMaxWidth(),shape=RoundedCornerShape(16.dp),colors=CardDefaults.outlinedCardColors(containerColor=Color.White)) {
            if(next==null) Row(Modifier.padding(16.dp),horizontalArrangement=Arrangement.spacedBy(12.dp),verticalAlignment=Alignment.CenterVertically) {
                Icon(Icons.Default.Event,null,tint=MaterialTheme.colorScheme.primary)
                Column(Modifier.weight(1f)) { Text("Agenda de Loja",fontWeight=FontWeight.Bold);Text(if(state.loading)"Consultando la programación…" else if(state.error)"Reintenta para consultar los eventos publicados." else "Aquí aparecerá el próximo evento publicado.",fontSize=12.sp,color=MaterialTheme.colorScheme.onSurfaceVariant) }
            } else Row(Modifier.padding(12.dp),horizontalArrangement=Arrangement.spacedBy(13.dp),verticalAlignment=Alignment.CenterVertically) {
                if(next.image!=null)AsyncImage(next.image,"Afiche de ${next.title}",Modifier.width(94.dp).height(132.dp),contentScale=ContentScale.Fit,placeholder=painterResource(R.drawable.visitaloja_logo),error=painterResource(R.drawable.visitaloja_logo))
                Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(7.dp)) {
                    Text(eventDate(next),fontSize=11.sp,color=MaterialTheme.colorScheme.primary,fontWeight=FontWeight.Bold)
                    Text(next.title,fontSize=17.sp,fontWeight=FontWeight.Bold,maxLines=3,overflow=TextOverflow.Ellipsis)
                    Text(next.location.ifBlank{next.category},fontSize=12.sp,color=MaterialTheme.colorScheme.onSurfaceVariant,maxLines=2,overflow=TextOverflow.Ellipsis)
                    Text("Ver detalles →",fontSize=12.sp,color=MaterialTheme.colorScheme.primary)
                }
            }
        }
        if(state.cached&&next!=null)Text("Programación guardada; actualiza para confirmar cambios.",fontSize=11.sp,color=MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
fun AgendaScreen(state: AgendaState, detail: (String) -> Unit, retry: () -> Unit) {
    var query by rememberSaveable { mutableStateOf("") }
    var period by rememberSaveable { mutableStateOf("all") }
    val events = AgendaPolicy.filter(state.events, state.now, period, query)
    LazyColumn(contentPadding = PaddingValues(22.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item {
            Text("PLANES PARA VIVIR LOJA", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
            Text("Tu próxima salida", fontSize = 29.sp, fontWeight = FontWeight.ExtraBold, modifier = Modifier.padding(top = 8.dp))
            Text("Música, cultura, gastronomía y encuentros en la ciudad.", fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp))
        }
        item { OutlinedTextField(value = query, onValueChange = { query = it }, modifier = Modifier.fillMaxWidth(), singleLine = true,
            label = { Text("Busca un evento o lugar") }, leadingIcon = { Icon(Icons.Default.Search, null) },
            trailingIcon = { if (query.isNotBlank()) IconButton(onClick = { query = "" }) { Icon(Icons.Default.Close, "Borrar búsqueda") } }, shape = RoundedCornerShape(16.dp)) }
        item { Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("all" to "Próximos", "today" to "Hoy", "week" to "7 días").forEach { (id, label) -> FilterChip(selected = period == id, onClick = { period = id }, label = { Text(label) }) }
        } }
        if (state.cached || state.error) item { Text("No hay confirmación reciente del servidor. Actualiza y confirma con el organizador antes de asistir.", fontSize = 12.sp, color = MaterialTheme.colorScheme.error) }
        if (state.loading) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
        if (state.error) item { OutlinedButton(onClick = retry) { Text("Reintentar consulta") } }
        if (events.isEmpty() && !state.loading && !state.error) item {
            Column(Modifier.padding(vertical = 24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Icon(Icons.Default.EventAvailable, null, Modifier.size(36.dp), tint = MaterialTheme.colorScheme.primary)
                Text("Un nuevo plan está por llegar", fontSize = 22.sp, fontWeight = FontWeight.Bold)
                Text(if (query.isNotBlank() || period != "all") "No hay eventos con estos filtros. Prueba otra búsqueda o consulta los próximos." else "Todavía no hay próximos eventos publicados. Vuelve a consultar la programación más adelante.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                TextButton(onClick = { query = ""; period = "all"; retry() }) { Text("Ver todos y actualizar") }
            }
        }
        items(events, key = LojaEvent::id) { event -> EventCard(event, { detail(event.id) }, Modifier.fillMaxWidth()) }
        item { Text("Fechas y horas de Loja, Ecuador.", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
    }
}

@Composable
private fun EventCard(event: LojaEvent, open: () -> Unit, modifier: Modifier) {
    OutlinedCard(onClick = open, modifier = modifier, shape = RoundedCornerShape(20.dp)) {
        if (event.image != null) AsyncImage(model = event.image, contentDescription = "Afiche de ${event.title}", modifier = Modifier.fillMaxWidth().height(180.dp), contentScale = ContentScale.Fit, placeholder = painterResource(R.drawable.visitaloja_logo), error = painterResource(R.drawable.visitaloja_logo))
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Text(eventDate(event), fontSize = 12.sp, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
            Text(event.title, fontSize = 19.sp, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text(event.category + if (event.location.isNotBlank()) " · ${event.location}" else "", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text("Ver detalles →", color = MaterialTheme.colorScheme.primary, fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
fun EventDetail(event: LojaEvent) {
    val context = LocalContext.current
    fun open(intent: Intent) { try { context.startActivity(intent) } catch (_: ActivityNotFoundException) { Toast.makeText(context, "No hay una aplicación compatible disponible.", Toast.LENGTH_LONG).show() } }
    LazyColumn(contentPadding = PaddingValues(22.dp), verticalArrangement = Arrangement.spacedBy(16.dp), modifier = Modifier.navigationBarsPadding()) {
        if (event.image != null) item { AsyncImage(model = event.image, contentDescription = "Afiche de ${event.title}", modifier = Modifier.fillMaxWidth().height(360.dp), contentScale = ContentScale.Fit, error = painterResource(R.drawable.visitaloja_logo), placeholder = painterResource(R.drawable.visitaloja_logo)) }
        item { Text(event.category, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold); Text(event.title, fontSize = 28.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 6.dp)) }
        item { Text(eventDate(event), fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary); Text("Hora de Loja, Ecuador", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        if (event.location.isNotBlank()) item { Text(event.location) }
        if (event.description.isNotBlank()) item { Text(event.description, lineHeight = 23.sp) }
        if (event.location.isNotBlank() || event.latitude != null && event.longitude != null) item { Button(onClick = {
            val destination = if (event.latitude != null && event.longitude != null) "${event.latitude},${event.longitude}" else "${event.location}, Loja, Ecuador"
            open(Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=" + Uri.encode(destination))))
        }, modifier = Modifier.fillMaxWidth()) { Icon(Icons.Default.Directions, null); Spacer(Modifier.width(8.dp)); Text("Cómo llegar") } }
        item { OutlinedButton(onClick = {
            val send = Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_SUBJECT, event.title); putExtra(Intent.EXTRA_TEXT, "${event.title}\n${eventDate(event)} · Hora de Loja\n${event.location}\nhttps://www.visitaloja.com/#agenda") }
            open(Intent.createChooser(send, "Compartir evento"))
        }, modifier = Modifier.fillMaxWidth()) { Icon(Icons.Default.Share, null); Spacer(Modifier.width(8.dp)); Text("Compartir evento") } }
        item { Text("Confirma disponibilidad, cambios y condiciones con el organizador antes de asistir.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
    }
}
