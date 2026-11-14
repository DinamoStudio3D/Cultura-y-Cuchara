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
internal fun ReviewsEntry(place: Place, login: () -> Unit, visit: () -> Unit, english: Boolean = false) {
    var open by remember(place.id) { mutableStateOf(false) }
    OutlinedButton(onClick = { open = true }, modifier = Modifier.fillMaxWidth().semantics { testTagsAsResourceId = true }.testTag("open-verified-reviews")) {
        Icon(Icons.Default.StarBorder, null);Spacer(Modifier.width(8.dp));Text((if (english) "Verified reviews" else "Opiniones verificadas"))
    }
    if (open) ReviewsDialog(place, { open = false }, { open = false;login() }, { open = false;visit() }, english)
}

@OptIn(ExperimentalComposeUiApi::class)
@Composable
private fun ReviewsDialog(place: Place, close: () -> Unit, login: () -> Unit, visit: () -> Unit, english: Boolean) {
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
                    Text((if (english) "Verified reviews" else "Opiniones verificadas"), Modifier.weight(1f), fontWeight = FontWeight.Bold, fontSize = 20.sp)
                    IconButton(onClick = close) { Icon(Icons.Default.Close, (if (english) "Close reviews" else "Cerrar opiniones")) }
                }
                LazyColumn(Modifier.weight(1f).fillMaxWidth(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    item {
                        Surface(color = Color(0xFF0C3768), contentColor = Color.White, shape = RoundedCornerShape(22.dp)) {
                            Column(Modifier.fillMaxWidth().padding(22.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                Text(place.title, fontSize = 26.sp, fontWeight = FontWeight.ExtraBold)
                                Text((if (english) "Experiences from people with a visit registered in VisitaLoja." else "Experiencias de personas con una visita registrada en VisitaLoja."), color = Color(0xFFE2EFFF))
                                ReviewsPolicy.average(state.items)?.let { average -> Text(String.format(Locale.ROOT, "%.1f ★", average), fontSize = 32.sp, fontWeight = FontWeight.Bold) }
                                Text(if (state.items.isEmpty()) (if (english) "No reviews loaded yet." else "Aún no hay opiniones cargadas.") else if (english) "Average of ${state.items.size} loaded reviews." else "Media de estas ${state.items.size} opiniones${if (state.more) " cargadas" else ""}.")
                            }
                        }
                    }
                    item {
                        Text(if (state.ownExists) (if (english) "Your review" else "Tu opinión") else (if (english) "Share your experience" else "Comparte tu experiencia"), fontWeight = FontWeight.Bold, fontSize = 22.sp)
                        when {
                            state.uid == null -> { Text((if (english) "Sign in and register a visit to this business to leave a review." else "Inicia sesión y registra una visita en este negocio para dejar una opinión."));TextButton(onClick = login, modifier = Modifier.testTag("reviews-sign-in")) { Text((if (english) "Sign in" else "Ingresar a mi cuenta")) } }
                            state.ownLoading -> { LinearProgressIndicator(Modifier.fillMaxWidth());Text((if (english) "Checking your visit…" else "Comprobando tu visita…")) }
                            !state.ownReady -> { Text((if (english) "Connect to check your visit and review." else "Conéctate para comprobar tu visita y tu opinión."));TextButton(onClick = model::refreshOwn) { Text((if (english) "Check again" else "Volver a comprobar")) } }
                            !state.eligible && !state.ownExists -> { Text((if (english) "Once the business confirms your first visit, you can share a verified review." else "Después de que el negocio confirme tu primera visita podrás compartir una opinión verificada."));TextButton(onClick = visit) { Text((if (english) "Generate visit code" else "Generar código de visita")) } }
                            else -> Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                if (state.ownExists && state.own?.published == false) Text((if (english) "Your review is hidden by moderation. You can edit it; visibility remains subject to administration." else "Tu opinión está oculta por moderación. Puedes corregirla; su visibilidad seguirá dependiendo de administración."), color = MaterialTheme.colorScheme.onSurfaceVariant)
                                OutlinedTextField(name, { name = it.take(100);reviewed = false }, label = { Text((if (english) "Public name" else "Nombre público")) }, modifier = Modifier.fillMaxWidth(), enabled = !state.busy, singleLine = true)
                                Row {
                                    (1..5).forEach { value -> IconButton(onClick = { rating = value;reviewed = false }, enabled = !state.busy, modifier = Modifier.testTag("review-rating-$value")) { Icon(if (value <= rating) Icons.Default.Star else Icons.Default.StarBorder, (if (english) "$value stars" else "$value estrellas"), tint = Color(0xFFAC5900)) } }
                                }
                                OutlinedTextField(comment, { comment = it.take(600);reviewed = false }, label = { Text((if (english) "Your experience" else "Tu experiencia")) }, supportingText = { Text((if (english) "${comment.length}/600 · Public review" else "${comment.length}/600 · Opinión pública")) }, modifier = Modifier.fillMaxWidth().testTag("review-comment"), minLines = 3, maxLines = 8, enabled = !state.busy)
                                Row(verticalAlignment = Alignment.CenterVertically) { Checkbox(consent, { consent = it;reviewed = false }, enabled = !state.busy);Text((if (english) "I understand that my name and comment will be public." else "Entiendo que mi nombre y comentario serán públicos."), fontSize = 13.sp, modifier = Modifier.weight(1f)) }
                                validation?.let { Text(ReviewsPolicy.displayError(it, english), color = MaterialTheme.colorScheme.error) }
                                if (!reviewed) Button(onClick = { validation = ReviewsPolicy.error(name, rating, comment);if (validation == null && consent) reviewed = true }, enabled = consent && !state.busy, modifier = Modifier.fillMaxWidth()) { Text(if (state.busy) (if (english) "Saving…" else "Guardando…") else (if (english) "Review before publishing" else "Revisar opinión")) }
                                else {
                                    Card(colors = CardDefaults.cardColors(containerColor = Color.White)) { Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { Text(name.trim(), fontWeight = FontWeight.Bold);Text("★".repeat(rating), color = Color(0xFFAC5900));Text(comment.trim()) } }
                                    Button(onClick = { model.save(place.title, name, rating, comment);reviewed = false }, enabled = consent && !state.busy && state.ownReady, modifier = Modifier.fillMaxWidth().testTag("review-publish")) { Text(if (state.busy) (if (english) "Saving…" else "Guardando…") else if (state.ownExists) (if (english) "Confirm changes" else "Confirmar cambios") else (if (english) "Publish my review" else "Publicar mi opinión")) }
                                    TextButton(onClick = { reviewed = false }, enabled = !state.busy) { Text((if (english) "Keep editing" else "Seguir editando")) }
                                }
                            }
                        }
                        state.message?.let { Text(it, modifier = Modifier.padding(top = 10.dp), color = MaterialTheme.colorScheme.primary) }
                    }
                    item {
                        Text((if (english) "Published reviews" else "Opiniones publicadas"), fontSize = 22.sp, fontWeight = FontWeight.Bold, modifier = Modifier.testTag(if (state.publicLoaded && !state.loading && !state.failed) "reviews-public-ready" else "reviews-public-loading"))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            FilterChip(!high, { high = false }, { Text((if (english) "Most recent" else "Más recientes")) })
                            FilterChip(high, { high = true }, { Text((if (english) "Highest rated" else "Mejor valoradas")) })
                        }
                        if (state.more) Text((if (english) "Sorting and the average apply to loaded reviews. Load more at the end of the list." else "El orden y la media corresponden a las opiniones cargadas. Puedes consultar más al final de la lista."), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        TextButton(onClick = { model.load(true) }, enabled = !state.loading) { Text((if (english) "Refresh reviews" else "Actualizar opiniones")) }
                    }
                    if (state.loading) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
                    if (state.failed) item { Text((if (english) "Could not load current reviews. Check your connection." else "No pudimos consultar las opiniones actuales. Comprueba tu conexión."));TextButton(onClick = { model.load() }) { Text((if (english) "Retry" else "Reintentar")) } }
                    if (!state.loading && !state.failed && state.items.isEmpty()) item { Text((if (english) "Be among the first to share a verified experience." else "Sé de los primeros en compartir una experiencia verificada."), modifier = Modifier.testTag("reviews-empty")) }
                    items(ReviewsPolicy.sorted(state.items, high), key = { it.id }) { review ->
                        Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(18.dp)) {
                            Column(Modifier.fillMaxWidth().padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                Text(review.name, fontWeight = FontWeight.Bold)
                                Text("★".repeat(review.rating), color = Color(0xFFAC5900), fontSize = 19.sp)
                                Text((if (english) "Verified visit" else "Visita verificada"), color = MaterialTheme.colorScheme.primary, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                Text(review.comment, lineHeight = 23.sp)
                                if (review.updated > 0) Text(DateTimeFormatter.ofPattern("d MMM yyyy", if (english) Locale.ENGLISH else Locale("es", "EC")).withZone(BusinessMenuPolicy.zone).format(Instant.ofEpochMilli(review.updated)), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                    if (state.more && !state.loading) item { OutlinedButton(onClick = { model.load() }, modifier = Modifier.fillMaxWidth().testTag("reviews-load-more")) { Text((if (english) "Load more reviews" else "Cargar más opiniones")) } }
                }
            }
        }
    }
}
