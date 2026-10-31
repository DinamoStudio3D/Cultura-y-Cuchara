package com.visitaloja.app

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.res.painterResource
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.repeatOnLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive

@Composable
internal fun AnnouncementEntry(allowed: Boolean, model: AnnouncementViewModel = viewModel()) {
    val items by model.state.collectAsStateWithLifecycle()
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val context = LocalContext.current
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    var foreground by remember { mutableStateOf(false) }
    var visible by remember { mutableStateOf<EntryAnnouncement?>(null) }
    LaunchedEffect(lifecycle, allowed) {
        if (!allowed) { model.bind(false); foreground = false; return@LaunchedEffect }
        lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            foreground = true; model.bind(true)
            try { while (isActive) { now = System.currentTimeMillis(); delay(250) } }
            finally { foreground = false; model.bind(false) }
        }
    }
    DisposableEffect(model) { onDispose { model.bind(false) } }
    val candidate = AnnouncementPolicy.current(items, now)
    LaunchedEffect(candidate, allowed, foreground) {
        visible = null
        if (allowed && foreground && candidate != null && !model.hasSeen(candidate)) {
            delay(1500)
            // Check the clock again after delay, including device time changes.
            if (AnnouncementPolicy.current(items, System.currentTimeMillis()) == candidate) {
                model.shown(candidate); visible = candidate
            }
        }
    }
    val item = visible?.takeIf { allowed && foreground && it == candidate } ?: return
    AlertDialog(
        onDismissRequest = { visible = null },
        containerColor = Color(0xFFF5F8FF),
        title = { Column(verticalArrangement = Arrangement.spacedBy(8.dp)) { Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) { Image(painterResource(R.drawable.visitaloja_logo), "VisitaLoja.com", Modifier.size(44.dp)); Text("VisitaLoja", color = Color(0xFF173A70), style = MaterialTheme.typography.labelLarge) }; Text(item.title, color = Color(0xFF102746)) } },
        text = { Column(Modifier.heightIn(max = 480.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item.image?.let { AsyncImage(it, contentDescription = item.title, modifier = Modifier.fillMaxWidth().height(240.dp), contentScale = ContentScale.Fit) }
            if (item.description.isNotBlank()) Text(item.description, color = Color(0xFF243650))
        } },
        confirmButton = { item.contact?.let { link -> TextButton(onClick = { runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(link))) } }) { Text("Consultar disponibilidad") } } },
        dismissButton = { TextButton(onClick = { visible = null }) { Text("Cerrar") } }
    )
}
