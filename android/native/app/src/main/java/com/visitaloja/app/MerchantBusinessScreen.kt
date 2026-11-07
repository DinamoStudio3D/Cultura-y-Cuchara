package com.visitaloja.app

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private fun businessMoney(amount: Any?) = java.text.NumberFormat.getCurrencyInstance(Locale.forLanguageTag("es-EC")).format(MerchantBusinessPolicy.amount(amount))
private fun businessDate(value: Any?): String = timeMillis(value)?.let { DateTimeFormatter.ofPattern("dd MMM yyyy · HH:mm",Locale.forLanguageTag("es-EC")).withZone(ZoneId.of("America/Guayaquil")).format(Instant.ofEpochMilli(it)) } ?: "Sin fecha"
@Composable
fun MerchantBusinessScreen(state: MerchantBusinessState, model: MerchantBusinessViewModel, scan: () -> Unit, rewards: () -> Unit, dismiss: () -> Unit) {
    var search by remember(state.uid,state.selected,state.tab) { mutableStateOf("") }
    val now=System.currentTimeMillis()
    val selectedName=state.places.find { it.first==state.selected }?.second.orEmpty()
    val filtered=state.rows.filter { row->search.isBlank() || listOf(row.text("userName"),MerchantBusinessPolicy.maskedEmail(row.text("userEmail")),row.text("rewardTitle")).any { it.contains(search,true) } }
        .sortedWith(if(state.tab=="clients")compareByDescending { it.count("visitCount") } else compareByDescending { timeMillis(it[if(state.tab=="visits")"confirmedAt" else "createdAt"]) ?: 0 })
    Dialog(onDismissRequest=dismiss,properties=DialogProperties(usePlatformDefaultWidth=false)) {
        Surface(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding(),color=MaterialTheme.colorScheme.background) {
            LazyColumn(Modifier.fillMaxSize().padding(horizontal=20.dp),verticalArrangement=Arrangement.spacedBy(12.dp),contentPadding=PaddingValues(vertical=16.dp)) {
                item { Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween) {
                    Column { Text("MI NEGOCIO",fontSize=11.sp,color=MaterialTheme.colorScheme.primary);Text("Clientes y visitas",fontSize=25.sp,fontWeight=FontWeight.Bold) }
                    IconButton(onClick=dismiss){Icon(Icons.Default.Close,"Cerrar mi negocio")}
                } }
                if(state.uid==null)item { Text("Inicia sesión con el correo autorizado de tu negocio desde Mi cuenta.") }
                if(state.busy)item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
                if(state.uid!=null)item { OutlinedButton(onClick={model.bind(state.uid)},enabled=!state.busy) { Icon(Icons.Default.Refresh,null);Spacer(Modifier.width(8.dp));Text("Actualizar datos y permisos") } }
                state.error?.let { error->item { Text(error,color=MaterialTheme.colorScheme.error) } }
                if(state.ready) {
                    item { Row(Modifier.horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                        state.places.forEach { (id,name)->FilterChip(selected=state.selected==id,onClick={model.select(id)},enabled=!state.busy,label={Text(name)}) }
                    } }
                    item { Button(onClick=scan,modifier=Modifier.fillMaxWidth()) { Icon(Icons.Default.QrCodeScanner,null);Spacer(Modifier.width(8.dp));Text("Escanear y sellar una visita") } }
                    item {
                        OutlinedButton(onClick = rewards, modifier = Modifier.fillMaxWidth()) {
                            Icon(Icons.Default.Redeem, null); Spacer(Modifier.width(8.dp)); Text("Validar y entregar un premio")
                        }
                    }
                    if(state.months<=0)item { Text("El plan de esta parada no incluye consulta de clientes, historial ni estadísticas. Puedes continuar sellando visitas.") }
                    else {
                        item { Text("Historial de visitas y premios: últimos ${state.months} meses. Clientes: progreso acumulado.",fontSize=12.sp) }
                        item { Row(Modifier.horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                            listOf("clients" to "Clientes","visits" to "Visitas","rewards" to "Premios").forEach { (id,name)->FilterChip(selected=state.tab==id,onClick={model.tab(id)},enabled=!state.busy,label={Text(name)}) }
                        } }
                        item { OutlinedTextField(search,{search=it.take(100)},label={Text("Buscar en los registros cargados")},singleLine=true,modifier=Modifier.fillMaxWidth()) }
                        item {
                            val confirmed=state.rows.filter { it.text("status")!="reversed" }
                            Surface(shape=MaterialTheme.shapes.large,color=MaterialTheme.colorScheme.primaryContainer) {
                                Column(Modifier.fillMaxWidth().padding(16.dp),verticalArrangement=Arrangement.spacedBy(6.dp)) {
                                    Text("Resumen de registros cargados",fontWeight=FontWeight.Bold)
                                    when(state.tab){
                                        "clients"->Text("${state.rows.size} tarjetas de clientes · consumo acumulado: "+businessMoney(state.rows.sumOf { MerchantBusinessPolicy.amount(it["totalSpend"]) }))
                                        "visits"->Text("${confirmed.size} visitas · ${state.rows.size-confirmed.size} anuladas\nConsumo confirmado: "+businessMoney(confirmed.sumOf { MerchantBusinessPolicy.amount(it["purchaseAmount"]) }))
                                        else->Text("${state.rows.count { MerchantBusinessPolicy.rewardStatus(it,now)=="Pendiente" }} pendientes · ${state.rows.count { MerchantBusinessPolicy.rewardStatus(it,now)=="Entregada" }} entregadas")
                                    }
                                    if(state.more)Text("Resumen parcial. Carga más registros para completar la consulta.",fontSize=12.sp)
                                }
                            }
                        }
                        if(filtered.isEmpty() && !state.busy && state.error==null)item { Text(if(state.more)"No hay coincidencias en esta página. Quedan más registros por consultar." else "No hay registros con estos filtros.") }
                        items(filtered,key={it.text("id")}) { row->
                            Surface(shape=MaterialTheme.shapes.large,color=MaterialTheme.colorScheme.surface) {
                                Column(Modifier.fillMaxWidth().padding(16.dp),verticalArrangement=Arrangement.spacedBy(6.dp)) {
                                    Text(row.text("userName").ifBlank { "Visitante" },fontSize=17.sp,fontWeight=FontWeight.Bold)
                                    MerchantBusinessPolicy.maskedEmail(row.text("userEmail")).takeIf { it.isNotBlank() }?.let { Text(it,fontSize=12.sp) }
                                    when(state.tab) {
                                        "clients"->{
                                            Text("${row.count("visitCount")} visitas habituales · consumo: "+businessMoney(row["totalSpend"]))
                                            val place=Place(state.selected,selectedName,listOf("food"),"","",null)
                                            val cards=WalletPolicy.cards(listOf(state.program),listOf(row),listOf(place),now,MerchantScanPolicy.day(now))
                                            cards.forEach { card->Text("${card.title}: ${card.visits} / ${card.target} · ${card.state}",fontSize=12.sp);LinearProgressIndicator(progress={card.progress.toFloat()/card.target},modifier=Modifier.fillMaxWidth()) }
                                            Text("Última visita: "+businessDate(row["lastVisitAt"]),fontSize=12.sp)
                                        }
                                        "visits"->{
                                            val reversed=row.text("status")=="reversed"
                                            Text(if(reversed)"SELLO ANULADO" else if(row["passportAdded"]==true)"Pasaporte y fidelidad" else "Fidelidad",color=if(reversed)MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary)
                                            Text(businessDate(row[if(reversed)"reversedAt" else "confirmedAt"]),fontSize=12.sp)
                                            Text((if(reversed)"Consumo retirado: " else "Consumo registrado: ")+businessMoney(row["purchaseAmount"]))
                                            row.text("receiptRef").takeIf { it.isNotBlank() }?.let { Text("Comprobante: $it",fontSize=12.sp) }
                                        }
                                        else->{Text(row.text("rewardTitle").ifBlank { "Beneficio de fidelidad" },fontWeight=FontWeight.SemiBold);Text(MerchantBusinessPolicy.rewardStatus(row,now),color=MaterialTheme.colorScheme.primary);Text("Creado: "+businessDate(row["createdAt"]),fontSize=12.sp);Text(if(row.text("status")=="delivered")"Entregado: "+businessDate(row["deliveredAt"]) else "Vence: "+businessDate(row["expiresAt"]),fontSize=12.sp)}
                                    }
                                }
                            }
                        }
                        if(state.more)item { OutlinedButton(onClick={model.load(true)},enabled=!state.busy,modifier=Modifier.fillMaxWidth()) { Text("Cargar más registros") } }
                    }
                }
            }
        }
    }
}
