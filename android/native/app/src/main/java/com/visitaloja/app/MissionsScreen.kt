package com.visitaloja.app

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import java.text.DateFormat
import java.util.Date
import java.util.TimeZone

private val AdventureBlue = Color(0xFF075BB2)
private val AdventureInk = Color(0xFF102D4C)
private val AdventureGold = Color(0xFFFFD773)

@Composable
fun MissionsShortcut(open: () -> Unit) {
    Card(onClick = open, modifier = Modifier.padding(horizontal = 22.dp).fillMaxWidth().testTag("open-missions"), shape = RoundedCornerShape(24.dp)) {
        Row(Modifier.background(Brush.horizontalGradient(listOf(AdventureInk,AdventureBlue))).padding(start = 18.dp,end = 8.dp,top = 12.dp,bottom = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f),verticalArrangement = Arrangement.spacedBy(7.dp)) {
                Text("AVENTURAS CON CHABAQUITO",fontSize = 10.sp,fontWeight = FontWeight.Bold,color = AdventureGold)
                Text("Cada visita,\nun nuevo reto",fontSize = 22.sp,lineHeight = 26.sp,fontWeight = FontWeight.ExtraBold,color = Color.White)
                Row(verticalAlignment = Alignment.CenterVertically) { Text("Misiones, XP e insignias",fontSize = 12.sp,color = Color(0xFFD3E7FA));Icon(Icons.AutoMirrored.Filled.ArrowForward,null,Modifier.padding(start = 6.dp).size(16.dp),tint = AdventureGold) }
            }
            Image(painterResource(R.drawable.chabaquito),null,Modifier.width(105.dp).height(145.dp),contentScale = ContentScale.Fit)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MissionsScreen(state: MissionState, accountUid: String?, places: PlacesState, model: MissionViewModel, login: () -> Unit, explore: () -> Unit, openPlace: (Place) -> Unit) {
    // Never draw a previous account's private state, including the frame before bind() runs.
    val owns = accountUid != null && state.uid == accountUid
    val safe = if(owns) state else state.copy(uid=null,profile=null,progress=emptyMap(),badges=emptyList(),ready=emptySet(),errors=emptySet(),cached=emptySet(),saving=false,message=null)
    var section by rememberSaveable { mutableIntStateOf(0) }
    var filter by rememberSaveable { mutableStateOf("available") }
    var query by rememberSaveable { mutableStateOf("") }
    var selectedId by rememberSaveable { mutableStateOf<String?>(null) }
    var preferenceOpen by remember(accountUid) { mutableStateOf(false) }
    val selected = state.missions.value.find { it.id==selectedId }
    val retry: () -> Unit = { model.refreshPublic(); model.bind(accountUid,true) }
    val shown = state.missions.value.filter { mission ->
        val timing=MissionPolicy.window(mission,state.now)
        val matches=when(filter) { "available" -> timing=="available"; "upcoming" -> timing=="upcoming"; "completed" -> owns && safe.progress[mission.id]?.completed==true; else -> true }
        matches && PlacePolicy.normalize(query) in PlacePolicy.normalize("${mission.title} ${mission.description} ${mission.badge.title}")
    }
    Column(Modifier.fillMaxSize().testTag("missions-screen")) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp,vertical = 12.dp),verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) { Text("Tu aventura en Loja",fontSize = 25.sp,fontWeight = FontWeight.ExtraBold);Text("Misiones de Chabaquito",fontSize = 13.sp,color = MaterialTheme.colorScheme.onSurfaceVariant) }
            IconButton(onClick = retry) { Icon(Icons.Default.Refresh,"Actualizar misiones",tint = AdventureBlue) }
        }
        TabRow(selectedTabIndex = section,containerColor = Color.Transparent) {
            listOf("Retos","Mi aventura","Ranking").forEachIndexed { index,title -> Tab(selected = section==index,onClick = { section=index },modifier = Modifier.testTag("missions-tab-$index"),text = { Text(title,maxLines = 1,fontSize = 13.sp) }) }
        }
        LazyColumn(Modifier.weight(1f),contentPadding = PaddingValues(20.dp),verticalArrangement = Arrangement.spacedBy(16.dp)) {
            when(section) {
                0 -> {
                    item { AdventureIntro() }
                    item { PublicMissionStatus(state.missions.loading,state.missions.error,state.missions.cached,"las misiones") }
                    item { OutlinedTextField(query,{query=it},label={Text("Buscar reto o insignia")},leadingIcon={Icon(Icons.Default.Search,null)},singleLine=true,shape=RoundedCornerShape(16.dp),modifier=Modifier.fillMaxWidth().testTag("mission-search")) }
                    item { LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(listOf("available" to "Disponibles","upcoming" to "Próximas","completed" to "Completadas","all" to "Todas")) { (key,title) -> FilterChip(selected=filter==key,onClick={filter=key},label={Text(title)}) }
                    } }
                    if(accountUid==null) item { AdventureLogin(login) }
                    else if(!owns || "progress" !in safe.ready || "progress" in safe.cached) item { PrivateMissionStatus(safe,"progress","tu avance") }
                    if(shown.isEmpty() && !state.missions.loading && !state.missions.error) item {
                        Surface(shape=RoundedCornerShape(20.dp),color=Color.White) { Column(Modifier.padding(22.dp),verticalArrangement=Arrangement.spacedBy(10.dp)) {
                            Text(if(query.isNotBlank()) "No encontramos ese reto." else if(filter=="completed" && accountUid==null) "Ingresa para consultar tus misiones completadas." else if(filter=="completed") "Tus próximos logros te esperan." else "Próximas aventuras con Chabaquito",fontWeight=FontWeight.Bold)
                            Text("Explora las paradas de Loja y vuelve para descubrir nuevos retos.",fontSize=13.sp,color=MaterialTheme.colorScheme.onSurfaceVariant)
                            TextButton(onClick=explore) { Text("Explorar lugares");Icon(Icons.AutoMirrored.Filled.ArrowForward,null,Modifier.padding(start=8.dp).size(16.dp)) }
                        } }
                    }
                    items(shown,key={it.id}) { mission -> MissionCard(mission,safe,owns,state.now) { selectedId=mission.id } }
                    item { Text("Solo cuentan las visitas validadas durante la vigencia del reto. El avance y las insignias se actualizan después de la confirmación.",fontSize=12.sp,color=MaterialTheme.colorScheme.onSurfaceVariant) }
                }
                1 -> {
                    if(accountUid==null) item { AdventureLogin(login) }
                    else {
                        item { PrivateMissionStatus(safe,"profile","tu perfil de explorador") }
                        item { ExplorerSummary(safe,explore) }
                        item { Text("Tus insignias",fontSize=22.sp,fontWeight=FontWeight.ExtraBold) }
                        item { PrivateMissionStatus(safe,"badges","tus insignias") }
                        if("badges" in safe.ready && safe.badges.isEmpty() && "badges" !in safe.cached) item { Text("Todavía no tienes insignias desbloqueadas. Completa una misión para conseguir la primera.",fontSize=14.sp,color=MaterialTheme.colorScheme.onSurfaceVariant) }
                        items(safe.badges,key={it.missionId}) { reward -> Surface(shape=RoundedCornerShape(20.dp),color=Color.White) {
                            Row(Modifier.fillMaxWidth().padding(18.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(14.dp)) {
                                BadgeArt(reward.badge,62)
                                Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(4.dp)) { Text(reward.badge.title,fontWeight=FontWeight.Bold);if(reward.badge.description.isNotBlank()) Text(reward.badge.description,fontSize=13.sp);Text(rarity(reward.badge.rarity),fontSize=11.sp,color=AdventureBlue);reward.unlocked?.let { Text("Desbloqueada · ${missionDate(it)}",fontSize=11.sp,color=MaterialTheme.colorScheme.onSurfaceVariant) } }
                            }
                        } }
                    }
                }
                else -> {
                    item { Text("Ranking de exploradores",fontSize=22.sp,fontWeight=FontWeight.ExtraBold);Text("Los 10 primeros por XP que eligieron participar públicamente.",fontSize=13.sp,color=MaterialTheme.colorScheme.onSurfaceVariant) }
                    item { PublicMissionStatus(state.ranking.loading,state.ranking.error,state.ranking.cached,"el ranking") }
                    items(state.ranking.value.withIndex().toList(),key={it.value.id}) { (index,entry) -> Surface(shape=RoundedCornerShape(18.dp),color=Color.White) {
                        Row(Modifier.fillMaxWidth().padding(16.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(12.dp)) {
                            Text(when(index){0->"🥇";1->"🥈";2->"🥉";else->"#${index+1}"},fontSize=21.sp,fontWeight=FontWeight.Bold,modifier=Modifier.widthIn(min=35.dp))
                            Column(Modifier.weight(1f)) { Text(entry.alias,fontWeight=FontWeight.Bold);Text("Nivel ${entry.level}",fontSize=12.sp,color=MaterialTheme.colorScheme.onSurfaceVariant) }
                            Text("${entry.xp} XP",fontWeight=FontWeight.Bold,color=AdventureBlue)
                        }
                    } }
                    if(!state.ranking.loading && !state.ranking.error && state.ranking.value.isEmpty()) item { Text("El ranking aparecerá cuando haya exploradores que decidan participar.",fontSize=14.sp,color=MaterialTheme.colorScheme.onSurfaceVariant) }
                    if(accountUid==null) item { AdventureLogin(login) }
                    else item {
                        Surface(shape=RoundedCornerShape(20.dp),color=Color(0xFFE5F1FF)) {
                            Column(Modifier.padding(20.dp),verticalArrangement=Arrangement.spacedBy(10.dp)) {
                                Text(if(safe.profile?.joined==true) "Participas como ${safe.profile.alias}" else "Participar es opcional",fontWeight=FontWeight.Bold)
                                Text("Tu alias y tus datos públicos de explorador se muestran en el ranking. Tu correo no se publica.",fontSize=13.sp)
                                PrivateMissionStatus(safe,"profile","tu preferencia")
                                Button(onClick={model.clearMessage();preferenceOpen=true},enabled=owns && "profile" in safe.ready && "profile" !in safe.cached && !safe.saving,modifier=Modifier.testTag("mission-ranking-preference")) { Text(if(safe.profile?.joined==true) "Cambiar mi participación" else "Elegir mi participación") }
                                safe.message?.let { Text(it,fontSize=12.sp) }
                            }
                        }
                    }
                }
            }
        }
    }
    if(selected!=null) ModalBottomSheet(onDismissRequest={selectedId=null},containerColor=Color(0xFFF0F7FF)) {
        MissionDetail(selected,state.now,places,{selectedId=null;openPlace(it)})
    }
    if(preferenceOpen && owns) RankingPreferences(safe,model) { preferenceOpen=false }
}

