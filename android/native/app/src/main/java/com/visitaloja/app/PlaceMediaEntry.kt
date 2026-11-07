package com.visitaloja.app

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive

@Composable
internal fun PlaceMediaEntry(place: Place, fresh: Boolean, audio: DiscoveryAudioState, player: DiscoveryAudioViewModel) {
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val now by produceState(System.currentTimeMillis(), lifecycle) {
        lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) { while (isActive) { value = System.currentTimeMillis(); delay(15_000) } }
    }
    val source = PlaceMediaPolicy.video(place, now).takeIf { fresh }
    var selected by rememberSaveable(place.id) { mutableStateOf<String?>(null) }
    LaunchedEffect(source?.url) { if (selected != source?.url) selected = null }
    if (source != null || place.media.audioEs != null || place.media.audioEn != null) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth().testTag("place-media")) {
            Text("Conoce este lugar", fontWeight = FontWeight.Bold)
            if (source != null) FilledTonalButton(onClick = { player.pause(); selected = source.url }, modifier = Modifier.fillMaxWidth().testTag("place-video"), shape = RoundedCornerShape(13.dp)) {
                Icon(Icons.Default.PlayCircle, null);Spacer(Modifier.width(8.dp));Text("Conoce este lugar por video")
            }
            listOf(false to place.media.audioEs, true to place.media.audioEn).forEach { (english, url) ->
                if (url != null) {
                    val key = PlaceMediaPolicy.audioKey(place, english)
                    val active = audio.key == key && audio.url == url
                    val language = if (english) "inglés" else "español"
                    val waiting = active && audio.buffering
                    val playing = active && audio.playing
                    OutlinedButton(onClick = { if (waiting || playing) player.pause() else player.play(key, "${place.title} · $language", url) }, modifier = Modifier.fillMaxWidth().testTag(if (english) "place-audio-en" else "place-audio-es"), shape = RoundedCornerShape(13.dp)) {
                        Icon(if (waiting || playing) Icons.Default.Pause else Icons.Default.Headphones, null);Spacer(Modifier.width(8.dp));Text(if (waiting) "Cargando audio en $language…" else if (playing) "Pausar audio en $language" else if (active && audio.error != null) "Reintentar audio en $language" else "Escuchar en $language")
                    }
                    if (active && audio.error != null) Text(audio.error, color = MaterialTheme.colorScheme.error)
                }
            }
        }
    }
    if (source != null && selected == source.url) VideoDialog(LojaVideo("place:${place.id}", place.title, place.description.take(350), "", source, source.thumbnail)) { selected = null }
}
