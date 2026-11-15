package com.visitaloja.app

import android.Manifest
import android.app.Application
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.NearMe
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.sp
import androidx.compose.ui.unit.dp
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

class NearbyViewModel(app: Application) : AndroidViewModel(app) {
    private val prefs = NearbyGeofences.prefs(app)
    private val _enabled: MutableStateFlow<Boolean> = MutableStateFlow(NearbyGeofences.enabled(app))
    val enabled: StateFlow<Boolean> = _enabled.asStateFlow()
    private val _status: MutableStateFlow<String> = MutableStateFlow(prefs.getString("status", "Desactivados") ?: "Desactivados")
    val status: StateFlow<String> = _status.asStateFlow()
    private val listener = SharedPreferences.OnSharedPreferenceChangeListener { _, _ ->
        _enabled.value = NearbyGeofences.enabled(app)
        _status.value = prefs.getString("status", "Desactivados") ?: "Desactivados"
    }
    init { prefs.registerOnSharedPreferenceChangeListener(listener) }
    private var reconciled = false
    private var lastAvailability = false
    fun enable(value: Boolean) = NearbyGeofences.setEnabled(getApplication(), value)
    fun reconcile() {
        val available = NearbyGeofences.available(getApplication())
        if (_enabled.value) NearbyGeofences.sync(getApplication(), force = !reconciled || available != lastAvailability)
        reconciled = true
        lastAvailability = available
    }
    override fun onCleared() { prefs.unregisterOnSharedPreferenceChangeListener(listener) }
}

@Composable
fun NearbySession(model: NearbyViewModel, places: List<Place>, fetchedAt: Long) {
    val context = LocalContext.current
    val owner = LocalLifecycleOwner.current
    LaunchedEffect(places, fetchedAt) { if (fetchedAt > 0) NearbyGeofences.save(context, places, fetchedAt) }
    DisposableEffect(owner, model) {
        val observer = LifecycleEventObserver { _, event -> if (event == Lifecycle.Event.ON_RESUME) model.reconcile() }
        owner.lifecycle.addObserver(observer)
        if (owner.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) model.reconcile()
        onDispose { owner.lifecycle.removeObserver(observer) }
    }
}

