package com.visitaloja.app

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.MetadataChanges
import com.google.firebase.firestore.ListenerRegistration
import kotlinx.coroutines.delay
import java.time.LocalDate

/** A public menu link never executes the QR target or registers a visit. */
@Composable
internal fun DirectMenuEntry(id:String,close:()->Unit) {
    var raw by remember(id){mutableStateOf<Map<String,Any?>?>(null)}
    var loading by remember(id){mutableStateOf(true)}
    var failed by remember(id){mutableStateOf(false)}
    var cached by remember(id){mutableStateOf(true)}
    var retry by remember(id){mutableIntStateOf(0)}
    var today by remember{mutableStateOf(LocalDate.now(AgendaPolicy.zone))}
    val lifecycle=LocalLifecycleOwner.current.lifecycle
    LaunchedEffect(lifecycle){lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED){while(true){today=LocalDate.now(AgendaPolicy.zone);delay(60_000)}}}
    LaunchedEffect(id,retry,lifecycle){lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED){delay(10_000);if(cached&&!failed)loading=false}}
    DisposableEffect(id,retry,lifecycle) {
        var alive=true;var generation=0;var listener:ListenerRegistration?=null
        fun stop(){generation++;listener?.remove();listener=null;raw=null;cached=true;loading=true}
        fun start(){
            stop();failed=false
            if(!MenuPolicy.validId(id)){failed=true;loading=false;return}
            val request=++generation
            listener=FirebaseFirestore.getInstance().collection("qrCodes").document(id).addSnapshotListener(MetadataChanges.INCLUDE){doc,error->
                if(alive&&request==generation){
                    failed=error!=null;cached=doc?.metadata?.isFromCache?:true;loading=error==null&&(doc==null||cached)
                    raw=if(error==null)doc?.data else null
                }
            }
        }
        val observer=LifecycleEventObserver{_,event->when(event){Lifecycle.Event.ON_START->start();Lifecycle.Event.ON_STOP->stop();else->Unit}}
        lifecycle.addObserver(observer)
        if(lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)&&listener==null)start()
        onDispose{alive=false;lifecycle.removeObserver(observer);stop()}
    }
    val menu=if(!loading&&!failed&&!cached)MenuPolicy.read(id,raw,today) else null
    if(menu!=null)DigitalMenuDialog(menu,false,{retry++},close)
    else AlertDialog(onDismissRequest=close,icon={Image(painterResource(R.drawable.visitaloja_logo),null,Modifier.size(62.dp))},title={Text("Menú digital de VisitaLoja")},text={
        Column(Modifier.testTag("direct-menu-status"),verticalArrangement=Arrangement.spacedBy(12.dp)) {
            if(loading)LinearProgressIndicator(Modifier.fillMaxWidth())
            Text(when{failed->"No pudimos consultar este menú. Comprueba la conexión y vuelve a intentar.";loading->"Consultando el menú publicado…";cached->"Conéctate para comprobar que el menú sigue publicado.";else->"Este menú no está disponible. Puede haberse retirado o cambiado."})
        }
    },confirmButton={if(!loading)TextButton(onClick={retry++}){Text("Reintentar")}},dismissButton={TextButton(onClick=close){Text("Cerrar menú")}})
}
