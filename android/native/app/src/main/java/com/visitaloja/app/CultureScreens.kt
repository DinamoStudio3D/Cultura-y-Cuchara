package com.visitaloja.app

import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage

@Composable
private fun CultureHeader(title: String, intro: String, query: String, change: (String) -> Unit, categories: List<String>, category: String, choose: (String) -> Unit) {
    Text(title, fontSize = 28.sp, lineHeight = 33.sp, fontWeight = FontWeight.ExtraBold)
    if (intro.isNotBlank()) Text(intro, color = MaterialTheme.colorScheme.onSurfaceVariant)
    OutlinedTextField(value = query, onValueChange = change, modifier = Modifier.fillMaxWidth().testTag("culture-search"), label = { Text("Buscar por nombre, tema o categoría") }, singleLine = true, shape = RoundedCornerShape(16.dp), leadingIcon = { Icon(Icons.Default.Search, null) }, trailingIcon = { if (query.isNotBlank()) IconButton(onClick = { change("") }) { Icon(Icons.Default.Close, "Borrar búsqueda") } })
    if (categories.isNotEmpty()) LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        item { FilterChip(selected = category.isBlank(), onClick = { choose("") }, label = { Text("Todas") }) }
        items(categories) { item -> FilterChip(selected = item == category, onClick = { choose(item) }, label = { Text(item) }) }
    }
}
@Composable
private fun CultureStatus(loading: Boolean, error: Boolean, cached: Boolean, empty: Boolean, retry: () -> Unit) {
    if (loading) LinearProgressIndicator(Modifier.fillMaxWidth())
    if (error) { Text("No pudimos consultar esta sección.", color = MaterialTheme.colorScheme.error);TextButton(onClick = retry) { Text("Reintentar") } }
    else if (cached) Text("Consulta guardada. Conéctate para confirmar las novedades.", fontSize = 12.sp)
    if (!loading && !error && empty) Text("No hay publicaciones con estos filtros.", modifier = Modifier.padding(vertical = 24.dp), color = MaterialTheme.colorScheme.onSurfaceVariant)
}
@Composable
internal fun StoriesScreen(content: PublicContent<StoryCatalogue>, now: Long, places: List<Place>, audio: DiscoveryAudioState, player: DiscoveryAudioViewModel, retry: () -> Unit, openPlace: (Place) -> Unit) {
    var query by rememberSaveable { mutableStateOf("") };var category by rememberSaveable { mutableStateOf("") };var selected by rememberSaveable { mutableStateOf<String?>(null) }
    val published = remember(content.value, now) { CulturePolicy.visible(content.value, now) }
    val visible = remember(content.value, now, query, category) { CulturePolicy.stories(content.value, now, query, category) }
    val story = published.find { it.id == selected }
    LaunchedEffect(published) { if (story == null) selected = null }
    LazyColumn(Modifier.fillMaxSize().testTag("stories-screen"), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item { Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            CultureHeader(content.value.title, content.value.intro, query, { query = it }, published.map { it.category }.filter(String::isNotBlank).distinct().sorted(), category, { category = it })
            CultureStatus(content.loading, content.error, content.cached, visible.isEmpty(), retry)
        } }
        items(visible, key = { it.id }) { item ->
            Card(onClick = { selected = item.id }, shape = RoundedCornerShape(22.dp), colors = CardDefaults.cardColors(containerColor = Color.White), modifier = Modifier.fillMaxWidth().testTag("story-card-${item.id}")) {
                if (item.cover != null) CultureImage(item.cover, item.title)
                Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(listOf(item.category, item.era).filter(String::isNotBlank).joinToString(" · "), color = MaterialTheme.colorScheme.primary, fontSize = 12.sp)
                    Text(item.title, fontWeight = FontWeight.Bold, fontSize = 21.sp)
                    if (item.intro.isNotBlank()) Text(item.intro, maxLines = 4, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("Leer historia", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
    if (story != null) StoryReader(story, places, audio, player, { selected = null }) { place -> selected = null;openPlace(place) }
}
@Composable
internal fun EnterprisesScreen(content: PublicContent<List<LojaEnterprise>>, retry: () -> Unit) {
    var query by rememberSaveable { mutableStateOf("") };var category by rememberSaveable { mutableStateOf("") };var selected by rememberSaveable { mutableStateOf<String?>(null) }
    val visible = remember(content.value, query, category) { CulturePolicy.enterprises(content.value, query, category) }
    val enterprise = content.value.find { it.id == selected }
    val context = LocalContext.current
    LazyColumn(Modifier.fillMaxSize().testTag("enterprises-screen"), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item { Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            CultureHeader("Emprendedores de Loja", "Descubre el talento local y apoya a quienes crean en nuestra tierra.", query, { query = it }, content.value.map { it.category }.filter(String::isNotBlank).distinct().sorted(), category, { category = it })
            CultureStatus(content.loading, content.error, content.cached, visible.isEmpty(), retry)
        } }
        items(visible, key = { it.id }) { item ->
            Card(onClick = { selected = item.id }, shape = RoundedCornerShape(22.dp), colors = CardDefaults.cardColors(containerColor = Color.White), modifier = Modifier.fillMaxWidth().testTag("enterprise-card-${item.id}")) {
                if (item.image != null) CultureImage(item.image, item.name)
                Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (item.category.isNotBlank()) Text(item.category, color = MaterialTheme.colorScheme.primary, fontSize = 12.sp)
                    Text(item.name, fontWeight = FontWeight.Bold, fontSize = 21.sp)
                    Text(item.description, maxLines = 4, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("Conocer emprendimiento", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
    if (enterprise != null) CultureDialog(enterprise.name, "Cerrar emprendimiento", { selected = null }) {
        if (enterprise.image != null) PlaceGallery(Place("enterprise:${enterprise.id}", enterprise.name, emptyList(), "", "", enterprise.image), "Imagen del emprendimiento")
        Text(enterprise.category, color = MaterialTheme.colorScheme.primary)
        Text(enterprise.description, lineHeight = 24.sp)
        if (enterprise.phone != null) Button(onClick = {
            val message = "¡Hola! Vengo desde VisitaLoja y deseo más información sobre ${enterprise.name}."
            cultureOpen(context, "https://wa.me/${enterprise.phone}?text=${Uri.encode(message)}")
        }, modifier = Modifier.fillMaxWidth()) { Icon(Icons.Default.Chat, null);Spacer(Modifier.width(8.dp));Text("Contactar por WhatsApp") }
        OutlinedButton(onClick = { cultureShare(context, enterprise.name, "https://www.visitaloja.com/#emprendedores") }, modifier = Modifier.fillMaxWidth()) { Text("Compartir emprendimiento") }
    }
}
@Composable
private fun CultureImage(url: String, title: String) {
    AsyncImage(url, title, Modifier.fillMaxWidth().height(200.dp), contentScale = ContentScale.Crop, placeholder = painterResource(R.drawable.visitaloja_logo), error = painterResource(R.drawable.visitaloja_logo))
}
@Composable
private fun CultureDialog(title: String, closeLabel: String, close: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    Dialog(onDismissRequest = close, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            Column(Modifier.fillMaxSize().systemBarsPadding()) {
                Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(title, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f), maxLines = 2)
                    IconButton(onClick = close) { Icon(Icons.Default.Close, closeLabel) }
                }
                Column(Modifier.fillMaxWidth().weight(1f).verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp), content = content)
            }
        }
    }
}
@Composable
private fun StoryReader(story: LojaStory, places: List<Place>, audio: DiscoveryAudioState, player: DiscoveryAudioViewModel, close: () -> Unit, openPlace: (Place) -> Unit) {
    var english by rememberSaveable(story.id) { mutableStateOf(false) };var videoOpen by rememberSaveable(story.id) { mutableStateOf(false) }
    val title = if (english) story.titleEn.ifBlank { story.title } else story.title
    val intro = if (english) story.introEn.ifBlank { story.intro } else story.intro.ifBlank { story.introEn }
    val body = if (english) story.bodyEn.ifBlank { story.body } else story.body.ifBlank { story.bodyEn }
    val context = LocalContext.current
    CultureDialog(title, "Cerrar historia", close) {
        if (story.titleEn.isNotBlank() || story.bodyEn.isNotBlank() || story.introEn.isNotBlank()) Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(selected = !english, onClick = { english = false }, label = { Text("Español") })
            FilterChip(selected = english, onClick = { english = true }, label = { Text("English") })
        }
        if (story.cover != null || story.gallery.isNotEmpty()) PlaceGallery(Place("story:${story.id}", title, emptyList(), "", "", story.cover, photos = story.gallery.map { PlacePhoto(it) }), "Imágenes del relato")
        Text(listOf(story.category, story.era).filter(String::isNotBlank).joinToString(" · "), color = MaterialTheme.colorScheme.primary)
        if (intro.isNotBlank()) Text(intro, fontWeight = FontWeight.SemiBold, fontSize = 18.sp, lineHeight = 25.sp)
        listOf(false to story.audio, true to story.audioEn).forEach { (en, url) -> if (url != null) {
            val key = CulturePolicy.storyAudioKey(story.id, en);val active = audio.key == key && audio.url == url;val playing = active && (audio.playing || audio.buffering);val language = if (en) "inglés" else "español"
            OutlinedButton(onClick = { if (playing) player.pause() else player.play(key, "$title · $language", url) }, modifier = Modifier.fillMaxWidth()) { Text(if (playing) "Pausar narración en $language" else "Escuchar en $language") }
            if (active && audio.error != null) Text(audio.error, color = MaterialTheme.colorScheme.error)
        } }
        if (story.video != null) Button(onClick = { player.pause();videoOpen = true }, modifier = Modifier.fillMaxWidth()) { Text("Ver video de la historia") }
        Text(body, lineHeight = 25.sp)
        if (story.source.isNotBlank()) Text("Fuente: ${story.source}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        val related = places.filter { it.id in story.related && PlacePolicy.published(it) }
        if (related.isNotEmpty()) {
            Text("Lugares relacionados", fontWeight = FontWeight.Bold)
            related.forEach { place -> OutlinedButton(onClick = { openPlace(place) }, modifier = Modifier.fillMaxWidth()) { Text(place.title) } }
        }
        OutlinedButton(onClick = { cultureShare(context, title, "https://www.visitaloja.com/#historias") }, modifier = Modifier.fillMaxWidth()) { Text("Compartir historia") }
    }
    if (videoOpen && story.video != null) VideoDialog(LojaVideo("story:${story.id}", title, intro.take(350), story.source, story.video, story.video.thumbnail)) { videoOpen = false }
}
private fun cultureOpen(context: android.content.Context, url: String) { runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }.onFailure { Toast.makeText(context, "No hay una aplicación disponible.", Toast.LENGTH_SHORT).show() } }
private fun cultureShare(context: android.content.Context, title: String, url: String) { runCatching { context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply { type = "text/plain";putExtra(Intent.EXTRA_TEXT, "$title\n$url") }, "Compartir desde VisitaLoja")) } }
