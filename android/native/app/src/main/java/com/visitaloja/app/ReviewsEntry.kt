package com.visitaloja.app

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.StarBorder
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import java.time.Instant
import java.time.format.DateTimeFormatter
import java.util.Locale

@OptIn(ExperimentalComposeUiApi::class)
@Composable
internal fun ReviewsEntry(place: Place, login: () -> Unit, visit: () -> Unit) {
    var open by remember(place.id) { mutableStateOf(false) }
    OutlinedButton(onClick = { open = true }, modifier = Modifier.fillMaxWidth().semantics { testTagsAsResourceId = true }.testTag("open-verified-reviews")) {
        Icon(Icons.Default.StarBorder, null);Spacer(Modifier.width(8.dp));Text("Opiniones verificadas")
    }
    if (open) ReviewsDialog(place, { open = false }, { open = false;login() }, { open = false;visit() })
}

@OptIn(ExperimentalComposeUiApi::class)
@Composable
private fun ReviewsDialog(place: Place, close: () -> Unit, login: () -> Unit, visit: () -> Unit) {
    val model: ReviewsViewModel = viewModel(key = "verified-reviews")
    val state by model.state.collectAsStateWithLifecycle()
    DisposableEffect(place.id) { model.bind(place.id);onDispose { model.bind(null) } }
    var high by remember(place.id) { mutableStateOf(false) }
    var name by remember(place.id, state.uid, state.own) { mutableStateOf(state.own?.name ?: state.defaultName.ifBlank { "Visitante" }) }
    var rating by remember(place.id, state.uid, state.own) { mutableIntStateOf(state.own?.rating ?: 5) }
    var comment by remember(place.id, state.uid, state.own) { mutableStateOf(state.own?.comment.orEmpty()) }
    var consent by remember(place.id, state.uid, state.own) { mutableStateOf(false) }
    var reviewed by remember(place.id, state.uid, state.own, state.saved) { mutableStateOf(false) }
    var validation by remember(place.id, state.uid) { mutableStateOf<String?>(null) }
    Dialog(onDismissRequest = close, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(color = Color(0xFFF0F7FF), modifier = Modifier.fillMaxSize().semantics { testTagsAsResourceId = true }.testTag("verified-reviews-screen")) {
            Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding()) {
                Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("Opiniones verificadas", Modifier.weight(1f), fontWeight = FontWeight.Bold, fontSize = 20.sp)
                    IconButton(onClick = close) { Icon(Icons.Default.Close, "Cerrar opiniones") }
                }
                LazyColumn(Modifier.weight(1f).fillMaxWidth(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    item {
                        Surface(color = Color(0xFF0C3768), contentColor = Color.White, shape = RoundedCornerShape(22.dp)) {
                            Column(Modifier.fillMaxWidth().padding(22.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                Text(place.title, fontSize = 26.sp, fontWeight = FontWeight.ExtraBold)
                                Text("Experiencias de personas con una visita registrada en VisitaLoja.", color = Color(0xFFE2EFFF))
                                ReviewsPolicy.average(state.items)?.let { average -> Text(String.format(Locale.ROOT, "%.1f ★", average), fontSize = 32.sp, fontWeight = FontWeight.Bold) }
                                Text(if (state.items.isEmpty()) "Aún no hay opiniones cargadas." else "Media de estas ${state.items.size} opiniones${if (state.more) " cargadas" else ""}.")
                            }
                        }
                    }
                    item {
                        Text(if (state.ownExists) "Tu opinión" else "Comparte tu experiencia", fontWeight = FontWeight.Bold, fontSize = 22.sp)
                        when {
                            state.uid == null -> { Text("Inicia sesión y registra una visita en este negocio para dejar una opinión.");TextButton(onClick = login, modifier = Modifier.testTag("reviews-sign-in")) { Text("Ingresar a mi cuenta") } }
                            state.ownLoading -> { LinearProgressIndicator(Modifier.fillMaxWidth());Text("Comprobando tu visita…") }
                            !state.ownReady -> { Text("Conéctate para comprobar tu visita y tu opinión.");TextButton(onClick = model::refreshOwn) { Text("Volver a comprobar") } }
                            !state.eligible && !state.ownExists -> { Text("Después de que el negocio confirme tu primera visita podrás compartir una opinión verificada.");TextButton(onClick = visit) { Text("Generar código de visita") } }
                            else -> Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                if (state.ownExists && state.own?.published == false) Text("Tu opinión está oculta por moderación. Puedes corregirla; su visibilidad seguirá dependiendo de administración.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                                OutlinedTextField(name, { name = it.take(100);reviewed = false }, label = { Text("Nombre público") }, modifier = Modifier.fillMaxWidth(), enabled = !state.busy, singleLine = true)
                                Row {
                                    (1..5).forEach { value -> IconButton(onClick = { rating = value;reviewed = false }, enabled = !state.busy, modifier = Modifier.testTag("review-rating-$value")) { Icon(if (value <= rating) Icons.Default.Star else Icons.Default.StarBorder, "$value estrellas", tint = Color(0xFFAC5900)) } }
                                }
                                OutlinedTextField(comment, { comment = it.take(600);reviewed = false }, label = { Text("Tu experiencia") }, supportingText = { Text("${comment.length}/600 · Opinión pública") }, modifier = Modifier.fillMaxWidth().testTag("review-comment"), minLines = 3, maxLines = 8, enabled = !state.busy)
                                Row(verticalAlignment = Alignment.CenterVertically) { Checkbox(consent, { consent = it;reviewed = false }, enabled = !state.busy);Text("Entiendo que mi nombre y comentario serán públicos.", fontSize = 13.sp, modifier = Modifier.weight(1f)) }
                                validation?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                                if (!reviewed) Button(onClick = { validation = ReviewsPolicy.error(name, rating, comment);if (validation == null && consent) reviewed = true }, enabled = consent && !state.busy, modifier = Modifier.fillMaxWidth()) { Text("Revisar opinión") }
                                else {
                                    Card(colors = CardDefaults.cardColors(containerColor = Color.White)) { Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { Text(name.trim(), fontWeight = FontWeight.Bold);Text("★".repeat(rating), color = Color(0xFFAC5900));Text(comment.trim()) } }
                                    Button(onClick = { model.save(place.title, name, rating, comment);reviewed = false }, enabled = consent && !state.busy && state.ownReady, modifier = Modifier.fillMaxWidth().testTag("review-publish")) { Text(if (state.busy) "Guardando…" else if (state.ownExists) "Confirmar cambios" else "Publicar mi opinión") }
                                    TextButton(onClick = { reviewed = false }, enabled = !state.busy) { Text("Seguir editando") }
                                }
                            }
                        }
                        state.message?.let { Text(it, modifier = Modifier.padding(top = 10.dp), color = MaterialTheme.colorScheme.primary) }
                    }
                    item {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            FilterChip(!high, { high = false }, { Text("Más recientes") })
                            FilterChip(high, { high = true }, { Text("Mejor valoradas") })
                        }
                        if (state.more) Text("El orden y la media corresponden a las opiniones cargadas. Puedes consultar más al final de la lista.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        TextButton(onClick = { model.load(true) }, enabled = !state.loading) { Text("Actualizar opiniones") }
                    }
                    if (state.loading) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
                    if (state.failed) item { Text("No pudimos consultar las opiniones actuales. Comprueba tu conexión.");TextButton(onClick = { model.load() }) { Text("Reintentar") } }
                    if (!state.loading && !state.failed && state.items.isEmpty()) item { Text("Sé de los primeros en compartir una experiencia verificada.", modifier = Modifier.testTag("reviews-empty")) }
                    items(ReviewsPolicy.sorted(state.items, high), key = { it.id }) { review ->
                        Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(18.dp)) {
                            Column(Modifier.fillMaxWidth().padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                Text(review.name, fontWeight = FontWeight.Bold)
                                Text("★".repeat(review.rating), color = Color(0xFFAC5900), fontSize = 19.sp)
                                Text("Visita verificada", color = MaterialTheme.colorScheme.primary, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                Text(review.comment, lineHeight = 23.sp)
                                if (review.updated > 0) Text(DateTimeFormatter.ofPattern("d MMM yyyy", Locale("es", "EC")).withZone(BusinessMenuPolicy.zone).format(Instant.ofEpochMilli(review.updated)), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                    if (state.more && !state.loading) item { OutlinedButton(onClick = { model.load() }, modifier = Modifier.fillMaxWidth().testTag("reviews-load-more")) { Text("Cargar más opiniones") } }
                }
            }
        }
    }
}
