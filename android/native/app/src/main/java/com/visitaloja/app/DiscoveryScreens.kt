package com.visitaloja.app

import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage

private val DiscoveryBlue = Color(0xFF075BB2)

@Composable
fun DiscoveryHome(state: DiscoveryState, open: (String) -> Unit) {
    Column(Modifier.padding(horizontal = 22.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("OTRAS FORMAS DE VIVIR LOJA", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = DiscoveryBlue)
        Text("Mira, recuerda y escucha", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.ExtraBold)
        LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            item { DiscoveryShortcut("Loja en imágenes", "Paisajes con nombre y autor", state.photos.value.firstOrNull { it.section == "Loja en imágenes" }?.url ?: "https://www.visitaloja.com/assets/photos/jipiro-laguna.webp", Icons.Default.PhotoLibrary, "open-photos") { open("photos") } }
            item { DiscoveryShortcut("Loja en el Tiempo", "Desliza entre el ayer y el hoy", state.history.value.firstOrNull()?.present, Icons.Default.Compare, "open-time") { open("time") } }
            item { DiscoveryShortcut("El podcast", "Historias para escuchar", state.podcast.value?.cover, Icons.Default.Headphones, "open-podcast") { open("podcast") } }
        }
    }
}

@Composable
private fun DiscoveryShortcut(title: String, subtitle: String, image: String?, icon: androidx.compose.ui.graphics.vector.ImageVector, tag: String, open: () -> Unit) {
    Card(onClick = open, modifier = Modifier.width(235.dp).testTag(tag), shape = RoundedCornerShape(22.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
        Box(Modifier.fillMaxWidth().height(120.dp).background(Color(0xFFE0EDFA))) {
            AsyncImage(image ?: R.drawable.visitaloja_logo, null, contentScale = if (image == null) ContentScale.Fit else ContentScale.Crop, modifier = Modifier.fillMaxSize(), error = painterResource(R.drawable.visitaloja_logo))
            Surface(Modifier.align(Alignment.BottomStart).padding(10.dp), color = Color.White, shape = RoundedCornerShape(12.dp)) { Icon(icon, null, Modifier.padding(8.dp).size(22.dp), tint = DiscoveryBlue) }
        }
        Column(Modifier.padding(14.dp)) { Text(title, fontWeight = FontWeight.Bold); Text(subtitle, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
    }
}

@Composable
private fun DiscoveryHeading(title: String, subtitle: String, retry: () -> Unit) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) { Text(title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold); Text(subtitle, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        IconButton(onClick = retry) { Icon(Icons.Default.Refresh, "Actualizar contenido", tint = DiscoveryBlue) }
    }
}

@Composable
private fun <T> ContentStatus(content: PublicContent<T>, empty: Boolean) {
    when {
        content.loading -> LinearProgressIndicator(Modifier.fillMaxWidth())
        content.error -> Text("No pudimos actualizar este contenido. Comprueba tu conexión y pulsa actualizar.", color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
        content.cached -> Text("Consulta guardada. Conéctate para ver los cambios más recientes.", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
        empty -> Text("Todavía no hay contenido publicado en esta sección.", color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
fun PhotosScreen(content: PublicContent<List<LojaPhoto>>, retry: () -> Unit) {
    var section by rememberSaveable { mutableStateOf("Loja en imágenes") }
    var query by rememberSaveable { mutableStateOf("") }
    var selectedId by rememberSaveable { mutableStateOf<String?>(null) }
    val filtered = remember(content.value, query, section) { DiscoveryPolicy.filter(content.value, section, query) }
    LazyColumn(Modifier.fillMaxSize().testTag("photos-screen"), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item { DiscoveryHeading("Loja en imágenes", "Cada fotografía, una forma de mirar nuestra tierra.", retry) }
        item { ContentStatus(content, content.value.isEmpty()) }
        item { OutlinedTextField(query, { query = it }, label = { Text("Buscar foto o autor") }, leadingIcon = { Icon(Icons.Default.Search, null) }, modifier = Modifier.fillMaxWidth(), singleLine = true, shape = RoundedCornerShape(16.dp)) }
        item { Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) { DiscoveryPolicy.sections.forEach { name -> FilterChip(selected = section == name, onClick = { section = name }, label = { Text(name) }) } } }
        if (filtered.isEmpty() && content.value.isNotEmpty()) item { Text("No hay fotografías que coincidan con tu búsqueda.") }
        items(filtered.chunked(2), key = { it.first().id }) { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                row.forEach { photo ->
                    Card(onClick = { selectedId = photo.id }, modifier = Modifier.weight(1f).testTag("photo-${photo.id}"), shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
                        AsyncImage(photo.url, photo.alt, Modifier.fillMaxWidth().aspectRatio(0.95f).background(MaterialTheme.colorScheme.surfaceVariant), contentScale = ContentScale.Crop, error = painterResource(R.drawable.visitaloja_logo))
                        Column(Modifier.padding(12.dp)) { Text(photo.title, fontWeight = FontWeight.Bold, fontSize = 14.sp, maxLines = 2, overflow = TextOverflow.Ellipsis); Text(photo.credit, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2) }
                    }
                }
                if (row.size == 1) Spacer(Modifier.weight(1f))
            }
        }
        item { Text("Toca una fotografía para verla completa. Puedes ampliarla con dos dedos.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
    }
    val selected = content.value.find { it.id == selectedId }
    if (selected != null) DiscoveryPhotoDialog(content.value.filter { it.section == selected.section }, selected.id, { selectedId = it }, { selectedId = null })
}

@Composable
fun DiscoveryPhotoDialog(photos: List<LojaPhoto>, id: String, select: (String) -> Unit, close: () -> Unit) {
    val index = photos.indexOfFirst { it.id == id }.takeIf { it >= 0 } ?: return
    val photo = photos[index]
    val context = LocalContext.current
    var scale by remember(id) { mutableFloatStateOf(1f) }
    var pan by remember(id) { mutableStateOf(Offset.Zero) }
    Dialog(onDismissRequest = close, properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
        Surface(Modifier.fillMaxSize().testTag("photo-viewer"), color = Color(0xFF10243A), contentColor = Color.White) {
            Column(Modifier.fillMaxSize().systemBarsPadding().padding(12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("${index + 1} / ${photos.size}", Modifier.weight(1f).padding(8.dp))
                    IconButton(onClick = { scale = 1f; pan = Offset.Zero }) { Icon(Icons.Default.ZoomOutMap, "Restablecer ampliación") }
                    IconButton(onClick = { discoveryShare(context, "${photo.title} · VisitaLoja", if (photo.section.isBlank()) "https://www.visitaloja.com/#loja-tiempo" else "https://www.visitaloja.com/?foto=${Uri.encode(photo.id)}#loja-en-imagenes") }) { Icon(Icons.Default.Share, "Compartir fotografía") }
                    IconButton(onClick = close) { Icon(Icons.Default.Close, "Cerrar fotografías") }
                }
                BoxWithConstraints(Modifier.weight(1f).fillMaxWidth().clip(RoundedCornerShape(8.dp))) {
                    val maxX = constraints.maxWidth.toFloat(); val maxY = constraints.maxHeight.toFloat()
                    AsyncImage(photo.url, photo.alt, Modifier.fillMaxSize().pointerInput(id) {
                        detectTransformGestures { _, delta, zoom, _ ->
                            scale = (scale * zoom).coerceIn(1f, 4f)
                            pan = if (scale <= 1f) Offset.Zero else Offset((pan.x + delta.x).coerceIn(-maxX * (scale - 1) / 2, maxX * (scale - 1) / 2), (pan.y + delta.y).coerceIn(-maxY * (scale - 1) / 2, maxY * (scale - 1) / 2))
                        }
                    }.graphicsLayer(scaleX = scale, scaleY = scale, translationX = pan.x, translationY = pan.y), contentScale = ContentScale.Fit, error = painterResource(R.drawable.visitaloja_logo))
                }
                // Credits remain readable at large system font sizes and on landscape screens.
                Column(Modifier.heightIn(max = 170.dp).verticalScroll(rememberScrollState()).padding(8.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text(photo.title, fontWeight = FontWeight.Bold)
                    if (photo.description.isNotBlank()) Text(photo.description, fontSize = 13.sp)
                    Text("Fotografía: ${photo.credit}", fontSize = 12.sp, color = Color(0xFFCCE1F6))
                    photo.creditUrl?.let { url -> TextButton(onClick = { discoveryOpen(context, url) }) { Text("Ver autor", color = Color(0xFFCCE1F6)) } }
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = { select(photos[index - 1].id) }, enabled = index > 0) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Fotografía anterior") }
                    Text("Amplía con dos dedos", fontSize = 12.sp)
                    IconButton(onClick = { select(photos[index + 1].id) }, enabled = index < photos.lastIndex) { Icon(Icons.AutoMirrored.Filled.ArrowForward, "Fotografía siguiente") }
                }
            }
        }
    }
}

@Composable
fun TimeScreen(content: PublicContent<List<TimePlace>>, audio: DiscoveryAudioState, player: DiscoveryAudioViewModel, retry: () -> Unit) {
    var query by rememberSaveable { mutableStateOf("") }
    var selectedId by rememberSaveable { mutableStateOf<String?>(null) }
    var original by rememberSaveable { mutableStateOf<String?>(null) }
    val filtered = content.value.filter { PlacePolicy.normalize(query) in PlacePolicy.normalize("${it.title} ${it.description}") }
    val selected = filtered.find { it.id == selectedId } ?: filtered.firstOrNull()
    val context = LocalContext.current
    LazyColumn(Modifier.fillMaxSize().testTag("time-screen"), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item { DiscoveryHeading("Loja en el Tiempo", "El mismo lugar. Dos momentos para descubrirlo.", retry) }
        item { ContentStatus(content, content.value.isEmpty()) }
        item { OutlinedTextField(query, { query = it }, label = { Text("Buscar un lugar o una historia") }, singleLine = true, leadingIcon = { Icon(Icons.Default.Search, null) }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp)) }
        if (filtered.isEmpty() && content.value.isNotEmpty()) item { Text("No hay historias que coincidan con tu búsqueda.") }
        if (filtered.isNotEmpty()) item { LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) { items(filtered, key = { it.id }) { place -> FilterChip(selected = place.id == selected?.id, onClick = { selectedId = place.id; original = null }, label = { Text(place.title) }) } } }
        if (selected != null) {
            item { Text(selected.title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold) }
            item { TimeComparator(selected) }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = { original = "past" }, enabled = selected.past != null, modifier = Modifier.weight(1f)) { Text("Ver ${selected.pastLabel}", maxLines = 2) }
                    OutlinedButton(onClick = { original = "present" }, enabled = selected.present != null, modifier = Modifier.weight(1f)) { Text("Ver ${selected.presentLabel}", maxLines = 2) }
                }
            }
            if (selected.audio != null) item { Button(onClick = { player.play("time:${selected.id}", selected.title, selected.audio) }) { Icon(if (audio.key == "time:${selected.id}" && audio.playing) Icons.Default.Pause else Icons.Default.PlayArrow, null); Text(if (audio.key == "time:${selected.id}" && audio.playing) "Pausar historia" else "Escuchar historia") } }
            if (selected.description.isNotBlank()) item { Surface(color = Color.White, shape = RoundedCornerShape(20.dp)) { Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) { Text("La historia del lugar", fontWeight = FontWeight.Bold); Text(selected.description, fontSize = 15.sp, lineHeight = 24.sp) } } }
            item { TextButton(onClick = { discoveryShare(context, selected.title, "https://www.visitaloja.com/#loja-tiempo") }) { Icon(Icons.Default.Share, null); Spacer(Modifier.width(8.dp)); Text("Compartir Loja en el Tiempo") } }
        }
    }
    if (selected != null && original != null) {
        val url = if (original == "past") selected.past else selected.present
        if (url != null) DiscoveryPhotoDialog(listOf(LojaPhoto(selected.id, "", "${selected.title} · ${if (original == "past") selected.pastLabel else selected.presentLabel}", url, "Autor no indicado", null, "", selected.title)), selected.id, {}, { original = null })
    }
}

@Composable
private fun TimeComparator(place: TimePlace) {
    var fraction by rememberSaveable(place.id) { mutableFloatStateOf(0.5f) }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Box(Modifier.fillMaxWidth().aspectRatio(1.15f).clip(RoundedCornerShape(22.dp)).background(Color(0xFFDAE8F6))) {
            if (place.present != null) AsyncImage(place.present, "${place.title}, ${place.presentLabel}", Modifier.fillMaxSize(), contentScale = ContentScale.Crop, error = painterResource(R.drawable.visitaloja_logo))
            else Text("No hay fotografía de ${place.presentLabel}", Modifier.align(Alignment.Center).padding(20.dp))
            if (place.past != null) Box(Modifier.fillMaxSize().drawWithContent { clipRect(right = size.width * fraction) { this@drawWithContent.drawContent() } }) {
                AsyncImage(place.past, "${place.title}, ${place.pastLabel}", Modifier.fillMaxSize(), contentScale = ContentScale.Crop, error = painterResource(R.drawable.visitaloja_logo))
            }
            if (place.past != null && place.present != null) Box(Modifier.fillMaxSize().drawWithContent { drawLine(Color.White, Offset(size.width * fraction, 0f), Offset(size.width * fraction, size.height), strokeWidth = 4.dp.toPx()) })
            Row(Modifier.align(Alignment.TopCenter).fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                Surface(color = Color(0xDD10243A), shape = RoundedCornerShape(8.dp)) { Text(place.pastLabel, Modifier.padding(8.dp), color = Color.White, fontSize = 12.sp) }
                Surface(color = Color(0xDD10243A), shape = RoundedCornerShape(8.dp)) { Text(place.presentLabel, Modifier.padding(8.dp), color = Color.White, fontSize = 12.sp) }
            }
        }
        if (place.past != null && place.present != null) {
            Slider(value = fraction, onValueChange = { fraction = it }, modifier = Modifier.testTag("time-comparison"))
            Text("Desliza el control para comparar el ayer y el hoy.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        } else Text("Falta una fotografía para poder comparar ambos momentos.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
fun PodcastScreen(content: PublicContent<LojaPodcast?>, audio: DiscoveryAudioState, player: DiscoveryAudioViewModel, retry: () -> Unit) {
    val podcast = content.value
    val context = LocalContext.current
    LazyColumn(Modifier.fillMaxSize().testTag("podcast-screen"), contentPadding = PaddingValues(22.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        item { DiscoveryHeading("El podcast de Loja", "Dale al play. Acércate a nuestras historias.", retry) }
        item { ContentStatus(content, podcast == null) }
        if (podcast != null) {
            item { Card(shape = RoundedCornerShape(26.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
                AsyncImage(podcast.cover ?: R.drawable.visitaloja_logo, "Portada de ${podcast.title}", Modifier.fillMaxWidth().heightIn(max = 300.dp).aspectRatio(1.2f).background(Color(0xFFE7F1FB)), contentScale = if (podcast.cover == null) ContentScale.Fit else ContentScale.Crop, error = painterResource(R.drawable.visitaloja_logo))
                Column(Modifier.padding(22.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    Text(podcast.label, color = DiscoveryBlue, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Text(podcast.title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold)
                    Text("Conoce las historias, los sabores y la herencia cultural de nuestra provincia.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Button(onClick = { podcast.audio?.let { player.play("podcast", podcast.title, it) } }, enabled = podcast.audio != null && !content.loading, modifier = Modifier.fillMaxWidth().testTag("podcast-play")) {
                        Icon(if (audio.key == "podcast" && audio.playing) Icons.Default.Pause else Icons.Default.PlayArrow, null)
                        Text(if (audio.key == "podcast" && audio.playing) "Pausar" else "Escuchar en la app")
                    }
                    if (podcast.audio == null) Text("El audio todavía no está disponible.", color = MaterialTheme.colorScheme.error)
                }
            } }
            item { Text("El audio se reproduce con conexión a internet y se pausa cuando sales de la app.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            item { TextButton(onClick = { discoveryShare(context, podcast.title, "https://www.visitaloja.com/#podcast-section") }) { Icon(Icons.Default.Share, null); Spacer(Modifier.width(8.dp)); Text("Compartir podcast") } }
        }
    }
}

@Composable
fun DiscoveryMiniPlayer(audio: DiscoveryAudioState, player: DiscoveryAudioViewModel) {
    Surface(color = Color(0xFFE1EEFB), tonalElevation = 2.dp, modifier = Modifier.testTag("audio-player")) {
        Column(Modifier.padding(horizontal = 12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Headphones, null, Modifier.size(20.dp), tint = DiscoveryBlue)
                Column(Modifier.weight(1f).padding(horizontal = 10.dp, vertical = 6.dp)) {
                    Text(audio.title, maxLines = 1, overflow = TextOverflow.Ellipsis, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    Text(if (audio.error != null) "Audio no disponible · pulsa para reintentar" else if (audio.buffering) "Cargando audio…" else "${audioTime(audio.position)} / ${if (audio.duration > 0) audioTime(audio.duration) else "--:--"}", fontSize = 11.sp, color = if (audio.error != null) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant)
                }
                IconButton(onClick = player::toggle, modifier = Modifier.testTag("audio-toggle")) { Icon(if (audio.playing || audio.buffering) Icons.Default.Pause else if (audio.error != null) Icons.Default.Refresh else Icons.Default.PlayArrow, if (audio.playing || audio.buffering) "Pausar audio" else "Reproducir audio") }
                IconButton(onClick = player::close) { Icon(Icons.Default.Close, "Cerrar audio") }
            }
            if (audio.duration > 0) {
                var seek by remember(audio.key) { mutableStateOf<Float?>(null) }
                Slider(value = seek ?: (audio.position.toFloat() / audio.duration).coerceIn(0f, 1f), onValueChange = { seek = it }, onValueChangeFinished = { seek?.let { player.seek((it * audio.duration).toLong()) }; seek = null }, modifier = Modifier.fillMaxWidth().height(28.dp))
            }
        }
    }
}
private fun audioTime(ms: Long): String = "%d:%02d".format(java.util.Locale.ROOT, ms / 60000, (ms / 1000) % 60)
private fun discoveryOpen(context: android.content.Context, url: String) { runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }.onFailure { Toast.makeText(context, "No hay una aplicación disponible para abrir el enlace.", Toast.LENGTH_SHORT).show() } }
private fun discoveryShare(context: android.content.Context, title: String, url: String) { runCatching { context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_TEXT, "$title\n$url") }, "Compartir VisitaLoja")) } }