@Composable
private fun AdventureIntro() {
    Surface(shape=RoundedCornerShape(24.dp),color=AdventureInk,contentColor=Color.White) {
        Row(Modifier.padding(18.dp),verticalAlignment=Alignment.CenterVertically) {
            Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(8.dp)) { Text("DESCUBRE · VISITA · GANA",fontSize=10.sp,fontWeight=FontWeight.Bold,color=AdventureGold);Text("La aventura empieza contigo",fontSize=23.sp,lineHeight=28.sp,fontWeight=FontWeight.ExtraBold);Text("Elige un reto, conoce sus paradas y consigue nuevas insignias.",fontSize=13.sp,color=Color(0xFFD3E7FA)) }
            Image(painterResource(R.drawable.chabaquito),"Chabaquito",Modifier.width(90.dp).height(130.dp),contentScale=ContentScale.Fit)
        }
    }
}
@Composable
private fun AdventureLogin(login: () -> Unit) {
    Surface(shape=RoundedCornerShape(20.dp),color=Color(0xFFE5F1FF)) { Column(Modifier.padding(18.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
        Text("Guarda tu aventura",fontWeight=FontWeight.Bold);Text("Ingresa con tu cuenta de VisitaLoja para consultar el avance y las insignias que también ves en la web.",fontSize=13.sp)
        Button(onClick=login) { Text("Ingresar a mi cuenta") }
    } }
}
@Composable
private fun PublicMissionStatus(loading: Boolean,error: Boolean,cached: Boolean,subject: String) {
    when { loading -> LinearProgressIndicator(Modifier.fillMaxWidth());error -> Text("No pudimos actualizar $subject. Pulsa actualizar para reintentar.",fontSize=13.sp,color=MaterialTheme.colorScheme.error);cached -> Text("Consulta guardada. Conéctate para ver los cambios más recientes.",fontSize=12.sp,color=MaterialTheme.colorScheme.onSurfaceVariant) }
}
@Composable
private fun PrivateMissionStatus(state: MissionState,key: String,subject: String) {
    when { key in state.errors -> Text("No pudimos consultar $subject. Pulsa actualizar para reintentar.",fontSize=13.sp,color=MaterialTheme.colorScheme.error);key !in state.ready -> Text("Consultando $subject…",fontSize=12.sp,color=MaterialTheme.colorScheme.onSurfaceVariant);key in state.cached -> Text("Esperando conexión para actualizar $subject.",fontSize=12.sp,color=MaterialTheme.colorScheme.onSurfaceVariant) }
}
@Composable
private fun BadgeArt(badge: MissionBadge,size: Int) {
    Box(Modifier.size(size.dp).clip(CircleShape).background(Color(0xFFFFF2CF)),contentAlignment=Alignment.Center) {
        if(badge.image!=null) AsyncImage(badge.image,badge.title,Modifier.fillMaxSize().padding(6.dp),contentScale=ContentScale.Fit,error=painterResource(R.drawable.visitaloja_logo))
        else Text(badge.icon,fontSize=(size*0.45).sp)
    }
}
@Composable
private fun MissionCard(mission: LojaMission,state: MissionState,owns: Boolean,now: Long,open: () -> Unit) {
    val progress=state.progress[mission.id]
    val known=owns && "progress" in state.ready && ("progress" !in state.cached || progress!=null)
    val target=progress?.target ?: mission.target
    val current=progress?.current ?: 0
    val window=MissionPolicy.window(mission,now)
    Card(onClick=open,shape=RoundedCornerShape(24.dp),colors=CardDefaults.cardColors(containerColor=Color.White),modifier=Modifier.fillMaxWidth().testTag("mission-${mission.id}")) {
        Column(Modifier.padding(20.dp),verticalArrangement=Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(12.dp)) { BadgeArt(mission.badge,52);Column(Modifier.weight(1f)) { Text(MissionPolicy.typeLabel(mission.type),fontSize=11.sp,color=AdventureBlue,fontWeight=FontWeight.Bold);Text(when { known && progress?.completed==true -> "Completada";window=="upcoming" -> "Próximamente";window=="ended" -> "Finalizada";known && current>0 -> "En camino";else -> "Por descubrir" },fontSize=12.sp,color=MaterialTheme.colorScheme.onSurfaceVariant) } }
            Text(mission.title,fontSize=20.sp,lineHeight=25.sp,fontWeight=FontWeight.Bold)
            Text(mission.description,fontSize=13.sp,maxLines=3,overflow=TextOverflow.Ellipsis,color=MaterialTheme.colorScheme.onSurfaceVariant)
            Text("Meta: ${mission.target} ${MissionPolicy.unit(mission.type)}",fontSize=12.sp,fontWeight=FontWeight.Bold)
            Text("🏅 ${mission.badge.title}",fontSize=13.sp,color=AdventureBlue)
            if(known) {
                LinearProgressIndicator(progress={current.toFloat()/target},modifier=Modifier.fillMaxWidth(),color=if(progress?.completed==true) Color(0xFF18724B) else AdventureBlue)
                Text("$current / $target${if("progress" in state.cached) " · Consulta guardada" else ""}",fontSize=12.sp,fontWeight=FontWeight.Bold)
                if(current==target && progress?.completed!=true) Text("Meta alcanzada. La confirmación está pendiente.",fontSize=12.sp)
            }
            Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically) { Text("Ver reto y paradas",Modifier.weight(1f),fontSize=13.sp,color=AdventureBlue,fontWeight=FontWeight.Bold);Icon(Icons.AutoMirrored.Filled.ArrowForward,null,tint=AdventureBlue,modifier=Modifier.size(18.dp)) }
        }
    }
}
@Composable
private fun ExplorerSummary(state: MissionState,explore: () -> Unit) {
    val profile=state.profile
    if(profile==null) {
        if("profile" in state.ready && "profile" !in state.cached) Surface(shape=RoundedCornerShape(20.dp),color=Color.White) { Column(Modifier.padding(20.dp),verticalArrangement=Arrangement.spacedBy(10.dp)) { Text("Tu primera aventura te espera",fontWeight=FontWeight.Bold);Text("Todavía no tienes actividad validada de explorador.",fontSize=13.sp);TextButton(onClick=explore) { Text("Descubrir una parada") } } }
        return
    }
    val level=MissionPolicy.level(profile.xp)
    Surface(shape=RoundedCornerShape(24.dp),color=AdventureInk,contentColor=Color.White) { Column(Modifier.padding(22.dp),verticalArrangement=Arrangement.spacedBy(14.dp)) {
        Text("Nivel ${level.number} · ${level.title}",fontSize=20.sp,lineHeight=25.sp,fontWeight=FontWeight.Bold,color=AdventureGold)
        Text("${profile.xp} XP",fontSize=34.sp,fontWeight=FontWeight.ExtraBold)
        LinearProgressIndicator(progress={level.fraction},modifier=Modifier.fillMaxWidth(),color=AdventureGold,trackColor=Color(0xFF38516D))
        Text(if(level.maximum) "Has alcanzado el nivel más alto." else "${level.remaining} XP para el nivel ${level.number+1}",fontSize=12.sp,color=Color(0xFFD3E7FA))
        Row(horizontalArrangement=Arrangement.spacedBy(24.dp)) { Column { Text(profile.places.toString(),fontSize=23.sp,fontWeight=FontWeight.Bold);Text("Lugares",fontSize=12.sp) };Column { Text(profile.cantons.toString(),fontSize=23.sp,fontWeight=FontWeight.Bold);Text("Cantones",fontSize=12.sp) };Column { Text(if("badges" in state.ready && ("badges" !in state.cached || state.badges.isNotEmpty())) state.badges.size.toString() else "—",fontSize=23.sp,fontWeight=FontWeight.Bold);Text("Insignias",fontSize=12.sp) } }
    } }
}
@Composable
private fun MissionDetail(mission: LojaMission,now: Long,places: PlacesState,open: (Place) -> Unit) {
    val eligible=remember(mission,places.places) { MissionPolicy.eligible(mission,places.places) }
    val context=LocalContext.current
    LazyColumn(Modifier.fillMaxWidth().fillMaxHeight(0.88f),contentPadding=PaddingValues(22.dp),verticalArrangement=Arrangement.spacedBy(16.dp)) {
        item { Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(14.dp)) { BadgeArt(mission.badge,64);Text(mission.title,fontSize=24.sp,lineHeight=29.sp,fontWeight=FontWeight.ExtraBold,modifier=Modifier.weight(1f)) } }
        item { Text(mission.description,fontSize=15.sp,lineHeight=23.sp) }
        item { Text("Cómo completar el reto",fontWeight=FontWeight.Bold,fontSize=18.sp);Text("Consigue ${mission.target} ${MissionPolicy.unit(mission.type)}. ${if(mission.type=="total_visits") "Las visitas deben quedar confirmadas." else if(mission.type=="canton_visits") "Cada cantón seleccionado cuenta una vez." else "Cada parada seleccionada cuenta una vez."}",fontSize=14.sp,modifier=Modifier.padding(top=6.dp)) }
        if(mission.starts!=null || mission.ends!=null) item { Text(listOfNotNull(mission.starts?.let{"Inicio: ${missionDate(it)}"},mission.ends?.let{"Fin: ${missionDate(it)}"}).joinToString("\n"),fontSize=13.sp,color=MaterialTheme.colorScheme.onSurfaceVariant) }
        if(MissionPolicy.window(mission,now)!="available") item { Text(if(MissionPolicy.window(mission,now)=="upcoming") "El reto todavía no ha comenzado. Puedes ir conociendo sus paradas." else "La vigencia de este reto ha finalizado.",fontSize=13.sp,color=MaterialTheme.colorScheme.primary) }
        item { Surface(shape=RoundedCornerShape(20.dp),color=Color(0xFFFFF2CF)) { Column(Modifier.padding(18.dp),verticalArrangement=Arrangement.spacedBy(6.dp)) { Text("Tu insignia: ${mission.badge.title}",fontWeight=FontWeight.Bold);if(mission.badge.description.isNotBlank()) Text(mission.badge.description,fontSize=13.sp);if(mission.physical) { Text("Esta misión también incluye un beneficio físico sujeto a las condiciones de su campaña.",fontSize=13.sp);TextButton(onClick={runCatching { context.startActivity(Intent(Intent.ACTION_VIEW,Uri.parse("https://www.visitaloja.com/#misiones"))) }}) { Text("Consultar condiciones en la web") } } } } }
        item { Text("Paradas relacionadas · ${eligible.size}",fontSize=20.sp,fontWeight=FontWeight.Bold) }
        if(places.loading) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
        if(places.offline) item { Text("Directorio guardado. Conéctate para comprobar las paradas actuales.",fontSize=12.sp,color=MaterialTheme.colorScheme.onSurfaceVariant) }
        if(eligible.isEmpty() && !places.loading) item { Text("Todavía no hay paradas publicadas que coincidan con este reto.",fontSize=14.sp,color=MaterialTheme.colorScheme.onSurfaceVariant) }
        items(eligible,key={it.id}) { place -> Surface(onClick={open(place)},shape=RoundedCornerShape(18.dp),color=Color.White,modifier=Modifier.testTag("mission-place-${place.id}")) {
            Row(Modifier.fillMaxWidth().padding(12.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(12.dp)) {
                AsyncImage(place.imageUrl ?: R.drawable.visitaloja_logo,null,Modifier.size(65.dp).clip(RoundedCornerShape(12.dp)),contentScale=ContentScale.Crop,error=painterResource(R.drawable.visitaloja_logo))
                Column(Modifier.weight(1f)) { Text(place.title,fontWeight=FontWeight.Bold);Text("${place.categoryLabel} · ${place.cantonId}",fontSize=12.sp,color=MaterialTheme.colorScheme.onSurfaceVariant) };Icon(Icons.AutoMirrored.Filled.ArrowForward,null,tint=AdventureBlue)
            }
        } }
        item { Text("Abre una parada para conocerla y registrar tu visita por el procedimiento habitual. La insignia se concede tras validar el reto.",fontSize=12.sp,color=MaterialTheme.colorScheme.onSurfaceVariant) }
    }
}
@Composable
private fun RankingPreferences(state: MissionState,model: MissionViewModel,close: () -> Unit) {
    val initialRevision=remember { state.preferenceRevision }
    var joined by remember { mutableStateOf(state.profile?.joined==true) }
    var alias by remember { mutableStateOf(state.profile?.alias.orEmpty()) }
    LaunchedEffect(state.preferenceRevision) { if(state.preferenceRevision>initialRevision) close() }
    AlertDialog(onDismissRequest={if(!state.saving)close()},title={Text("Mi participación en el ranking")},text={Column(Modifier.verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(12.dp)) {
        Text("Publicarás tu alias y tus datos públicos de explorador. Puedes dejar de participar cuando quieras.",fontSize=13.sp)
        Row(verticalAlignment=Alignment.CenterVertically) { Checkbox(checked=joined,onCheckedChange={joined=it},enabled=!state.saving);Text("Quiero participar",fontWeight=FontWeight.Bold) }
        OutlinedTextField(alias,{if(it.length<=40)alias=it},label={Text("Alias público")},singleLine=true,enabled=joined&&!state.saving,supportingText={Text("Hasta 40 caracteres. Evita usar tu correo.")})
        state.message?.let { Text(it,fontSize=12.sp,color=MaterialTheme.colorScheme.error) }
    }},confirmButton={TextButton(onClick={model.savePreference(joined,alias)},enabled=!state.saving && (!joined||MissionPolicy.validAlias(alias))) { Text(if(state.saving) "Guardando…" else "Guardar preferencia") }},dismissButton={TextButton(onClick=close,enabled=!state.saving) { Text("Cancelar") }})
}
private fun missionDate(time: Long): String = DateFormat.getDateTimeInstance(DateFormat.MEDIUM,DateFormat.SHORT).apply { timeZone=TimeZone.getTimeZone("America/Guayaquil") }.format(Date(time))
private fun rarity(value: String): String = when(value) { "uncommon"->"Poco común";"rare"->"Rara";"epic"->"Épica";"legendary"->"Legendaria";else->"Común" }
