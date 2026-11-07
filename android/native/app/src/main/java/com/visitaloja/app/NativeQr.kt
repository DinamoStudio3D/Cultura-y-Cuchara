package com.visitaloja.app

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext

@Composable
fun NativeQr(text: String) {
    val bitmap by produceState<Bitmap?>(null, text) {
        value = withContext(Dispatchers.Default) {
            val matrix = QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, 512, 512, mapOf(EncodeHintType.MARGIN to 4))
            val pixels = IntArray(512 * 512) { i -> if (matrix[i % 512, i / 512]) android.graphics.Color.BLACK else android.graphics.Color.WHITE }
            Bitmap.createBitmap(pixels, 512, 512, Bitmap.Config.ARGB_8888)
        }
    }
    bitmap?.let { Image(it.asImageBitmap(), "Código QR para que lo valide el encargado", Modifier.fillMaxWidth().aspectRatio(1f).background(Color.White).padding(4.dp)) }
        ?: LinearProgressIndicator(Modifier.fillMaxWidth())
}

@Composable
fun VisitDialog(state: VisitState, generate: () -> Unit, retry: () -> Unit, dismiss: () -> Unit, wallet: () -> Unit) {
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) { while (true) { delay(1000); now = System.currentTimeMillis() } }
    Dialog(onDismissRequest = dismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(shape = MaterialTheme.shapes.extraLarge, modifier = Modifier.fillMaxWidth().padding(18.dp).heightIn(max = 730.dp)) {
            Column(Modifier.verticalScroll(rememberScrollState()).padding(22.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Text(state.place?.title.orEmpty(), fontSize = 23.sp, fontWeight = FontWeight.Bold)
                when {
                    state.status == "confirmed" && !state.cached -> {
                        Text("¡Visita confirmada!", color = MaterialTheme.colorScheme.primary, fontSize = 24.sp, fontWeight = FontWeight.Bold)
                        Text("El negocio validó tu visita. Tus tarjetas y los sellos de pasaporte que correspondan se actualizan en tu cuenta.")
                        Button(onClick = wallet, modifier = Modifier.fillMaxWidth()) { Text("Ver mi progreso y recompensas") }
                    }
                    state.status == "rejected" && !state.cached -> Text("El encargado rechazó esta solicitud. Consulta con el negocio antes de generar otra.")
                    state.status == "pending" && state.expires > now && !state.cached && !state.blocked -> {
                        Text("Muestra este código al encargado para validar tu visita.")
                        Text(state.code, fontSize = 36.sp, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.primary)
                        NativeQr("VISITALOJA:${state.code}")
                        val seconds = ((state.expires - now) / 1000).coerceAtLeast(0)
                        Text("Vence en ${seconds / 60}:${(seconds % 60).toString().padStart(2, '0')}")
                        Text("Esperando confirmación del negocio…", fontWeight = FontWeight.Bold)
                    }
                    state.blocked -> Text("Regresa mañana para volver a sellar tu tarjeta de fidelidad.", fontWeight = FontWeight.Bold)
                    else -> {
                        Text(if (state.status == "pending" && state.expires <= now) "Este código venció. Puedes generar uno nuevo si todavía no registraste la visita de hoy." else "Genera tu código cuando estés en la parada. El encargado debe confirmar la visita; generar el código no añade sellos.")
                        Button(onClick = generate, enabled = state.ready && !state.busy && !state.blocked, modifier = Modifier.fillMaxWidth()) { Text("Generar código de visita") }
                    }
                }
                if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                if (state.cached && state.code.isNotEmpty()) Text("Conéctate para confirmar la vigencia del código.", color = MaterialTheme.colorScheme.error)
                state.message?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                TextButton(onClick = retry, enabled = !state.busy) { Text("Actualizar / recuperar mi código") }
                TextButton(onClick = dismiss) { Text("Cerrar") }
            }
        }
    }
}

@Composable
fun RewardQrDialog(code: String, dismiss: () -> Unit) {
    Dialog(onDismissRequest = dismiss) { Surface(shape = MaterialTheme.shapes.extraLarge) {
        Column(Modifier.padding(22.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text("Tu código de recompensa", fontSize = 22.sp, fontWeight = FontWeight.Bold)
            Text(code, fontSize = 22.sp, fontWeight = FontWeight.Bold)
            NativeQr(code)
            Text("Preséntalo al encargado. La entrega se registra después de que el negocio valide el código.")
            TextButton(onClick = dismiss) { Text("Cerrar") }
        }
    } }
}
