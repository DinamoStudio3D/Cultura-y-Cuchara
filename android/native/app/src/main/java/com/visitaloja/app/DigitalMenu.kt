package com.visitaloja.app

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.MetadataChanges
import kotlinx.coroutines.delay
import java.time.LocalDate

@Composable
fun DigitalMenuEntry(place: Place, english: Boolean = false) {
    val id = place.menuQrId?.takeIf(MenuPolicy::validId) ?: return
    var raw by remember(place.id, id) { mutableStateOf<Map<String, Any?>?>(null) }
    var loading by remember(place.id, id) { mutableStateOf(true) }
    var failed by remember(place.id, id) { mutableStateOf(false) }
    var cached by remember(place.id, id) { mutableStateOf(false) }
    var retry by remember(place.id, id) { mutableIntStateOf(0) }
    var open by remember(place.id, id) { mutableStateOf(false) }
    var today by remember { mutableStateOf(LocalDate.now(AgendaPolicy.zone)) }
    LaunchedEffect(Unit) { while (true) { today = LocalDate.now(AgendaPolicy.zone); delay(60_000) } }
    DisposableEffect(place.id, id, retry) {
        var alive = true
        loading = true; failed = false
        val listener = FirebaseFirestore.getInstance().collection("qrCodes").document(id)
            .addSnapshotListener(MetadataChanges.INCLUDE) { doc, error ->
                if (alive) {
                    loading = doc == null && error == null
                    failed = error != null
                    cached = doc?.metadata?.isFromCache ?: false
                    // An error or withdrawal must never leave an old published menu on screen.
                    raw = if (error == null && doc != null) doc.data else null
                }
            }
        onDispose { alive = false; listener.remove() }
    }
    val menu = raw?.let { MenuPolicy.read(id, it, today) }
    LaunchedEffect(menu) { if (menu == null) open = false }
    when {
        menu != null -> {
            OutlinedButton(onClick = { open = true }, modifier = Modifier.fillMaxWidth().testTag("open-digital-menu"), shape = RoundedCornerShape(13.dp)) {
                Icon(Icons.Default.RestaurantMenu, null); Spacer(Modifier.width(9.dp)); Text((if (english) "View menu" else "Ver menú"))
            }
            if (open) DigitalMenuDialog(menu, cached, { retry++ }, english) { open = false }
        }
        loading -> Text((if (english) "Loading menu…" else "Consultando menú…"), style = MaterialTheme.typography.bodySmall)
        failed || cached -> TextButton(onClick = { retry++ }) { Text((if (english) "Could not load menu · Retry" else "No pudimos consultar el menú · Reintentar")) }
        // A confirmed inactive/deleted/invalid QR has no menu action, matching the website.
    }
}

@Composable
internal fun DigitalMenuDialog(menu: DigitalMenu, cached: Boolean, refresh: () -> Unit, english: Boolean = false, close: () -> Unit) {
    val context = LocalContext.current
    var scale by remember(menu.id, menu.image) { mutableFloatStateOf(1f) }
    var pan by remember(menu.id, menu.image) { mutableStateOf(Offset.Zero) }
    var failed by remember(menu.image) { mutableStateOf(false) }
    var loading by remember(menu.image) { mutableStateOf(true) }
    var imageAttempt by remember(menu.image) { mutableIntStateOf(0) }
    fun launch(intent: Intent) {
        try { context.startActivity(intent) } catch (_: ActivityNotFoundException) { Toast.makeText(context, (if (english) "No compatible app is available." else "No hay una aplicación compatible disponible."), Toast.LENGTH_LONG).show() }
    }
    Dialog(onDismissRequest = close, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxSize().testTag("digital-menu-viewer"), color = Color(0xFFF0F7FF)) {
            Column(Modifier.fillMaxSize().systemBarsPadding().padding(12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f).padding(8.dp)) {
                        Text((if (english) "DIGITAL MENU" else "MENÚ DIGITAL"), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                        Text(menu.title, fontWeight = FontWeight.Bold, maxLines = 2)
                    }
                    IconButton(onClick = { launch(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, "${menu.title}\nhttps://www.visitaloja.com/menu-digital.html?id=${menu.id}"), (if (english) "Share menu" else "Compartir menú"))) }) { Icon(Icons.Default.Share, (if (english) "Share menu" else "Compartir menú")) }
                    IconButton(onClick = close) { Icon(Icons.Default.Close, (if (english) "Close menu" else "Cerrar menú")) }
                }
                if (cached) Text((if (english) "Offline: the menu may have changed." else "Sin conexión: el menú puede haber cambiado."), style = MaterialTheme.typography.bodySmall)
                BoxWithConstraints(Modifier.weight(1f).fillMaxWidth().clip(RoundedCornerShape(12.dp))) {
                    val width = constraints.maxWidth.toFloat(); val height = constraints.maxHeight.toFloat()
                    key(menu.image, imageAttempt) {
                        AsyncImage(ImageRequest.Builder(context).data(menu.image).build(), (if (english) "Menu for ${menu.title}" else "Menú de ${menu.title}"),
                            Modifier.fillMaxSize().pointerInput(menu.image) {
                                detectTransformGestures { _, delta, zoom, _ ->
                                    scale = (scale * zoom).coerceIn(1f, 5f)
                                    pan = if (scale == 1f) Offset.Zero else Offset((pan.x + delta.x).coerceIn(-width * (scale - 1) / 2, width * (scale - 1) / 2), (pan.y + delta.y).coerceIn(-height * (scale - 1) / 2, height * (scale - 1) / 2))
                                }
                            }.graphicsLayer(scaleX = scale, scaleY = scale, translationX = pan.x, translationY = pan.y),
                            contentScale = ContentScale.Fit, onLoading = { loading = true; failed = false }, onSuccess = { loading = false; failed = false }, onError = { loading = false; failed = true })
                    }
                    if (loading) CircularProgressIndicator(Modifier.align(Alignment.Center))
                    if (failed) Column(Modifier.align(Alignment.Center).padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text((if (english) "Could not load the menu image." else "No se pudo cargar la imagen del menú."))
                        Button(onClick = { imageAttempt++; refresh() }) { Text((if (english) "Retry" else "Reintentar")) }
                    }
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = { scale = (scale - .5f).coerceAtLeast(1f); pan = Offset.Zero }, enabled = scale > 1f) { Icon(Icons.Default.Remove, (if (english) "Zoom out" else "Reducir menú")) }
                    TextButton(onClick = { scale = 1f; pan = Offset.Zero }) { Text((if (english) "${(scale * 100).toInt()}% · Reset" else "${(scale * 100).toInt()}% · Restablecer")) }
                    IconButton(onClick = { scale = (scale + .5f).coerceAtMost(5f) }, enabled = scale < 5f) { Icon(Icons.Default.Add, (if (english) "Zoom in" else "Ampliar menú")) }
                }
                Column(Modifier.heightIn(max = 160.dp).verticalScroll(rememberScrollState()), horizontalAlignment = Alignment.CenterHorizontally) {
                    menu.logo?.let { AsyncImage(it, (if (english) "Logo of ${menu.title}" else "Logo de ${menu.title}"), Modifier.fillMaxWidth().height(44.dp), contentScale = ContentScale.Fit) }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                        menu.whatsapp?.let { number -> TextButton(onClick = { launch(Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/$number"))) }) { Text("WhatsApp") } }
                        menu.instagram?.let { url -> TextButton(onClick = { launch(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }) { Text("Instagram") } }
                    }
                    Text((if (english) "Pinch to zoom · VisitaLoja.com" else "Amplía con dos dedos · VisitaLoja.com"), style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}
