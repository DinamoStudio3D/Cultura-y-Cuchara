package com.visitaloja.app

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import coil.compose.AsyncImage
import kotlinx.coroutines.delay

@Composable
internal fun GuideScreen(state:PlacesState,refresh:()->Unit,open:(Place)->Unit,missions:()->Unit,route:()->Unit) {
    var interest by rememberSaveable{mutableStateOf<String?>(null)}
    var selectedId by rememberSaveable{mutableStateOf<String?>(null)}
    // Public IDs only, kept during this screen; no account history, location or analytics writes.
    var seen by remember{mutableStateOf<List<String>>(emptyList())}
    var now by remember{mutableLongStateOf(System.currentTimeMillis())}
    val lifecycle=LocalLifecycleOwner.current.lifecycle
    LaunchedEffect(lifecycle){lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED){refresh();while(true){now=System.currentTimeMillis();delay(10_000)}}}
    val moment=maxOf(now,System.currentTimeMillis())
    val fresh=RoutePlannerPolicy.fresh(state,moment)
    val choices=GuidePolicy.candidates(state,interest.orEmpty(),moment)
    val selected=GuidePolicy.current(state,interest.orEmpty(),selectedId,moment)
    val twoColumns=LocalConfiguration.current.let{it.screenWidthDp>=360&&it.fontScale<=1.2f}
    fun choose(key:String){
        val options=GuidePolicy.candidates(state,key,System.currentTimeMillis())
        interest=key;seen=emptyList();selectedId=GuidePolicy.next(options,emptyList())?.id
        selectedId?.let{seen=listOf(it)}
    }
    fun another(){
        val options=GuidePolicy.candidates(state,interest.orEmpty(),System.currentTimeMillis())
        val history=(seen+listOfNotNull(selectedId)).distinct()
        val next=GuidePolicy.next(options,history)
        if(next!=null){seen=if(options.all{it.id in history})listOf(next.id) else (history+next.id).distinct();selectedId=next.id}
    }
    LazyColumn(Modifier.fillMaxSize().testTag("guide-screen"),contentPadding=PaddingValues(start=20.dp,end=20.dp,top=16.dp,bottom=88.dp),verticalArrangement=Arrangement.spacedBy(14.dp)) {
        item {
            Surface(color=Color(0xFF0C3768),contentColor=Color.White,shape=RoundedCornerShape(24.dp)) {
                Row(Modifier.fillMaxWidth().padding(18.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(12.dp)) {
                    Image(painterResource(R.drawable.chabaquito),"Chabaquito, tu compañero de aventuras",Modifier.width(88.dp).height(120.dp),contentScale=ContentScale.Fit)
                    Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(7.dp)) {
                        Text("HABLA CON CHABAQUITO",style=MaterialTheme.typography.labelSmall,color=Color(0xFFABDBFF))
                        Text("¡Hagamos un plan!",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold)
                        Text("Tú eliges el plan. Yo te acompaño.",style=MaterialTheme.typography.bodyMedium)
                    }
                }
            }
        }
        item {
            Text("¿Qué te apetece descubrir?",style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold)
            Text("Elige una idea y te mostraré una parada del directorio publicado de VisitaLoja.",style=MaterialTheme.typography.bodyMedium)
        }
        if(!fresh)item {
            if(state.loading)LinearProgressIndicator(Modifier.fillMaxWidth())
            Text(if(state.loading)"Consultando paradas publicadas…" else "Conéctate y actualiza las paradas para elegir una sugerencia actual.")
            OutlinedButton(onClick=refresh,enabled=!state.loading,modifier=Modifier.testTag("guide-refresh")){Text("Actualizar paradas")}
        }
        item {
            Column(verticalArrangement=Arrangement.spacedBy(10.dp)) {
                GuidePolicy.interests.entries.toList().chunked(if(twoColumns)2 else 1).forEach{row->
                    Row(horizontalArrangement=Arrangement.spacedBy(10.dp)) {
                        row.forEach{(id,label)->
                            val icon=when(id){"cafe"->Icons.Default.LocalCafe;"food"->Icons.Default.Restaurant;"culture"->Icons.Default.Explore;else->Icons.Default.Hotel}
                            OutlinedCard(onClick={choose(id)},enabled=fresh,modifier=Modifier.weight(1f).testTag("guide-interest-$id"),colors=CardDefaults.outlinedCardColors(containerColor=if(interest==id)MaterialTheme.colorScheme.primaryContainer else Color.White)) {
                                Column(Modifier.fillMaxWidth().padding(14.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){Icon(icon,null,tint=MaterialTheme.colorScheme.primary);Text(label,fontWeight=FontWeight.SemiBold)}
                            }
                        }
                    }
                }
            }
        }
        if(interest!=null&&fresh) {
            if(selected!=null)item(key="suggestion-${selected.id}") {
                Card(Modifier.fillMaxWidth().testTag("guide-result"),colors=CardDefaults.cardColors(containerColor=Color.White),shape=RoundedCornerShape(22.dp)) {
                    PlacePolicy.safeImage(selected.imageUrl)?.let{url->AsyncImage(model=BrandImagePolicy.model(url),contentDescription=null,modifier=Modifier.fillMaxWidth().height(170.dp),contentScale=ContentScale.Fit)}
                    Column(Modifier.padding(18.dp),verticalArrangement=Arrangement.spacedBy(10.dp)) {
                        Text("TU PRÓXIMA PARADA",color=MaterialTheme.colorScheme.primary,style=MaterialTheme.typography.labelLarge)
                        Text(selected.title,style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold,modifier=Modifier.testTag("guide-place-title"))
                        if(selected.description.isNotBlank())Text(selected.description,maxLines=4,overflow=TextOverflow.Ellipsis)
                        Text(selected.address.ifBlank{"Loja, Ecuador"},style=MaterialTheme.typography.bodyMedium)
                        val status=PlaceInfoPolicy.open(selected.info,moment)
                        Text(when(status){true->"Dentro de su horario general publicado";false->"Fuera de su horario general publicado";else->"Horario por confirmar"},fontWeight=FontWeight.Medium,color=MaterialTheme.colorScheme.primary)
                        Text("Confirma la atención y el horario antes de ir.",style=MaterialTheme.typography.bodySmall)
                        Button(onClick={GuidePolicy.current(state,interest.orEmpty(),selectedId,System.currentTimeMillis())?.let(open)},modifier=Modifier.fillMaxWidth().testTag("guide-open-place")){Text("¡Vamos! Ver este lugar");Spacer(Modifier.width(6.dp));Icon(Icons.AutoMirrored.Filled.ArrowForward,null)}
                    }
                }
            } else item {
                Text(if(choices.isEmpty())"Todavía no hay una parada publicada para esta idea. ¿Probamos otra aventura?" else "La parada elegida ya no está disponible. Puedes ver otra opción.",modifier=Modifier.testTag("guide-empty"))
            }
            item {
                if(choices.size>1||selected==null&&choices.isNotEmpty())OutlinedButton(onClick=::another,modifier=Modifier.fillMaxWidth().testTag("guide-another")){Text("Sorpréndeme con otra opción")}
                if(choices.size==1&&selected!=null)Text("Esta es la opción publicada para esta idea por ahora.",style=MaterialTheme.typography.bodySmall)
                TextButton(onClick={interest=null;selectedId=null;seen=emptyList()},modifier=Modifier.testTag("guide-reset")){Text("Cambiar de plan")}
            }
        }
        item {
            HorizontalDivider()
            Text("¿Seguimos la aventura?",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold,modifier=Modifier.padding(top=14.dp))
            OutlinedButton(onClick=missions,modifier=Modifier.fillMaxWidth().testTag("guide-missions")){Icon(Icons.Default.EmojiEvents,null);Spacer(Modifier.width(8.dp));Text("Quiero cumplir una misión")}
            Button(onClick=route,modifier=Modifier.fillMaxWidth().testTag("guide-route")){Icon(Icons.Default.Route,null);Spacer(Modifier.width(8.dp));Text("Armar mi recorrido")}
        }
    }
}

@Composable
internal fun GuideShortcut(english:Boolean,open:()->Unit) {
    Surface(onClick=open,modifier=Modifier.padding(horizontal=18.dp).fillMaxWidth().testTag("open-guide"),shape=RoundedCornerShape(22.dp),color=Color(0xFF0C3768),contentColor=Color.White) {
        Row(Modifier.padding(18.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(14.dp)) {
            Image(painterResource(R.drawable.chabaquito),null,Modifier.width(66.dp).height(88.dp),contentScale=ContentScale.Fit)
            Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(6.dp)) {
                Text(if(english)"Your adventure companion" else "Tu compañero de aventuras",style=MaterialTheme.typography.labelMedium,color=Color(0xFFABDBFF))
                Text(if(english)"Talk to Chabaquito" else "Habla con Chabaquito",style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold)
                Text(if(english)"Coffee, food, a walk… choose your next stop." else "Un café, algo rico, un paseo… elige tu próxima parada.",style=MaterialTheme.typography.bodyMedium)
            }
            Icon(Icons.AutoMirrored.Filled.ArrowForward,null)
        }
    }
}