@Composable
fun NearbySettings(enabled: Boolean, status: String, setEnabled: (Boolean) -> Unit, dismiss: () -> Unit) {
    val context = LocalContext.current
    val owner = LocalLifecycleOwner.current
    var revision by remember { mutableIntStateOf(0) }
    var message by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) { NearbyGeofences.ensureChannel(context); revision++ }
    DisposableEffect(owner) {
        val observer = LifecycleEventObserver { _, event -> if (event == Lifecycle.Event.ON_RESUME) revision++ }
        val prefs = NearbyGeofences.prefs(context)
        val listener = SharedPreferences.OnSharedPreferenceChangeListener { _, _ -> revision++ }
        prefs.registerOnSharedPreferenceChangeListener(listener)
        owner.lifecycle.addObserver(observer)
        onDispose { owner.lifecycle.removeObserver(observer); prefs.unregisterOnSharedPreferenceChangeListener(listener) }
    }
    val fine = remember(revision) { NearbyGeofences.precise(context) }
    val background = remember(revision) { NearbyGeofences.background(context) }
    val notifications = remember(revision) { NearbyGeofences.notifications(context) }
    val gps = remember(revision) { NearbyGeofences.gps(context) }
    val saving = remember(revision) { context.getSystemService(android.os.PowerManager::class.java).isPowerSaveMode }
    val request = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        revision++
        if (enabled) NearbyGeofences.sync(context, force = true)
    }
    val openSettings: () -> Unit = {
        runCatching { context.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + context.packageName))) }
            .onFailure { message = "Abre Ajustes del teléfono → Aplicaciones → VisitaLoja → Permisos." }
    }
    AlertDialog(onDismissRequest = dismiss, icon = { Icon(Icons.Default.NearMe, null) }, title = { Text("Paradas cercanas") },
        text = {
            Column(Modifier.heightIn(max = 440.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Recibe «Estás cerca de una parada» a unos 60 m, también mientras usas otra aplicación o con la pantalla apagada.")
                Text("Al activar esta opción, Android y Google Play Services usan tu ubicación también en segundo plano para detectar cercanía. VisitaLoja no guarda ni envía tus coordenadas a tu cuenta.", fontSize = 12.sp)
                Text("1. Ubicación precisa: " + if (fine) "permitida" else "pendiente")
                if (!fine) TextButton(onClick = { request.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)) }) { Text("Permitir ubicación precisa") }
                Text("2. Ubicación Siempre: " + if (background) "permitida" else "pendiente")
                if (fine && !background) {
                    Text("En Permisos → Ubicación, elige «Permitir siempre». Este permiso es opcional; el mapa funciona sin él.", fontSize = 12.sp)
                    TextButton(onClick = {
                        if (Build.VERSION.SDK_INT == 29) request.launch(arrayOf(Manifest.permission.ACCESS_BACKGROUND_LOCATION)) else openSettings()
                    }) { Text("Configurar permiso Siempre") }
                }
                Text("3. Notificaciones: " + if (notifications) "permitidas" else "pendientes")
                if (!notifications) TextButton(onClick = {
                    if (Build.VERSION.SDK_INT >= 33 && !NearbyGeofences.permission(context, Manifest.permission.POST_NOTIFICATIONS)) request.launch(arrayOf(Manifest.permission.POST_NOTIFICATIONS))
                    else runCatching {
                        context.startActivity(Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
                            .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName).putExtra(Settings.EXTRA_CHANNEL_ID, NearbyGeofences.CHANNEL))
                    }.onFailure { openSettings() }
                }) { Text("Permitir notificaciones") }
                Text("4. GPS del teléfono: " + if (gps) "activado" else "apagado", modifier = Modifier.testTag("nearby-gps"))
                if (!gps) TextButton(onClick = {
                    runCatching { context.startActivity(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)) }.onFailure { openSettings() }
                }) { Text("Activar GPS") }
                if (saving) Text("El ahorro de batería está activo y puede retrasar los avisos.", fontSize = 12.sp)
                Text(status, color = MaterialTheme.colorScheme.primary, fontSize = 12.sp, modifier = Modifier.testTag("nearby-status"))
                val prefs = NearbyGeofences.prefs(context)
                fun localDate(value: Long) = java.time.format.DateTimeFormatter.ofPattern("dd/MM HH:mm", java.util.Locale.forLanguageTag("es-EC"))
                    .withZone(java.time.ZoneId.of("America/Guayaquil")).format(java.time.Instant.ofEpochMilli(value))
                val registeredAt = prefs.getLong("registeredAt", 0)
                if (registeredAt > 0) Text("Última activación: ${localDate(registeredAt)} · hora de Loja", fontSize = 12.sp)
                val lastAlert = prefs.getLong("lastAnyAlert", 0)
                if (lastAlert > 0) Text("Último aviso: ${prefs.getString("lastAlertTitle", "Parada")} · ${localDate(lastAlert)}", fontSize = 12.sp)
                Text("El radio es aproximado y el aviso puede tardar varios minutos. Una señal imprecisa, el ahorro de batería o forzar la detención pueden impedirlo. No repite la misma parada en menos de 30 minutos. No registra sellos ni visitas.", fontSize = 12.sp)
                message?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                if (enabled) OutlinedButton(onClick = { setEnabled(false) }, modifier = Modifier.testTag("nearby-disable")) { Text("Desactivar avisos") }
                else Button(onClick = {
                    if (NearbyGeofences.available(context)) { message = null; setEnabled(true) }
                    else message = "Completa los tres permisos y activa el GPS del teléfono antes de activar los avisos."
                }, modifier = Modifier.testTag("nearby-enable")) { Text("Activar avisos en segundo plano") }
                if (enabled) TextButton(onClick = { NearbyGeofences.sync(context, force = true) }) { Text("Revisar activación") }
                TextButton(onClick = openSettings) { Text("Abrir ajustes del teléfono") }
            }
        }, confirmButton = { TextButton(onClick = dismiss) { Text("Listo") } })
}
