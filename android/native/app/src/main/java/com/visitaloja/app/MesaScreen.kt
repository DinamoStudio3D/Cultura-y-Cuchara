package com.visitaloja.app

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Handshake
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import coil.compose.AsyncImage
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
internal fun MesaScreen(content: PublicContent<MesaContent>, retry: () -> Unit) {
    val data = content.value
    var group by rememberSaveable { mutableStateOf("about") }
    val context = LocalContext.current
    val open: (String) -> Unit = { url -> try { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) } catch (_: ActivityNotFoundException) { Toast.makeText(context, "No hay una aplicación disponible para abrir este enlace.", Toast.LENGTH_LONG).show() } }
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val now by produceState(System.currentTimeMillis(), lifecycle) { lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) { while (isActive) { value = System.currentTimeMillis();delay(30_000) } } }
    val tabs = linkedMapOf("about" to "Institución").apply { putAll(MesaPolicy.groups);put("gallery", "Galería");put("contact", "Contacto") }
    Column(Modifier.fillMaxSize().testTag("mesa-screen")) {
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            tabs.forEach { (key, label) -> FilterChip(group == key, { group = key }, { Text(label) }, modifier = Modifier.testTag("mesa-tab-$key")) }
        }
        key(group) {
            LazyColumn(Modifier.fillMaxSize().testTag("mesa-content"), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                when {
                    content.loading -> item { LinearProgressIndicator(Modifier.fillMaxWidth());Text("Consultando la Mesa Turística…") }
                    content.error -> item { Text("No pudimos consultar la información institucional.");TextButton(onClick = retry) { Text("Reintentar") } }
                    !data.active -> item { Text("Esta información no está publicada por ahora.") }
                    else -> {
                        if (content.cached) item { Text("Sin conexión: información guardada. Conéctate para confirmar fechas y novedades.", color = MaterialTheme.colorScheme.onSurfaceVariant);TextButton(onClick = retry) { Text("Actualizar") } }
                        item { Text(tabs.getValue(group), fontSize = 24.sp, fontWeight = FontWeight.ExtraBold) }
                        when (group) {
                            "about" -> {
                                item { Surface(color = Color(0xFF0C3768), contentColor = Color.White, shape = RoundedCornerShape(24.dp)) {
                                    Column(Modifier.fillMaxWidth().padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                        AsyncImage("https://www.visitaloja.com/logo%20mesa%20turistica.webp", "Logo oficial de la Mesa Turística de Loja", Modifier.fillMaxWidth().height(130.dp), contentScale = ContentScale.Fit)
                                        Text("INSTITUCIÓN DE APOYO", color = Color(0xFFABDBFF), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                        Text(data.title, fontSize = 29.sp, lineHeight = 34.sp, fontWeight = FontWeight.ExtraBold)
                                        Text(data.intro, lineHeight = 23.sp)
                                        Icon(Icons.Default.Handshake, null, tint = Color(0xFFABDBFF))
                                        Text("Juntos impulsamos el turismo y la identidad de Loja.", color = Color(0xFFE2EFFF))
                                    }
                                } }
                                if (data.objectives.isNotBlank()) item { MesaTextCard("Objetivos y trabajo", data.objectives) }
                                if (!content.cached) MesaPolicy.next(data.groups["agenda"].orEmpty(), now)?.let { next -> item { Text("Próxima actividad", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary);MesaItem(next);TextButton(onClick = { group = "agenda" }, modifier = Modifier.testTag("mesa-open-agenda")) { Text("Ver programación completa") } } }
                                item { Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { OutlinedButton(onClick = { group = "board" }, modifier = Modifier.weight(1f)) { Text("Directiva") };OutlinedButton(onClick = { group = "institutions" }, modifier = Modifier.weight(1f)) { Text("Instituciones") } } }
                            }
                            "gallery" -> if (data.gallery.isEmpty()) item { Text("Todavía no hay fotografías publicadas.") } else item { PlaceGallery(Place("mesa-gallery", data.title, emptyList(), "", "", data.gallery.first(), photos = data.gallery.drop(1).map { PlacePhoto(it) }), "Actividades de la Mesa Turística") }
                            "contact" -> item {
                                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                    Text("Contactos publicados por la institución", color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    data.email?.let { email -> OutlinedButton(onClick = { open("mailto:" + Uri.encode(email, "@")) }) { Text(email) } }
                                    data.phone?.let { phone -> OutlinedButton(onClick = { open("tel:" + Uri.encode(phone)) }) { Text(phone) } }
                                    data.facebook?.let { url -> OutlinedButton(onClick = { open(url) }) { Text("Abrir Facebook ↗") } }
                                    data.instagram?.let { url -> OutlinedButton(onClick = { open(url) }) { Text("Abrir Instagram ↗") } }
                                    if (data.email == null && data.phone == null && data.facebook == null && data.instagram == null) Text("Todavía no hay contactos publicados.")
                                }
                            }
                            else -> {
                                val rows = data.groups[group].orEmpty()
                                if (rows.isEmpty()) item { Text("Próximamente publicaremos información en este apartado.", modifier = Modifier.testTag("mesa-empty")) }
                                itemsIndexed(rows) { index, entry ->
                                    Column(Modifier.testTag("mesa-entry-$group-$index")) {
                                        MesaItem(entry, group == "institutions")
                                        entry.url?.let { url ->
                                            TextButton(onClick = { open(url) }) {
                                                Text(if (group == "documents") "Abrir documento ↗" else "Más información ↗")
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
@Composable
private fun MesaTextCard(title: String, text: String) {
    Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(20.dp)) { Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) { Text(title, fontWeight = FontWeight.Bold, fontSize = 20.sp);Text(text, lineHeight = 24.sp) } }
}
@Composable
private fun MesaItem(entry: MesaEntry, logo: Boolean = false) {
    Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(20.dp)) {
        Column(Modifier.fillMaxWidth().padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            entry.image?.let { AsyncImage(it, null, Modifier.fillMaxWidth().height(if (logo) 100.dp else 180.dp), contentScale = if (logo) ContentScale.Fit else ContentScale.Crop) }
            if (entry.status.isNotBlank()) Text(MesaPolicy.status(entry.status), color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold, fontSize = 12.sp)
            Text(entry.title, fontWeight = FontWeight.Bold, fontSize = 20.sp)
            if (entry.detail.isNotBlank()) Text(entry.detail, color = MaterialTheme.colorScheme.primary)
            val date = entry.date?.format(DateTimeFormatter.ofPattern("d 'de' MMMM 'de' yyyy", Locale("es", "EC")))
            val whenWhere = listOfNotNull(date, entry.time.takeIf(String::isNotBlank), entry.place.takeIf(String::isNotBlank)).joinToString(" · ")
            if (whenWhere.isNotBlank()) Text(whenWhere, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (entry.description.isNotBlank()) Text(entry.description, lineHeight = 24.sp)
        }
    }
}
