package com.visitaloja.app

import android.animation.ValueAnimator
import android.content.Context
import android.view.accessibility.AccessibilityManager
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.BiasAlignment
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import coil.compose.AsyncImage
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.delay

@OptIn(ExperimentalComposeUiApi::class, ExperimentalLayoutApi::class)
@Composable
internal fun HomeHero(content: PublicContent<HomeContent>, english: Boolean, visible: Boolean, openMap: () -> Unit, openRoute: () -> Unit) {
    val data=content.value
    val copy=if(english)data.english else data.spanish
    val context=LocalContext.current
    val lifecycle=LocalLifecycleOwner.current.lifecycle
    val accessibility=remember(context){context.getSystemService(Context.ACCESSIBILITY_SERVICE) as AccessibilityManager}
    var current by rememberSaveable { mutableStateOf<String?>(null) }
    var paused by rememberSaveable { mutableStateOf(false) }
    var enlarged by rememberSaveable { mutableStateOf(false) }
    var foreground by remember { mutableStateOf(false) }
    val id=HomePolicy.select(data.photos,current)
    val photo=data.photos.firstOrNull {it.photo.id==id}
    LaunchedEffect(id){current=id}
    LaunchedEffect(lifecycle){lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED){foreground=true;try{awaitCancellation()}finally{foreground=false}}}
    LaunchedEffect(data.photos,data.intervalSeconds,current,paused,enlarged,foreground,visible,content.cached,content.error){
        if(paused||enlarged||!foreground||!visible||content.cached||content.error||data.photos.size<2)return@LaunchedEffect
        while(true) {
            delay(data.intervalSeconds*1000)
            if(ValueAnimator.areAnimatorsEnabled()&&!accessibility.isTouchExplorationEnabled){current=HomePolicy.step(data.photos,id,1);break}
        }
    }
    Surface(shape=RoundedCornerShape(data.radius.dp),color=Color(0xFF0C3768),contentColor=Color.White,modifier=Modifier.padding(horizontal=22.dp).fillMaxWidth().testTag("home-hero")) {
        Column {
            if(photo!=null) {
                Box(Modifier.fillMaxWidth().height((data.height*.44f).dp).clickable {enlarged=true}.testTag("home-hero-photo")) {
                    AsyncImage(photo.photo.url,photo.photo.alt,Modifier.fillMaxSize(),contentScale=ContentScale.Crop,alignment=BiasAlignment(photo.x*2-1,photo.y*2-1),colorFilter=ColorFilter.colorMatrix(ColorMatrix().apply{setToScale(data.brightness,data.brightness,data.brightness,1f)}))
                    Text(if(english)"Tap to view full photo" else "Toca para ver la foto completa",color=Color.White,style=MaterialTheme.typography.labelSmall,modifier=Modifier.align(Alignment.TopStart).background(Color(0xC010243A)).padding(8.dp))
                    Text("${data.photos.indexOf(photo)+1} / ${data.photos.size}",color=Color.White,modifier=Modifier.align(Alignment.TopEnd).background(Color(0xC010243A)).padding(8.dp).testTag("home-hero-counter"))
                }
                Row(Modifier.fillMaxWidth().padding(horizontal=8.dp),verticalAlignment=Alignment.CenterVertically){
                    IconButton(onClick={paused=true;current=HomePolicy.step(data.photos,id,-1)},enabled=data.photos.size>1,modifier=Modifier.testTag("home-hero-previous")){Icon(Icons.AutoMirrored.Filled.ArrowBack,if(english)"Previous photo" else "Foto anterior",tint=Color.White)}
                    Text("${photo.photo.title}\n${if(english)"Photo" else "Foto"}: ${photo.photo.credit}",fontSize=11.sp,lineHeight=16.sp,modifier=Modifier.weight(1f).testTag("home-hero-credit"))
                    IconButton(onClick={paused=!paused},enabled=data.photos.size>1,modifier=Modifier.testTag("home-hero-pause")){Icon(if(paused)Icons.Default.PlayArrow else Icons.Default.Pause,if(paused)"Reanudar fotos" else "Pausar fotos",tint=Color.White)}
                    IconButton(onClick={paused=true;current=HomePolicy.step(data.photos,id,1)},enabled=data.photos.size>1,modifier=Modifier.testTag("home-hero-next")){Icon(Icons.AutoMirrored.Filled.ArrowForward,if(english)"Next photo" else "Foto siguiente",tint=Color.White)}
                }
            }
            Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){
                Text(copy.title,fontSize=23.sp,lineHeight=28.sp,fontWeight=FontWeight.ExtraBold)
                Text(copy.description,fontSize=14.sp,lineHeight=20.sp,color=Color(0xFFE0EDFF))
                if(content.cached||content.error)Text("Portada sin confirmar: conéctate para actualizar.",style=MaterialTheme.typography.labelSmall)
                if(!content.loading&&!content.cached&&!content.error)Text("VisitaLoja.com",style=MaterialTheme.typography.labelSmall,modifier=Modifier.testTag("home-hero-ready"))
                FlowRow(horizontalArrangement=Arrangement.spacedBy(8.dp),verticalArrangement=Arrangement.spacedBy(4.dp)) {
                    Button(onClick=openMap,modifier=Modifier.testTag("home-hero-map"),colors=ButtonDefaults.buttonColors(containerColor=Color.White,contentColor=Color(0xFF0C3768))){Icon(Icons.Default.Map,null);Spacer(Modifier.width(8.dp));Text(copy.mapButton)}
                    OutlinedButton(onClick=openRoute,modifier=Modifier.testTag("home-hero-route"),colors=ButtonDefaults.outlinedButtonColors(contentColor=Color.White)){Icon(Icons.Default.Route,null);Spacer(Modifier.width(8.dp));Text(copy.routeButton)}
                }
            }
        }
    }
    if(enlarged&&photo!=null) androidx.compose.runtime.key(id) {
        // An independent dialog window needs its own resource-ID semantics.
        Box(Modifier.semantics{testTagsAsResourceId=true}){DiscoveryPhotoDialog(data.photos.map{it.photo},id.orEmpty(),{current=it},{enlarged=false})}
    }
}
