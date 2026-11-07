package com.visitaloja.app

import android.widget.FrameLayout
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView

@androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
@Composable
internal fun FileVideoDialogContent(video: LojaVideo, close: () -> Unit) {
    val context = LocalContext.current
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    var error by remember(video.source.url) { mutableStateOf(false) }
    val player = remember(video.source.url) {
        ExoPlayer.Builder(context)
            .setMediaSourceFactory(DefaultMediaSourceFactory(DefaultDataSource.Factory(context, DefaultHttpDataSource.Factory().setUserAgent("VisitaLojaAndroid").setAllowCrossProtocolRedirects(false))))
            .setAudioAttributes(AudioAttributes.DEFAULT, true).setHandleAudioBecomingNoisy(true).build().apply {
                addListener(object : Player.Listener { override fun onPlayerError(e: PlaybackException) { error = true } })
                setMediaItem(MediaItem.fromUri(video.source.url)); prepare()
            }
    }
    DisposableEffect(player, lifecycle) {
        val observer = LifecycleEventObserver { _, event -> if (event == Lifecycle.Event.ON_STOP) player.pause() }
        lifecycle.addObserver(observer)
        onDispose { lifecycle.removeObserver(observer); player.release() }
    }
    Surface(color = Color(0xFF10243A), contentColor = Color.White, modifier = Modifier.fillMaxSize().systemBarsPadding()) {
        BoxWithConstraints {
            val compact = maxHeight < 440.dp
            Column(Modifier.fillMaxSize()) {
                VideoDialogHeading(video, close)
                AndroidView(factory = { PlayerView(it).apply { this.player = player; useController = true; resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT; setShowBuffering(PlayerView.SHOW_BUFFERING_WHEN_PLAYING) } }, onReset = null, onRelease = { it.player = null }, modifier = if (compact) Modifier.fillMaxWidth().weight(1f) else Modifier.fillMaxWidth().aspectRatio(16f / 9).heightIn(min = 200.dp))
                if (!compact) Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(video.title, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                    if (error) {
                        Text("No se pudo cargar el video. Comprueba tu conexión y vuelve a intentarlo.", color = Color(0xFFFFCEBE))
                        OutlinedButton(onClick = { error = false; player.prepare(); player.play() }) { Text("Reintentar", color = Color.White) }
                    }
                    if (video.description.isNotBlank()) Text(video.description, fontSize = 13.sp)
                    if (video.credit.isNotBlank()) Text("Crédito: ${video.credit}", fontSize = 12.sp, color = Color(0xFFCCE1F6))
                    Text("Se pausa al salir de la app.", fontSize = 11.sp, color = Color(0xFFCCE1F6))
                }
            }
        }
    }
}
