package com.visitaloja.app

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat

@Composable
fun FirstRunPush(visible: Boolean, state: PushState, model: PushViewModel, openAccount: () -> Unit) {
    val context = LocalContext.current
    val prefs = remember(context) { context.getSharedPreferences("visitaloja-first-run", Context.MODE_PRIVATE) }
    var step by remember { mutableStateOf(prefs.getString("push-step", "offer") ?: "offer") }
    var requesting by rememberSaveable { mutableStateOf(false) }
    var requestedUid by rememberSaveable { mutableStateOf<String?>(null) }

    fun move(next: String) {
        step = next
        prefs.edit().putString("push-step", next).apply()
    }

    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (requesting) {
            requesting = false
            model.refresh()
            if (!granted || (requestedUid != null && requestedUid != state.uid)) move("done")
            else move("await-account")
        }
    }

    LaunchedEffect(step, state.uid, state.active, state.busy) {
        if (state.active) {
            if (step != "done") move("done")
        } else if (step == "await-account" && state.uid != null && !state.busy) {
            move("done")
            model.enable(state.uid)
        }
    }

    if (!visible || requesting || step == "done" || state.active) return
    Card(Modifier.padding(horizontal = 16.dp, vertical = 6.dp).fillMaxWidth().testTag("first-run-push"),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
        Column(Modifier.padding(14.dp)) {
            Text("Avisos de VisitaLoja", style = MaterialTheme.typography.titleMedium)
            Text(if (step == "await-account") "Ingresa para completar la activación en este dispositivo."
                else "Recibe promociones, eventos y novedades de Loja.", style = MaterialTheme.typography.bodyMedium)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = {
                    if (step == "await-account") openAccount()
                    else if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(context,
                            Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                        requestedUid = state.uid
                        requesting = true
                        permission.launch(Manifest.permission.POST_NOTIFICATIONS)
                    } else move("await-account")
                }) { Text(if (step == "await-account") "Iniciar sesión" else "Activar avisos") }
                TextButton(onClick = { move("done") }) { Text("Ahora no") }
            }
        }
    }
}
