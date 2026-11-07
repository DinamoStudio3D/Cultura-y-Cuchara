package com.visitaloja.app

import android.os.Bundle
import android.content.Intent
import androidx.compose.runtime.mutableStateOf
import java.util.UUID
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.SystemBarStyle

class MainActivity : ComponentActivity() {
    private var noticeRequest by mutableIntStateOf(0)
    private var linkRequest by mutableStateOf<NativeLinkRequest?>(null)
    private fun receive(intent: Intent) {
        if (intent.action == NativePush.openAction) noticeRequest++
        val text = when {
            intent.action == Intent.ACTION_VIEW -> intent.dataString
            intent.action == Intent.ACTION_SEND && intent.type == "text/plain" -> intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString()
            else -> null
        }
        if (text != null) linkRequest = NativeLinkRequest(UUID.randomUUID().toString(), text.take(4097))
    }
    override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); setIntent(intent); receive(intent) }
    override fun onSaveInstanceState(outState: Bundle) {
        linkRequest?.let { outState.putString("linkRequestId", it.id); outState.putString("linkRequestText", it.text) }
        super.onSaveInstanceState(outState)
    }
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(statusBarStyle = SystemBarStyle.light(android.graphics.Color.TRANSPARENT, android.graphics.Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.light(android.graphics.Color.TRANSPARENT, android.graphics.Color.TRANSPARENT))
        val restoredId = savedInstanceState?.getString("linkRequestId")
        val restoredText = savedInstanceState?.getString("linkRequestText")
        if (restoredId != null && restoredText != null) linkRequest = NativeLinkRequest(restoredId, restoredText) else receive(intent)
        setContent { VisitaLojaApp(noticeRequest = noticeRequest, linkRequest = linkRequest) }
    }
}
