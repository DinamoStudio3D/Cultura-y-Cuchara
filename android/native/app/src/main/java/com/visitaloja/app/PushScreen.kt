package com.visitaloja.app

import android.Manifest
import android.content.Intent
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import java.time.Instant
import java.time.format.DateTimeFormatter

@Composable
fun PushScreen(state: PushState, model: PushViewModel, account: () -> Unit, destination: (String) -> Unit) {
    val context = LocalContext.current
    var consent by remember(state.uid, state.active) { mutableStateOf(state.active) }
    var pending by remember { mutableStateOf<String?>(null) }
    var permissionUid by remember { mutableStateOf<String?>(null) }
    var denied by remember { mutableStateOf(false) }
    var clearConfirm by remember { mutableStateOf(false) }
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    DisposableEffect(lifecycle) {
        val observer = LifecycleEventObserver { _, event -> if (event == Lifecycle.Event.ON_RESUME) model.refresh() }
        lifecycle.addObserver(observer); onDispose { lifecycle.removeObserver(observer) }
    }
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        val work = pending; pending = null; model.refresh(); denied = !granted
        if (granted) {
            if (work == "enable" && permissionUid != null && permissionUid == state.uid && consent) permissionUid?.let(model::enable)
            if (work == "test") model.localTest()
        }
    }
    fun request(work: String) {
        if (Build.VERSION.SDK_INT >= 33 && !state.permission) { pending = work; permissionUid = state.uid; permission.launch(Manifest.permission.POST_NOTIFICATIONS) }
        else if (work == "enable") state.uid?.let(model::enable) else model.localTest()
    }
    LazyColumn(Modifier.fillMaxSize().testTag("push-screen"), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Image(painterResource(R.drawable.visitaloja_logo), "VisitaLoja", Modifier.size(64.dp))
                Column(Modifier.weight(1f).padding(start = 12.dp)) {
                    Text("LOJA, CONTIGO", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
                    Text("Avisos y novedades", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                }
            }
            Text("Eventos, novedades y promociones de VisitaLoja. Tú decides si quieres recibirlos en este móvil.", Modifier.padding(top = 14.dp))
        }
        item {
            Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Icon(Icons.Default.NotificationsActive, null, tint = MaterialTheme.colorScheme.primary)
                Text(if (state.active && state.permission) "Activadas en este móvil" else if (state.active) "Android tiene los avisos bloqueados" else "Actívalas cuando quieras", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                if (state.uid == null) {
                    Text("Ingresa con tu cuenta de VisitaLoja para activar los próximos avisos del panel.")
                    Button(onClick = account) { Text("Ingresar a mi cuenta") }
                } else {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(checked = consent, onCheckedChange = { consent = it }, enabled = !state.busy && !state.active)
                        Text("Quiero recibir novedades, eventos y promociones de VisitaLoja.", Modifier.weight(1f))
                    }
                    if (!state.active) Button(onClick = { request("enable") }, enabled = consent && !state.busy, modifier = Modifier.fillMaxWidth().testTag("push-enable")) { Text("Activar notificaciones") }
                    else OutlinedButton(onClick = { state.uid?.let(model::disable) }, enabled = !state.busy, modifier = Modifier.fillMaxWidth()) { Text("Desactivar en este móvil") }
                }
                if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                if (denied || state.active && !state.permission) Text("Puedes permitirlas desde los ajustes de Android. La activación es opcional.", style = MaterialTheme.typography.bodySmall)
                TextButton(onClick = { context.startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)) }) { Text("Abrir ajustes de Android") }
            } }
        }
        state.message?.let { message -> item { Text(message, color = MaterialTheme.colorScheme.primary) } }
        item {
            OutlinedButton(onClick = { request("test") }, enabled = !state.busy, modifier = Modifier.fillMaxWidth().testTag("push-local-test")) { Text("Probar aviso local") }
            Text("La prueba local solo comprueba que Android pueda mostrar el aviso. El envío desde el panel se prueba por separado después de activar la suscripción.", style = MaterialTheme.typography.bodySmall)
        }
        item {
            Text("Recibidos en este móvil", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Text("Hasta 20 avisos recibidos aquí con tu cuenta. Los anteriores a la activación no se descargan.", style = MaterialTheme.typography.bodySmall)
            if (state.notices.isEmpty()) Text("Todavía no hay avisos recibidos en este móvil.", Modifier.padding(vertical = 14.dp))
            else TextButton(onClick = { clearConfirm = true }) { Text("Borrar historial de este móvil") }
        }
        items(state.notices, key = { it.id }) { notice ->
            Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(notice.title, fontWeight = FontWeight.Bold)
                Text(notice.body)
                Text(DateTimeFormatter.ofPattern("dd/MM/yyyy · HH:mm").withZone(AgendaPolicy.zone).format(Instant.ofEpochMilli(notice.receivedAt)), style = MaterialTheme.typography.bodySmall)
                TextButton(onClick = { destination(notice.url) }) { Text("Ver información") }
            } }
        }
    }
    if (clearConfirm) AlertDialog(onDismissRequest = { clearConfirm = false }, title = { Text("¿Borrar el historial de este móvil?") }, text = { Text("Se eliminarán los avisos guardados aquí. Seguirás suscrito si las notificaciones están activadas.") }, confirmButton = { TextButton(onClick = { clearConfirm = false; model.clearHistory(state.uid) }) { Text("Borrar historial") } }, dismissButton = { TextButton(onClick = { clearConfirm = false }) { Text("Cancelar") } })
}
