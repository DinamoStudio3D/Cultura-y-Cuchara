package com.visitaloja.app

import android.content.Intent
import android.net.Uri
import android.text.Html
import android.widget.Toast
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.repeatOnLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.awaitCancellation

@Composable
internal fun PlatformContactScreen(legal: (String) -> Unit, model: PlatformContactViewModel = viewModel()) {
    val content by model.state.collectAsStateWithLifecycle()
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val context = LocalContext.current
    var english by rememberSaveable { mutableStateOf(false) }
    LaunchedEffect(lifecycle, english) {
        lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            model.bind(true, english)
            try { awaitCancellation() } finally { model.bind(false) }
        }
    }
    DisposableEffect(model) { onDispose { model.bind(false) } }
    val data = content.value
    fun open(link: String, email: Boolean = false) {
        runCatching { context.startActivity(Intent(if (email) Intent.ACTION_SENDTO else Intent.ACTION_VIEW, Uri.parse(link))) }
            .onFailure { Toast.makeText(context, "No se pudo abrir una aplicación para este enlace.", Toast.LENGTH_SHORT).show() }
    }
    LazyColumn(Modifier.fillMaxSize().testTag("platform-contact-screen"), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item {
            Surface(color = Color(0xFF0C3768), contentColor = Color.White, shape = RoundedCornerShape(24.dp)) {
                Column(Modifier.fillMaxWidth().padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Image(painterResource(R.drawable.visitaloja_logo), "VisitaLoja.com", Modifier.size(88.dp))
                    Text("VISITALOJA · LOJA, ECUADOR", fontSize = 11.sp, color = Color(0xFFABDBFF))
                    Text(data.title, fontSize = 28.sp, lineHeight = 33.sp, fontWeight = FontWeight.ExtraBold)
                    Text(data.description, lineHeight = 23.sp)
                }
            }
        }
        item { Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(!english, { english = false }, label = { Text("Español") })
            FilterChip(english, { english = true }, label = { Text("English") })
        } }
        when {
            content.loading -> item { LinearProgressIndicator(Modifier.fillMaxWidth()); Text("Consultando los contactos publicados…") }
            content.error -> item { Text("No pudimos consultar los contactos. Conéctate y vuelve a intentarlo."); TextButton(onClick = { model.bind(true, english) }) { Text("Reintentar") } }
            else -> {
                item { Text(if (english) "Contact and social media" else "Contacto y redes sociales", fontSize = 22.sp, fontWeight = FontWeight.Bold, modifier = Modifier.testTag("platform-contact-ready")) }
                data.email?.let { email -> item {
                    OutlinedButton(onClick = { open("mailto:${Uri.encode(email)}?subject=Contacto%20desde%20Visita%20Loja", true) }, modifier = Modifier.fillMaxWidth().testTag("platform-email")) {
                        Icon(Icons.Default.Email, null); Spacer(Modifier.width(10.dp)); Text(email, modifier = Modifier.weight(1f)); Icon(Icons.Default.OpenInNew, "Abrir correo")
                    }
                } }
                items(data.links) { (name, link) ->
                    OutlinedButton(onClick = { open(link) }, modifier = Modifier.fillMaxWidth().testTag("platform-link-$name")) { Text(name, Modifier.weight(1f)); Icon(Icons.Default.OpenInNew, "Abrir $name") }
                }
                if (data.email == null && data.links.isEmpty()) item { Text("No hay canales de contacto publicados por ahora.") }
                if (data.footer.isNotBlank()) item { Text(data.footer, color = MaterialTheme.colorScheme.onSurfaceVariant, lineHeight = 22.sp) }
            }
        }
        item { HorizontalDivider(); Text("Información y tus datos", fontSize = 21.sp, fontWeight = FontWeight.Bold) }
        item { OutlinedButton(onClick = { legal("privacy") }, modifier = Modifier.fillMaxWidth().testTag("platform-privacy")) { Icon(Icons.Default.PrivacyTip, null); Spacer(Modifier.width(8.dp)); Text("Privacidad y uso de tus datos") } }
        item { OutlinedButton(onClick = { legal("terms") }, modifier = Modifier.fillMaxWidth().testTag("platform-terms")) { Icon(Icons.Default.Description, null); Spacer(Modifier.width(8.dp)); Text("Términos de uso") } }
        item { Text("Los canales externos se abren solo cuando los pulsas. Los mensajes se envían desde la aplicación que elijas.", style = MaterialTheme.typography.bodySmall) }
    }
}

@OptIn(ExperimentalComposeUiApi::class)
@Composable
internal fun LegalDialog(document: String, close: () -> Unit, change: (String) -> Unit) {
    Dialog(onDismissRequest = close, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxSize().semantics { testTagsAsResourceId = true }, color = Color(0xFFF0F7FF)) {
            Column { Row(Modifier.fillMaxWidth().statusBarsPadding().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = close) { Icon(Icons.Default.Close, "Cerrar documento") }
                Text(if (document == "privacy") "Tu privacidad" else "Términos de uso", fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                Image(painterResource(R.drawable.visitaloja_logo), "VisitaLoja.com", Modifier.size(44.dp))
            }; LegalScreen(document, change, Modifier.weight(1f).navigationBarsPadding()) }
        }
    }
}

@Composable
internal fun LegalScreen(document: String, change: (String) -> Unit, modifier: Modifier = Modifier, model: LegalViewModel = viewModel(key = "platform-legal")) {
    val fetched by model.state.collectAsStateWithLifecycle()
    val content = if (fetched.document == document) fetched else LegalContent()
    val scroll = remember(document) { LazyListState() }
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val context = LocalContext.current
    LaunchedEffect(document, lifecycle) {
        lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            model.load(document)
            try { awaitCancellation() } finally { model.stop() }
        }
    }
    DisposableEffect(model) { onDispose { model.stop() } }
    LazyColumn(modifier.fillMaxSize().testTag("platform-legal-screen"), state = scroll, contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        if (content.loading) item { LinearProgressIndicator(Modifier.fillMaxWidth()); Text("Consultando el documento publicado…") }
        else {
            item { Text(if (content.bundled) "No pudimos confirmar la actualización. Se muestra la versión incluida en esta app." else "Documento consultado en VisitaLoja.com", style = MaterialTheme.typography.bodySmall, modifier = Modifier.testTag("platform-legal-ready")) }
            if (content.blocks.isEmpty()) item { Text("El documento no está disponible. Puedes abrir la versión de la web.") }
            items(content.blocks) { block ->
                val text = remember(block.html) { Html.fromHtml(block.html, Html.FROM_HTML_MODE_LEGACY).toString().trim() }
                SelectionContainer { Text(text, fontSize = when (block.kind) { "h1" -> 28.sp; "h2" -> 20.sp; else -> 16.sp }, fontWeight = if (block.kind.startsWith("h")) FontWeight.Bold else FontWeight.Normal, lineHeight = if (block.kind == "h1") 34.sp else 25.sp, color = Color(0xFF18334F)) }
            }
            item { TextButton(onClick = { model.load(document) }) { Text("Actualizar documento") } }
            item { OutlinedButton(onClick = { change(if (document == "privacy") "terms" else "privacy") }, modifier = Modifier.fillMaxWidth().testTag("platform-other-legal")) { Text(if (document == "privacy") "Ver términos de uso" else "Ver política de privacidad") } }
            item { TextButton(onClick = { runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(PlatformPolicy.documentUrl(document)))) }.onFailure { Toast.makeText(context, "No se pudo abrir el navegador.", Toast.LENGTH_SHORT).show() } }) { Text("Ver documento en la web") } }
        }
    }
}
