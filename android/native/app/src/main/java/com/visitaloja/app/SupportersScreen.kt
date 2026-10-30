package com.visitaloja.app

import android.animation.ValueAnimator
import android.view.accessibility.AccessibilityManager
import androidx.compose.foundation.gestures.scrollBy
import androidx.compose.foundation.hoverable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsDraggedAsState
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import coil.compose.AsyncImage
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive

@Composable
private fun supporterNow(): Long {
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val now by produceState(System.currentTimeMillis(), lifecycle) { lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) { while (isActive) { value = System.currentTimeMillis();delay(1000) } } }
    return now
}
private fun supportFresh(content: PublicContent<SupportConfig>, places: PlacesState) = !content.loading && !content.error && !content.cached && !places.offline && places.error == null && places.fetchedAt > 0

@Composable
private fun supporterOpen(places: PlacesState, content: PublicContent<SupportConfig>, open: (Place) -> Unit, institution: () -> Unit): (Supporter) -> Unit {
    return { entry ->
        val current = SupportersPolicy.entries(places.places, content.value, System.currentTimeMillis(), supportFresh(content, places))
        if (content.value.clickable && current.any { it.id == entry.id }) {
            if (entry.institution) institution()
            else places.places.find { it.id == entry.id }?.let(open)
        }
    }
}
@Composable
private fun SupporterCard(item: Supporter, config: SupportConfig, modifier: Modifier, open: (Supporter) -> Unit) {
    var failed by remember(item.logo) { mutableStateOf(false) }
    val body: @Composable () -> Unit = {
        Column(Modifier.fillMaxWidth().padding(16.dp), horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (item.logo != null && !failed) AsyncImage(item.logo,null,Modifier.fillMaxWidth().height(92.dp),contentScale=ContentScale.Fit,onError={failed=true})
            if (item.logo == null || failed || config.showNames) Text(item.name,fontWeight=FontWeight.Bold,fontSize=14.sp,textAlign=androidx.compose.ui.text.style.TextAlign.Center)
            if (config.clickable) Text(if (item.institution) "Conocer institución →" else "Conocer negocio →",fontSize=11.sp,color=if(item.institution)Color(0xFFC3E3FF) else MaterialTheme.colorScheme.primary)
        }
    }
    val cardColors=CardDefaults.cardColors(containerColor=if(item.institution)Color(0xFF0C3768) else Color.White,contentColor=if(item.institution)Color.White else MaterialTheme.colorScheme.onSurface)
    val cardModifier = modifier.testTag("supporter-${item.id}").semantics { contentDescription = if(config.clickable) "Conoce ${item.name}" else item.name }
    if(config.clickable) Card(onClick={open(item)},modifier=cardModifier,shape=RoundedCornerShape(18.dp),colors=cardColors,content={body()})
    else Card(modifier=cardModifier,shape=RoundedCornerShape(18.dp),colors=cardColors,content={body()})
}

