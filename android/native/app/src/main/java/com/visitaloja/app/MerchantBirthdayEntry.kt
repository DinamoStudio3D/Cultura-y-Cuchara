package com.visitaloja.app

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import org.json.JSONObject

@Composable
internal fun MerchantBirthdayEntry(visit:MerchantVisit,uid:String?){
    if(visit.status!="confirmed"||uid==null)return
    val scope=rememberCoroutineScope()
    var data by remember(visit.id,uid){mutableStateOf<JSONObject?>(null)}
    var busy by remember(visit.id,uid){mutableStateOf(false)}
    var message by remember(visit.id,uid){mutableStateOf<String?>(null)}
    var amount by remember(visit.id,uid){mutableStateOf("")}
    var receipt by remember(visit.id,uid){mutableStateOf("")}
    var confirm by remember(visit.id,uid){mutableStateOf(false)}
    var checked by remember(visit.id,uid){mutableStateOf(false)}
    suspend fun request(action:String){
        if(busy)return
        busy=true;message=null
        try{
            val user=FirebaseAuth.getInstance().currentUser?.takeIf{it.uid==uid}?:error("Inicia sesión nuevamente.")
            val token=user.getIdToken(false).await().token?:error("Inicia sesión nuevamente.")
            val body=JSONObject().put("action",action).put("placeId",visit.placeId).put("visitId",visit.id)
            if(action=="birthday-redeem"){
                val value=amount.replace(',','.').toDoubleOrNull()?:error("Escribe el consumo confirmado.")
                require(value.isFinite()&&value>=0){"Consumo inválido."}
                body.put("confirmed",checked).put("purchaseAmount",value).put("receiptRef",receipt.trim()).put("version",data?.optLong("version")?:-1L)
            }
            val result=withContext(Dispatchers.IO){NativeApi.post("https://www.visitaloja.com/api/chabaquito-ranking?action=merchant-program",token,body)}
            if(FirebaseAuth.getInstance().currentUser?.uid==uid){data=result;message=if(result.optBoolean("saved"))"Beneficio entregado y registrado." else if(!result.optBoolean("available"))"No hay un beneficio de cumpleaños aplicable a esta visita." else null}
        }catch(e:kotlinx.coroutines.CancellationException){throw e}catch(e:Exception){message=e.message?:"Resultado pendiente. Consulta antes de reintentar.";data=null}finally{busy=false}
    }
    Column(verticalArrangement=Arrangement.spacedBy(8.dp)){
        OutlinedButton(onClick={scope.launch{request("birthday-load")}},enabled=!busy){Text("Consultar beneficio de cumpleaños")}
        if(busy)LinearProgressIndicator(Modifier.fillMaxWidth())
        message?.let{Text(it)}
        data?.takeIf{it.optBoolean("available")}?.let{offer->
            Text(offer.optString("title"),style=MaterialTheme.typography.titleMedium)
            Text(offer.optString("description"))
            Text("Consumo mínimo: $"+offer.optDouble("minimumSpend",0.0))
            if(offer.optBoolean("used"))Text("Beneficio ya entregado este año.") else{
                OutlinedTextField(amount,{amount=it.take(12)},label={Text("Consumo confirmado")},enabled=!busy,modifier=Modifier.fillMaxWidth())
                OutlinedTextField(receipt,{receipt=it.take(80)},label={Text("Comprobante (opcional)")},enabled=!busy,modifier=Modifier.fillMaxWidth())
                Row{Checkbox(checked,{checked=it},enabled=!busy);Text("Verifiqué presencia y fecha de cumpleaños del visitante.")}
                Button(onClick={confirm=true},enabled=!busy&&checked){Text("Entregar beneficio de cumpleaños")}
            }
        }
    }
    if(confirm)AlertDialog(onDismissRequest={confirm=false},title={Text("Confirmar entrega de cumpleaños")},text={Text("Se registrará una entrega para este cliente, esta parada y este año. Comprueba el beneficio y el consumo antes de continuar.")},confirmButton={TextButton(onClick={confirm=false;scope.launch{request("birthday-redeem")}},enabled=!busy&&checked){Text("Confirmar entrega")}},dismissButton={TextButton(onClick={confirm=false}){Text("Cancelar")}})
}
