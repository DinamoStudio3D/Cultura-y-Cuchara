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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.text.font.FontWeight
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
fun MerchantRewardScreen(state:MerchantRewardState,model:MerchantRewardViewModel,stopName:String?=null,dismiss:()->Unit){
    val context=LocalContext.current;val scope=rememberCoroutineScope()
    var code by remember(state.uid){mutableStateOf("")};var scanning by remember{mutableStateOf(false)};var confirm by remember(state.claimId){mutableStateOf(false)}
    var now by remember{mutableLongStateOf(System.currentTimeMillis())}
    LaunchedEffect(Unit){while(true){now=System.currentTimeMillis();delay(1000)}}
    val busy=state.busy||scanning;val claim=state.claim
    val title=claim.text("rewardTitle").ifBlank { claim.map("rewardSnapshot").text("title") }.ifBlank { "Recompensa" }
    Dialog(onDismissRequest={if(!busy)dismiss()},properties=DialogProperties(usePlatformDefaultWidth=false)){
        Surface(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding(),color=MaterialTheme.colorScheme.background){
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
                Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text("Entregar premios",fontSize=25.sp,fontWeight=FontWeight.Bold);IconButton(onClick=dismiss,enabled=!busy){Icon(Icons.Default.Close,"Cerrar premios")}}
                Text("FIDELIDAD · PASAPORTE · MISIONES",fontSize=11.sp,color=MaterialTheme.colorScheme.primary)
                if (!stopName.isNullOrBlank()) Text("Fidelidad · $stopName", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                Text("Consulta el QR del visitante y verifica el premio antes de confirmar su entrega.")
                if(state.uid==null)Text("Inicia sesión en Mi cuenta con el correo autorizado del negocio.")
                else{
                    Button(onClick={
                        val uid=state.uid;model.clear();scanning=true
                        scope.launch{try{
                            val options=GmsBarcodeScannerOptions.Builder().setBarcodeFormats(Barcode.FORMAT_QR_CODE).enableAutoZoom().build()
                            val value=GmsBarcodeScanning.getClient(context,options).startScan().await().rawValue
                            if(model.state.value.uid==uid){val parsed=MerchantRewardPolicy.code(value);if(parsed==null)model.message("Este QR no es un código de canje. Los códigos de visita se sellan en el otro apartado.")else{code=parsed;model.lookup(parsed)}}
                        }catch(_:CancellationException){}catch(_:Exception){model.message("No se pudo abrir el lector. Comprueba Google Play Services y la conexión, o escribe el código manualmente.")}finally{scanning=false}}
                    },enabled=!busy,modifier=Modifier.fillMaxWidth()){Icon(Icons.Default.QrCodeScanner,null);Spacer(Modifier.width(8.dp));Text("Escanear QR de premio")}
                    OutlinedTextField(code,{code=it.take(64);model.clear()},label={Text("Código de canje")},singleLine=true,enabled=!busy,modifier=Modifier.fillMaxWidth())
                    OutlinedButton(onClick={model.lookup(code)},enabled=!busy&&MerchantRewardPolicy.code(code)!=null,modifier=Modifier.fillMaxWidth()){Text("Consultar premio")}
                }
                if(state.busy)LinearProgressIndicator(Modifier.fillMaxWidth())
                state.message?.let{Text(it,color=MaterialTheme.colorScheme.primary)}
                if(claim.isNotEmpty()){
                    HorizontalDivider();Text(MerchantRewardPolicy.status(claim,state.type,now),fontWeight=FontWeight.Bold,color=MaterialTheme.colorScheme.primary)
                    Text(title,fontSize=22.sp,fontWeight=FontWeight.Bold)
                    Text("Visitante: "+claim.text("userName").ifBlank{"Visitante"})
                    Text(if(state.type=="loyalty")"Parada: "+claim.text("placeName").ifBlank{claim.text("placeId")} else "Campaña: "+claim.text("campaignId"))
                    val conditions=claim.text("rewardDescription").ifBlank{claim.map("rewardSnapshot").text("description")}
                    if(conditions.isNotBlank())Text(conditions)
                    Text("Código: "+claim.text("claimCode"))
                    timeMillis(claim["expiresAt"])?.let{Text("Vence: "+java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm").withZone(java.time.ZoneId.of("America/Guayaquil")).format(java.time.Instant.ofEpochMilli(it)),fontSize=12.sp)}
                    if(MerchantRewardPolicy.canDeliver(claim,state.type,now))Button(onClick={confirm=true},enabled=!busy,modifier=Modifier.fillMaxWidth()){Text("Confirmar entrega del premio")}
                }
                Text("Escanear no entrega el premio. La autorización, vigencia y entrega se vuelven a comprobar al confirmar; un premio entregado no se puede repetir.",fontSize=12.sp)
            }
        }
    }
    if(confirm&&claim.isNotEmpty())AlertDialog(onDismissRequest={confirm=false},title={Text("¿Entregar este premio?")},text={Text("$title\n${claim.text("userName").ifBlank{"Visitante"}}\n${if (state.type == "loyalty") claim.text("placeName").ifBlank { stopName ?: claim.text("placeId") } else claim.text("campaignId")}\n\nConfirma que entregas el beneficio correcto a esta persona. Esta entrega se registrará en su cuenta.")},confirmButton={TextButton(onClick={confirm=false;model.deliver()},enabled=!busy){Text("Sí, registrar entrega")}},dismissButton={TextButton(onClick={confirm=false}){Text("Cancelar")}})
}
