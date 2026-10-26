package com.visitaloja.app

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class DiscoveryAudioState(val key: String? = null, val title: String = "", val url: String? = null,
    val playing: Boolean = false, val buffering: Boolean = false, val position: Long = 0,
    val duration: Long = 0, val error: String? = null)

/** One foreground player: never auto-plays a different recording, never writes to Firestore. */
@androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
class DiscoveryAudioViewModel(app: Application) : AndroidViewModel(app) {
    private val mutable = MutableStateFlow(DiscoveryAudioState())
    val state = mutable.asStateFlow()
    private val player = ExoPlayer.Builder(app)
        .setMediaSourceFactory(DefaultMediaSourceFactory(DefaultDataSource.Factory(app,
            DefaultHttpDataSource.Factory().setUserAgent("VisitaLojaAndroid").setAllowCrossProtocolRedirects(false))))
        .setAudioAttributes(AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_SPEECH).build(), true)
        .setHandleAudioBecomingNoisy(true).build()
    init {
        player.addListener(object : Player.Listener {
            override fun onEvents(player: Player, events: Player.Events) { update() }
            override fun onPlayerError(error: PlaybackException) {
                mutable.update { it.copy(playing = false, buffering = false, error = "No se pudo reproducir el audio. Comprueba tu conexión e inténtalo de nuevo.") }
            }
        })
        viewModelScope.launch { while (true) { update(); delay(500) } }
    }
    private fun update() {
        mutable.update { it.copy(playing = player.isPlaying, buffering = player.playbackState == Player.STATE_BUFFERING && player.playWhenReady,
            position = player.currentPosition.coerceAtLeast(0), duration = player.duration.takeIf { duration -> duration != C.TIME_UNSET && duration > 0 } ?: 0) }
    }
    fun play(key: String, title: String, url: String) {
        if (DiscoveryPolicy.media(url) != url) return
        if (mutable.value.key == key && mutable.value.url == url) { toggle(); return }
        player.stop()
        mutable.value = DiscoveryAudioState(key = key, title = title, url = url)
        player.setMediaItem(MediaItem.fromUri(url)); player.prepare(); player.play()
    }
    fun toggle() {
        if (mutable.value.key == null) return
        if (player.playWhenReady && player.playbackState != Player.STATE_ENDED) player.pause() else {
            mutable.update { it.copy(error = null) }
            if (player.playerError != null || player.playbackState == Player.STATE_IDLE) player.prepare()
            if (player.playbackState == Player.STATE_ENDED) player.seekTo(0)
            player.play()
        }
    }
    fun seek(position: Long) { if (mutable.value.duration > 0) player.seekTo(position.coerceIn(0, mutable.value.duration)) }
    fun pause() { player.pause() }
    fun close() { player.stop(); player.clearMediaItems(); mutable.value = DiscoveryAudioState() }
    /** A publication removed or replaced in the admin panel must not continue playing. */
    fun reconcile(content: DiscoveryState) {
        val active = mutable.value
        val key = active.key ?: return
        if (key == "podcast") {
            val source = content.podcast
            if (!source.loading && !source.cached && !source.error && source.value?.audio != active.url) close()
        } else if (key.startsWith("time:")) {
            val source = content.history
            if (!source.loading && !source.cached && !source.error && source.value.find { "time:${it.id}" == key }?.audio != active.url) close()
        }
    }
    override fun onCleared() { player.release(); super.onCleared() }
}