@Composable
internal fun HomeSupporters(content: PublicContent<SupportConfig>, places: PlacesState, open: (Place) -> Unit, all: () -> Unit, institution: () -> Unit) {
    val now = supporterNow();val config = content.value
    val rows = remember(places.places,config,now,supportFresh(content,places)) { SupportersPolicy.entries(places.places,config,now,supportFresh(content,places)) }
    if(rows.isEmpty()) return
    val row = rememberLazyListState();var paused by rememberSaveable { mutableStateOf(false) }
    val dragged by row.interactionSource.collectIsDraggedAsState()
    val hover = remember { MutableInteractionSource() };val hovered by hover.collectIsHoveredAsState()
    val lifecycle = LocalLifecycleOwner.current.lifecycle;val context = LocalContext.current
    val width=when(config.size){"small"->144.dp;"large"->210.dp;else->180.dp}
    val density=LocalDensity.current
    val stride=with(density){(width+12.dp).toPx()}
    val accessibility=context.getSystemService(AccessibilityManager::class.java)
    var touchExploration by remember { mutableStateOf(accessibility?.isTouchExplorationEnabled == true) }
    DisposableEffect(accessibility) {
        val observer=AccessibilityManager.TouchExplorationStateChangeListener { touchExploration=it }
        accessibility?.addTouchExplorationStateChangeListener(observer)
        onDispose { accessibility?.removeTouchExplorationStateChangeListener(observer) }
    }
    val looping=config.motion && rows.size>1 && !touchExploration
    LaunchedEffect(rows.map{it.id},looping) { if(looping)row.scrollToItem(rows.size) }
    LaunchedEffect(rows.map{it.id},looping,config.duration,config.right,config.pauseOnHover,paused,dragged,hovered,lifecycle,stride) {
        if(looping && !paused && !dragged && !(hovered && config.pauseOnHover)) lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            // Advance every display frame. The configured duration is one complete circuit,
            // rather than a long delay between jumps. Recenter identical copies off-screen.
            var previous=0L
            while(isActive) {
                val frame=withFrameNanos { it }
                val seconds=if(previous==0L)0f else ((frame-previous)/1_000_000_000f).coerceIn(0f,0.05f)
                previous=frame
                if(ValueAnimator.areAnimatorsEnabled() && !touchExploration && !row.isScrollInProgress) {
                    val anchor=row.firstVisibleItemIndex
                    if(anchor<rows.size || anchor>=rows.size*2)row.scrollToItem(rows.size+anchor%rows.size,row.firstVisibleItemScrollOffset)
                    row.scrollBy(stride*rows.size/config.duration*seconds*(if(config.right)-1 else 1))
                }
            }
        }
    }
    Column(Modifier.fillMaxWidth().padding(horizontal=22.dp).hoverable(hover).testTag("home-supporters"),verticalArrangement=Arrangement.spacedBy(13.dp)) {
        Row(verticalAlignment=androidx.compose.ui.Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(9.dp)) { Icon(Icons.Default.Handshake,null,tint=MaterialTheme.colorScheme.primary);Text("JUNTOS POR LOJA",fontSize=11.sp,color=MaterialTheme.colorScheme.primary,fontWeight=FontWeight.Bold) }
        Text(config.title,fontWeight=FontWeight.ExtraBold,fontSize=23.sp,lineHeight=28.sp)
        if(config.subtitle.isNotBlank())Text(config.subtitle,fontSize=13.sp,color=MaterialTheme.colorScheme.onSurfaceVariant)
        val action=supporterOpen(places,content,open,institution)
        LazyRow(state=row,horizontalArrangement=Arrangement.spacedBy(12.dp)) {
            items(if(looping)rows.size*3 else rows.size,key={index -> "${index/rows.size}:${rows[index%rows.size].id}"}) { index -> SupporterCard(rows[index%rows.size],config,Modifier.width(width),action) }
        }
        Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween) {
            TextButton(onClick=all,modifier=Modifier.testTag("open-supporters")){Text("Conocer a todos")}
            if(config.motion && rows.size>1) TextButton(onClick={paused=!paused},modifier=Modifier.testTag("supporters-motion")){Icon(if(paused)Icons.Default.PlayArrow else Icons.Default.Pause,null,Modifier.size(18.dp));Text(if(paused)"Reanudar" else "Pausar")}
        }
    }
}

@Composable
internal fun SupportersScreen(content: PublicContent<SupportConfig>, places: PlacesState, retry: () -> Unit, open: (Place) -> Unit, institution: () -> Unit) {
    val now=supporterNow();val config=content.value
    val rows=SupportersPolicy.entries(places.places,config,now,supportFresh(content,places));val action=supporterOpen(places,content,open,institution)
    val display=LocalConfiguration.current;val columns=if(display.fontScale>1.3f||display.screenWidthDp<360)1 else if(display.screenWidthDp>=600)3 else 2
    LazyColumn(Modifier.fillMaxSize().testTag("supporters-screen"),contentPadding=PaddingValues(20.dp),verticalArrangement=Arrangement.spacedBy(16.dp)) {
        item { Surface(color=Color(0xFF0C3768),shape=RoundedCornerShape(24.dp)) { Column(Modifier.fillMaxWidth().padding(22.dp),verticalArrangement=Arrangement.spacedBy(12.dp)) {
            Icon(Icons.Default.Handshake,null,tint=Color(0xFFACD9FF),modifier=Modifier.size(32.dp));Text(config.title,color=Color.White,fontSize=27.sp,lineHeight=32.sp,fontWeight=FontWeight.ExtraBold)
            if(config.subtitle.isNotBlank())Text(config.subtitle,color=Color(0xFFE1EEFF))
        } } }
        when {
            content.loading || places.loading && places.fetchedAt==0L -> item { LinearProgressIndicator(Modifier.fillMaxWidth());Text("Consultando quiénes nos apoyan…") }
            !supportFresh(content,places) -> item { Text("Conéctate para consultar las marcas y su participación vigente.");TextButton(onClick=retry){Text("Reintentar")}}
            !config.active -> item { Text("Esta sección no está publicada por ahora.") }
            rows.isEmpty() -> item { Text("Pronto conocerás a los negocios que apoyan este proyecto.") }
            else -> items(rows.chunked(columns),key={it.first().id}) { entries -> Row(horizontalArrangement=Arrangement.spacedBy(12.dp)) { entries.forEach{SupporterCard(it,config,Modifier.weight(1f),action)};repeat(columns-entries.size){Spacer(Modifier.weight(1f))} } }
        }
    }
}
