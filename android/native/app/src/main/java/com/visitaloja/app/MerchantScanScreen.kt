package com.visitaloja.app

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

@Composable
fun MerchantScanScreen(state: MerchantScanState, model: MerchantScanViewModel, dismiss: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var scanning by remember { mutableStateOf(false) }
    var code by remember(state.uid, state.selected) { mutableStateOf("") }
    var kind by remember(state.visit?.id) { mutableStateOf(if (state.visit?.tourist == true) "tourism" else "purchase") }
    var amount by remember(state.visit?.id) { mutableStateOf("") }
    var reason by remember(state.visit?.id) { mutableStateOf("") }
    var receipt by remember(state.visit?.id) { mutableStateOf("") }
    var confirming by remember(state.visit?.id) { mutableStateOf(false) }
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) { while (true) { now = System.currentTimeMillis(); delay(1000) } }
    val busy = state.busy || scanning
    val visit = state.visit
    Dialog(onDismissRequest = { if (!busy) dismiss() }, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding(), color = MaterialTheme.colorScheme.background) {
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Sellar visitas", fontSize = 25.sp, fontWeight = FontWeight.Bold)
                    IconButton(onClick = dismiss, enabled = !busy) { Icon(Icons.Default.Close, "Cerrar sellado") }
                }
                Text("PARA ENCARGADOS DE NEGOCIOS", fontSize = 11.sp, color = MaterialTheme.colorScheme.primary)
                if (state.uid == null) Text("Inicia sesión en Mi cuenta con el correo autorizado de tu negocio.")
                else if (!state.ready && !state.busy) OutlinedButton(onClick = { model.bind(state.uid) }) { Text("Verificar mi acceso") }
                if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                if (state.ready) {
                    Text("Parada que vas a sellar", fontWeight = FontWeight.SemiBold)
                    state.places.forEach { (id, name) ->
                        FilterChip(selected = state.selected == id, enabled = !busy, onClick = { model.select(id) }, label = { Text(name) })
                    }
                    Button(onClick = {
                        val uid = state.uid; val selected = state.selected
                        model.clearVisit(); scanning = true
                        scope.launch {
                            try {
                                val options = GmsBarcodeScannerOptions.Builder().setBarcodeFormats(Barcode.FORMAT_QR_CODE).enableAutoZoom().build()
                                val result = GmsBarcodeScanning.getClient(context, options).startScan().await()
                                val latest = model.state.value
                                if (latest.uid == uid && latest.selected == selected && latest.ready) {
                                    val parsed = MerchantScanPolicy.scanned(result.rawValue)
                                    if (parsed == null) model.message("Este QR no es un código de visita. Los QR de menús y premios no sirven para sellar aquí.")
                                    else { code = parsed; model.lookup(parsed) }
                                }
                            } catch (_: CancellationException) { /* The scanner can be closed without stamping. */ }
                            catch (_: Exception) { model.message("No se pudo abrir el escáner. Conecta el teléfono a internet para preparar el lector de Google Play Services, o escribe el código manualmente.") }
                            finally { scanning = false }
                        }
                    }, enabled = !busy, modifier = Modifier.fillMaxWidth().testTag("merchant-scan")) { Icon(Icons.Default.QrCodeScanner, null); Spacer(Modifier.width(8.dp)); Text(if (scanning) "Escaneando…" else "Escanear QR del visitante") }
                    OutlinedTextField(code, { code = it.take(64); model.clearVisit() }, label = { Text("Código de visita · 6 números") }, singleLine = true, enabled = !busy, modifier = Modifier.fillMaxWidth().testTag("merchant-visit-code"))
                    OutlinedButton(onClick = { model.lookup(code) }, enabled = !busy && MerchantScanPolicy.code(code) != null, modifier = Modifier.fillMaxWidth()) { Text("Consultar código") }
                }
                state.message?.let { Text(it, color = MaterialTheme.colorScheme.primary, modifier = Modifier.testTag("merchant-result")) }
                if (visit != null) {
                    HorizontalDivider()
                    Text(visit.visitor, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                    Text(visit.placeName)
                    when {
                        visit.status == "confirmed" -> Text("VISITA YA CONFIRMADA. No vuelvas a sellarla.", fontWeight = FontWeight.Bold)
                        visit.status == "reversed" -> Text("Esta visita fue anulada; consulta el panel del negocio.")
                        visit.status == "review" -> Text("Resultado pendiente de comprobar. Pulsa Consultar código para recuperar el estado real; no generes otro sello.")
                        !MerchantScanPolicy.confirmable(visit.status, visit.expires, state.selected == visit.placeId, now) -> Text("Código vencido o no disponible. Pide al visitante generar otro.")
                        else -> {
                            Text("Código válido · confirma que el visitante esté presente.", fontWeight = FontWeight.SemiBold)
                            if (!visit.tourist) Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                FilterChip(selected = kind == "purchase", enabled = !busy, onClick = { kind = "purchase" }, label = { Text("Compra") })
                                FilterChip(selected = kind == "courtesy", enabled = !busy, onClick = { kind = "courtesy" }, label = { Text("Cortesía") })
                            } else Text("Visita turística sin consumo")
                            if (kind == "purchase") OutlinedTextField(amount, { amount = it.take(20) }, label = { Text("Consumo · USD") }, singleLine = true, enabled = !busy, modifier = Modifier.fillMaxWidth())
                            if (kind == "courtesy") OutlinedTextField(reason, { reason = it.take(240) }, label = { Text("Motivo de cortesía · obligatorio") }, enabled = !busy, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(receipt, { receipt = it.take(80) }, label = { Text("Comprobante · opcional") }, enabled = !busy, modifier = Modifier.fillMaxWidth())
                            Button(onClick = {
                                try { MerchantScanPolicy.consumption(visit.tourist, kind, amount, reason, receipt); confirming = true }
                                catch (e: IllegalArgumentException) { model.message(e.message ?: "Revisa el registro.") }
                            }, enabled = !busy, modifier = Modifier.fillMaxWidth()) { Text("Revisar y dar sello") }
                        }
                    }
                }
                Text("Escanear o consultar no registra sellos. La confirmación se valida en el mismo servidor que utiliza el panel web.", fontSize = 12.sp)
            }
        }
    }
    if (confirming && visit != null) AlertDialog(onDismissRequest = { confirming = false }, title = { Text("¿Confirmar esta visita?") },
        text = { Text("${visit.visitor}\n${visit.placeName}\n" + when (kind) { "purchase" -> "Compra: USD $amount"; "courtesy" -> "Cortesía: $reason"; else -> "Visita turística" } + "\n\nVerifica que el visitante esté presente. Se aplicarán las reglas actuales de fidelidad y pasaporte.") },
        confirmButton = { TextButton(onClick = { confirming = false; model.confirm(kind, amount, reason, receipt) }, enabled = !busy) { Text("Confirmar sello") } },
        dismissButton = { TextButton(onClick = { confirming = false }) { Text("Cancelar") } })
}
