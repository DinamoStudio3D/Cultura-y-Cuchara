package com.visitaloja.app

import android.content.Intent
import android.content.IntentFilter
import android.content.BroadcastReceiver
import android.content.Context
import android.media.AudioManager
import android.net.Uri
import android.view.View
import android.view.ViewGroup
import android.webkit.WebChromeClient
import android.widget.FrameLayout
import android.widget.Toast
import androidx.compose.foundation.clickable
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.DialogWindowProvider
import androidx.core.content.ContextCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import coil.compose.AsyncImage

@Composable
fun VideosScreen(content: PublicContent<VideoGallery>, retry: () -> Unit, pauseAudio: () -> Unit) {
    var query by rememberSaveable { mutableStateOf("") }
    var selectedId by rememberSaveable { mutableStateOf<String?>(null) }
    var selectedUrl by rememberSaveable { mutableStateOf<String?>(null) }
    val selected = content.value.items.find { it.id == selectedId && it.source.url == selectedUrl }
    LaunchedEffect(content) {
        if (!content.loading && !content.error && !content.cached && selected == null) { selectedId = null; selectedUrl = null }
    }
    val visible = remember(content.value, query) { VideoPolicy.filter(content.value, query) }
    val context = LocalContext.current
    LazyColumn(Modifier.fillMaxSize().testTag("videos-screen"), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(content.value.title, fontSize = 26.sp, lineHeight = 31.sp, fontWeight = FontWeight.ExtraBold)
                    Text(content.value.description, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                IconButton(onClick = retry) { Icon(Icons.Default.Refresh, "Actualizar videos", tint = MaterialTheme.colorScheme.primary) }
            }
        }
        if (content.loading) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
        if (content.error) item { Text("No pudimos actualizar los videos. Comprueba tu conexión y vuelve a intentarlo.", color = MaterialTheme.colorScheme.error) }
        else if (content.cached) item { Text("Consulta guardada. Conéctate para ver los cambios más recientes.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        if (content.value.items.isNotEmpty()) item {
            OutlinedTextField(query, { query = it }, label = { Text("Buscar video, lugar o autor") }, leadingIcon = { Icon(Icons.Default.Search, null) }, singleLine = true, shape = RoundedCornerShape(16.dp), modifier = Modifier.fillMaxWidth().testTag("video-search"))
            Text("${visible.size} ${if (visible.size == 1) "video" else "videos"} para descubrir Loja", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp))
        }
        if (!content.loading && !content.error && visible.isEmpty()) item {
            Surface(color = Color.White, shape = RoundedCornerShape(22.dp)) {
                Column(Modifier.fillMaxWidth().padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.VideoLibrary, null, Modifier.size(44.dp), tint = MaterialTheme.colorScheme.primary)
                    Text(if (query.isNotBlank()) "No encontramos videos con esa búsqueda." else "Pronto, más miradas de Loja.", fontWeight = FontWeight.Bold)
                    Text(if (query.isNotBlank()) "Prueba con otro lugar o autor." else "Los videos publicados aparecerán aquí para verlos dentro de la app.", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
        items(visible, key = { it.id }) { video ->
            Card(shape = RoundedCornerShape(24.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
                // Poster only: the actual player is created after an explicit tap.
                Box(Modifier.fillMaxWidth().aspectRatio(16f / 9).background(Color(0xFF10243A)).clickable(onClickLabel = "Ver ${video.title}") { pauseAudio(); selectedId = video.id; selectedUrl = video.source.url }) {
                    var thumbnailFailed by remember(video.thumbnail, video.source) { mutableStateOf(false) }
                    val image = if (thumbnailFailed) video.source.thumbnail else video.thumbnail ?: video.source.thumbnail
                    AsyncImage(image ?: R.drawable.visitaloja_logo, null, Modifier.fillMaxSize(), contentScale = if (image == null) ContentScale.Fit else ContentScale.Crop, onError = { thumbnailFailed = true }, error = painterResource(R.drawable.visitaloja_logo))
                    Icon(Icons.Default.PlayCircle, null, Modifier.align(Alignment.Center).size(60.dp), tint = Color.White)
                    Surface(Modifier.align(Alignment.TopStart).padding(12.dp), color = Color(0xDD10243A), shape = RoundedCornerShape(8.dp)) {
                        Text(if (video.source.youtubeId != null) "YouTube" else "Video", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp))
                    }
                }
                Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(video.title, fontSize = 19.sp, lineHeight = 24.sp, fontWeight = FontWeight.Bold)
                    if (video.description.isNotBlank()) Text(video.description, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    if (video.credit.isNotBlank()) Text("Crédito: ${video.credit}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Button(onClick = { pauseAudio(); selectedId = video.id; selectedUrl = video.source.url }, modifier = Modifier.weight(1f).testTag(if (video.source.youtubeId != null) "youtube-open-${video.id}" else "file-open-${video.id}")) { Icon(Icons.Default.PlayArrow, null); Text("Ver video", Modifier.padding(start = 6.dp)) }
                        IconButton(onClick = { videoShare(context, video) }) { Icon(Icons.Default.Share, "Compartir ${video.title}") }
                    }
                }
            }
        }
        if (visible.isNotEmpty()) item { Text("Reproducción con conexión a internet. Algunos autores pueden limitar la reproducción integrada de sus videos.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
    }
    if (selected != null) VideoDialog(selected) { selectedId = null; selectedUrl = null }
}

@Composable
internal fun VideoDialog(video: LojaVideo, close: () -> Unit) {
    var exitFullscreen by remember { mutableStateOf<(() -> Unit)?>(null) }
    Dialog(onDismissRequest = { exitFullscreen?.invoke() ?: close() }, properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
        val view = LocalView.current
        DisposableEffect(view) {
            val window = (view.parent as? DialogWindowProvider)?.window
            window?.let { WindowInsetsControllerCompat(it, view).apply { isAppearanceLightStatusBars = false; isAppearanceLightNavigationBars = false } }
            onDispose { }
        }
        if (video.source.youtubeId != null) YouTubeDialogContent(video, close) { exitFullscreen = it }
        else FileVideoDialogContent(video, close)
    }
}

@Composable
private fun YouTubeDialogContent(video: LojaVideo, close: () -> Unit, onFullscreen: ((() -> Unit)?) -> Unit) {
    val context = LocalContext.current
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    var attempt by remember { mutableIntStateOf(0) }
    var ready by remember(video.source.url, attempt) { mutableStateOf(false) }
    var playing by remember(video.source.url, attempt) { mutableStateOf(false) }
    var error by remember(video.source.url, attempt) { mutableStateOf<String?>(null) }
    var seconds by rememberSaveable(video.source.url) { mutableIntStateOf(0) }
    var custom by remember { mutableStateOf<View?>(null) }
    val controller = remember(video.source.url, attempt) {
        YouTubePlayer(context, video.source.youtubeId!!, seconds,
            { r, p, s, e -> ready = r; playing = p; seconds = s; error = e },
            { full, _ -> custom = full }, { videoOpen(context, it) })
    }
    LaunchedEffect(custom, controller) { onFullscreen(if (custom != null) controller::exitFullscreen else null) }
    DisposableEffect(controller, lifecycle) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_STOP) controller.background()
            if (event == Lifecycle.Event.ON_START) controller.resume()
        }
        val receiver = object : BroadcastReceiver() { override fun onReceive(c: Context?, intent: Intent?) { controller.pause() } }
        ContextCompat.registerReceiver(context, receiver, IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY), ContextCompat.RECEIVER_NOT_EXPORTED)
        lifecycle.addObserver(observer)
        onDispose { lifecycle.removeObserver(observer); context.unregisterReceiver(receiver); onFullscreen(null); controller.close() }
    }
    // Fullscreen is the unmodified custom view supplied by YouTube, with no covering controls.
    androidx.activity.compose.BackHandler(enabled = custom != null) { controller.exitFullscreen() }
    Surface(color = Color(0xFF10243A), contentColor = Color.White, modifier = Modifier.fillMaxSize().systemBarsPadding()) {
        if (custom != null) {
            val full = custom!!
            AndroidView(factory = { FrameLayout(it).apply { (full.parent as? ViewGroup)?.removeView(full); addView(full, FrameLayout.LayoutParams(-1, -1)) } }, modifier = Modifier.fillMaxSize())
        } else BoxWithConstraints(Modifier.fillMaxSize()) {
            val compact = maxHeight < 440.dp
            val stageHeight = (maxWidth * (9f / 16f)).coerceAtLeast(200.dp)
            val tooSmall = maxWidth < 200.dp || maxHeight < 260.dp
            LaunchedEffect(tooSmall, controller) { if (tooSmall) controller.pause() }
            Column(Modifier.fillMaxSize()) {
                VideoDialogHeading(video, close)
                if (tooSmall) {
                    Text("Amplía la ventana o gira el dispositivo para ver el video.", Modifier.padding(20.dp))
                } else {
                    AndroidView(factory = { (controller.container.parent as? ViewGroup)?.removeView(controller.container); controller.container },
                        modifier = if (compact) Modifier.fillMaxWidth().weight(1f).heightIn(min = 200.dp) else Modifier.fillMaxWidth().height(stageHeight))
                    if (!compact) Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        if (!compact) {
                            Text(video.title, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                            Text(error ?: if (playing) "Reproduciendo en la app" else if (ready) "Pulsa ▶ en el reproductor de YouTube." else "Preparando YouTube…", fontSize = 13.sp, color = if (error != null) Color(0xFFFFCEBE) else Color(0xFFCCE1F6), modifier = Modifier.testTag("youtube-status"))
                            if (video.description.isNotBlank()) Text(video.description, fontSize = 13.sp)
                            if (video.credit.isNotBlank()) Text("Crédito: ${video.credit}", fontSize = 12.sp, color = Color(0xFFCCE1F6))
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                if (error != null) OutlinedButton(onClick = { attempt++ }) { Text("Reintentar", color = Color.White) }
                                TextButton(onClick = { controller.pause(); videoOpen(context, video.source.url) }) { Text("Abrir en YouTube", color = Color(0xFFCCE1F6)) }
                            }
                            Text("Se pausa al salir de la app. YouTube puede mostrar sus avisos y controles habituales.", fontSize = 11.sp, color = Color(0xFFCCE1F6))
                        }
                    }
                }
            }
        }
    }
}

@Composable
internal fun VideoDialogHeading(video: LojaVideo, close: () -> Unit) {
    Row(Modifier.fillMaxWidth().heightIn(min = 56.dp).padding(horizontal = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Image(painterResource(R.drawable.visitaloja_logo), null, Modifier.size(36.dp))
        Text(video.title, Modifier.weight(1f).padding(horizontal = 10.dp), maxLines = 2, overflow = TextOverflow.Ellipsis, fontSize = 14.sp, fontWeight = FontWeight.Bold)
        IconButton(onClick = close) { Icon(Icons.Default.Close, "Cerrar video") }
    }
}
internal fun videoOpen(context: Context, url: String) { runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }.onFailure { Toast.makeText(context, "No hay una aplicación disponible para abrir este enlace.", Toast.LENGTH_SHORT).show() } }
private fun videoShare(context: Context, video: LojaVideo) { runCatching { context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_TEXT, "${video.title}\n${video.source.url}\nDescubre más en https://www.visitaloja.com/#loja-en-video") }, "Compartir video")) } }
