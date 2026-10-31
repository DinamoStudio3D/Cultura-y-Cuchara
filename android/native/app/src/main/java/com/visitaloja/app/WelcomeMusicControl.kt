package com.visitaloja.app

import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp

@Composable
internal fun WelcomeMusicControl(audio: DiscoveryAudioState, toggle: () -> Unit) {
    val current = audio.key == WelcomeMusicPolicy.KEY
    val playing = current && (audio.playing || audio.buffering)
    val failed = current && audio.error != null
    val label = if (current && audio.playing) "Pausar música de bienvenida" else if (current && audio.buffering) "Pausar carga de música de bienvenida" else if (failed) "Reintentar música de bienvenida" else "Reanudar música de bienvenida"
    FloatingActionButton(onClick = toggle, modifier = Modifier.size(48.dp).testTag("welcome-music-toggle"), containerColor = Color(0xFF075BB2), contentColor = Color.White) {
        Icon(if (playing) Icons.Default.Pause else if (failed) Icons.Default.Refresh else Icons.Default.PlayArrow, label,
            Modifier.size(23.dp).testTag(if (current && audio.playing) "welcome-music-playing" else if (current && audio.buffering) "welcome-music-buffering" else if (failed) "welcome-music-error" else "welcome-music-paused"))
    }
}
