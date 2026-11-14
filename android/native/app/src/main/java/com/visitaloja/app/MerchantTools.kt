package com.visitaloja.app

import android.app.Application
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

internal data class MerchantToolsState(val uid: String? = null, val place: String = "", val busy: Boolean = false, val loaded: Boolean = false, val canProfile: Boolean = false, val canBirthday: Boolean = false, val profile: Map<String,Any?> = emptyMap(), val birthday: Map<String,Any?> = emptyMap(), val limit: Int = 6, val message: String? = null, val program: org.json.JSONObject? = null)
internal class MerchantToolsViewModel(app: Application): AndroidViewModel(app) {
    private val db = FirebaseFirestore.getInstance()
    private val auth = FirebaseAuth.getInstance()
    private val mutable = MutableStateFlow(MerchantToolsState())
    val state = mutable.asStateFlow()
    private var epoch = 0
    private fun same(uid: String, place: String, version: Int) = epoch == version && auth.currentUser?.uid == uid && mutable.value.place == place
    fun bind(uid: String?, place: String) {
        val version = ++epoch
        mutable.value = MerchantToolsState(uid, place, busy = uid != null)
        if (uid == null || !MerchantScanPolicy.placeId(place)) return
        viewModelScope.launch {
            try {
                val owner = db.collection("businessAccess").document(uid+"_"+place).get(Source.SERVER).await()
                val merchant = db.collection("missionRewardMerchants").document(uid).get(Source.SERVER).await()
                val assigned = merchant.getBoolean("active") == true && (merchant.get("placeIds") as? List<*>)?.contains(place) == true
                val canProfile = if (owner.exists()) owner.getBoolean("active") == true && owner.getString("uid") == uid && owner.getString("placeId") == place && owner.getString("role") == "owner" else assigned
                check(canProfile || assigned) { "No tienes acceso activo a esta parada." }
                val profile = db.collection("locales").document(place).get(Source.SERVER).await()
                check(profile.exists()) { "Parada no disponible." }
                val birthday = if (assigned) db.collection("birthdayOffers").document(place).get(Source.SERVER).await().data.orEmpty() else emptyMap()
                val entitlement = if(canProfile) db.collection("businessEntitlements").document(place).get(Source.SERVER).await() else null
                val limit = if (entitlement?.getBoolean("active") != false) (entitlement?.getLong("maxGalleryImages")?.toInt() ?: 6).coerceIn(0,100) else 6
                if(same(uid,place,version)) mutable.value = MerchantToolsState(uid,place,loaded=true,canProfile=canProfile,canBirthday=assigned,profile=profile.data.orEmpty(),birthday=birthday,limit=limit)
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { if(same(uid,place,version)) mutable.value = mutable.value.copy(busy=false,message=if(e is IllegalStateException)e.message else "No se pudo comprobar acceso y contenido. Actualiza para continuar.") }
        }
    }
    fun program(action:String, season:String, title:String="", description:String="",days:Int=30){
        val old=mutable.value;val uid=old.uid?:return;if(old.busy||!old.canProfile)return
        val version=epoch;mutable.value=old.copy(busy=true,message=null)
        viewModelScope.launch{try{
            val user=auth.currentUser?.takeIf{it.uid==uid}?:error("Inicia sesión.")
            val token=user.getIdToken(false).await().token?:error("Inicia sesión.")
            val body=org.json.JSONObject().put("action",action).put("placeId",old.place).put("seasonId",season)
            if(action=="save")body.put("version",old.program?.optLong("version")?:-1L).put("rewardTitle",title).put("rewardDescription",description).put("rewardValidityDays",days)
            val result=kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO){NativeApi.post("https://www.visitaloja.com/api/chabaquito-ranking?action=merchant-program",token,body)}
            if(same(uid,old.place,version))mutable.value=mutable.value.copy(busy=false,program=if(action=="load")result else null,message=if(action=="save")"Premio actualizado. Actualiza para continuar editando." else null)
        }catch(e:CancellationException){throw e}catch(e:Exception){if(same(uid,old.place,version))mutable.value=mutable.value.copy(busy=false,message=e.message?:"No se pudo consultar la configuración del premio.")}}
    }
    fun saveProfile(values: Map<String,Any?>) = save(false,values)
    fun saveBirthday(values: Map<String,Any?>) = save(true,values)
    private fun save(birthday: Boolean, values: Map<String,Any?>) {
        val old = mutable.value; val uid=old.uid ?: return
        if(!old.loaded || old.busy || auth.currentUser?.uid != uid || (if(birthday) !old.canBirthday else !old.canProfile)) return
        val version=epoch; mutable.value=old.copy(busy=true,message=null)
        viewModelScope.launch {
            try {
                val ref=db.collection(if(birthday) "birthdayOffers" else "locales").document(old.place)
                val base=if(birthday)old.birthday else old.profile
                val allowed=if(birthday)setOf("active","title","description","daysBefore","daysAfter","minimumSpend") else setOf("desc","description","phone","whatsapp","hours","customLogoUrl","heroImage","gallery")
                require(values.keys.all { it in allowed })
                val patch=values.filter { (key,value)->value != base[key] }
                if(patch.isNotEmpty()) db.runTransaction { tx ->
                    val current=tx.get(ref)
                    check(same(uid,old.place,version)) { "La sesión o la parada cambió." }
                    check(if(birthday)current.data.orEmpty()==base else patch.keys.all { current.get(it)==base[it] }) { "El contenido cambió desde otro dispositivo. Actualiza antes de guardar." }
                    if(birthday) {
                        tx.set(ref, values + mapOf("placeId" to old.place,"placeName" to old.profile["title"].orEmptyString(),"updatedAt" to FieldValue.serverTimestamp(),"updatedBy" to uid))
                    } else {
                        tx.update(ref,patch+mapOf("merchantUpdatedAt" to FieldValue.serverTimestamp(),"merchantUpdatedBy" to uid))
                    }
                }.await()
                val birthdayAfter=if(birthday)try{ref.get(Source.SERVER).await().data}catch(e:CancellationException){throw e}catch(_:Exception){null}else null
                if(same(uid,old.place,version)) mutable.value=mutable.value.copy(busy=false,loaded=if(birthday)birthdayAfter!=null else old.loaded,profile=if(birthday)old.profile else old.profile+values,birthday=if(birthday)birthdayAfter?:values else old.birthday,message=if(birthday&&birthdayAfter==null)"Campaña guardada. Actualiza para consultar su versión actual." else "Cambios guardados.")
            } catch(e: CancellationException){throw e}
            catch(e: Exception){if(same(uid,old.place,version))mutable.value=mutable.value.copy(busy=false,message=if(e is IllegalStateException)e.message else "No se pudo guardar. Comprueba conexión, permisos y límites del plan antes de reintentar.")}
        }
    }
    fun upload(uri: Uri, purpose: String, done: (String)->Unit) {
        val s=mutable.value;val uid=s.uid?:return
        if(s.busy||!s.canProfile||!s.loaded)return
        val version=epoch;mutable.value=s.copy(busy=true,message="Subiendo imagen…")
        viewModelScope.launch {
            try {
                val url=MerchantImageUpload.upload(getApplication(),uri,s.place,purpose,uid)
                if(same(uid,s.place,version)){mutable.value=mutable.value.copy(busy=false,message="Imagen subida. Revisa y guarda la ficha para publicarla.");done(url)}
            }catch(e:CancellationException){throw e}
            catch(e:Exception){if(same(uid,s.place,version))mutable.value=mutable.value.copy(busy=false,message=e.message?:"No se pudo subir la imagen.")}
        }
    }
    override fun onCleared(){epoch++;super.onCleared()}
}
private fun Any?.orEmptyString() = this as? String ?: ""

@Composable
internal fun MerchantToolsScreen(uid: String?, place: String, close: ()->Unit) {
    val model:MerchantToolsViewModel=viewModel(key="merchant-tools")
    val observed by model.state.collectAsStateWithLifecycle()
    val state=observed.takeIf { it.uid==uid&&it.place==place } ?: MerchantToolsState(uid,place,busy=true)
    DisposableEffect(uid,place){model.bind(uid,place);onDispose{model.bind(null,"")}}
    var rewardTitle by remember(uid,place,state.program){mutableStateOf(state.program?.optString("rewardTitle").orEmpty())}
    var rewardDescription by remember(uid,place,state.program){mutableStateOf(state.program?.optString("rewardDescription").orEmpty())}
    var rewardDays by remember(uid,place,state.program){mutableStateOf((state.program?.optInt("rewardValidityDays",30)?:30).toString())}
    var season by remember(uid,place){mutableStateOf("")}
    var formError by remember(uid,place){mutableStateOf<String?>(null)}
    var section by remember(uid,place){mutableStateOf("profile")}
    var profile by remember(uid,place,state.profile){mutableStateOf(state.profile)}
    var birthday by remember(uid,place,state.birthday){mutableStateOf(state.birthday)}
    var purpose by remember(uid,place){mutableStateOf("gallery")}
    var confirmation by remember(uid,place){mutableStateOf<String?>(null)}
    val picker=rememberLauncherForActivityResult(ActivityResultContracts.GetContent()){uri->if(uri!=null)model.upload(uri,purpose){url->
        profile=if(purpose=="gallery")profile+("gallery" to ((profile["gallery"] as? List<*>).orEmpty()+mapOf("img" to url,"title" to ""))) else profile+((if(purpose=="logo")"customLogoUrl" else "heroImage") to url)
    }}
    fun field(key:String,label:String,max:Int,map:Map<String,Any?>,edit:(Map<String,Any?>)->Unit): @Composable ()->Unit = {
        OutlinedTextField(map[key].orEmptyString(),{edit(map+(key to it.take(max)))},label={Text(label)},modifier=Modifier.fillMaxWidth(),enabled=!state.busy)
    }
    Dialog(close,properties=DialogProperties(usePlatformDefaultWidth=false)){
        Surface(Modifier.fillMaxSize().systemBarsPadding(),color=MaterialTheme.colorScheme.background){
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
                Text(state.profile["title"].orEmptyString().ifBlank{"Herramientas del negocio"},style=MaterialTheme.typography.headlineSmall)
                TextButton(onClick=close){Text("Cerrar herramientas")}
                if(state.busy)LinearProgressIndicator(Modifier.fillMaxWidth())
                state.message?.let{Text(it)}
                formError?.let{Text(it,color=MaterialTheme.colorScheme.error)}
                OutlinedButton(onClick={model.bind(uid,place)},enabled=!state.busy){Text("Actualizar contenido y permisos")}
                if(state.loaded){
                    val context=androidx.compose.ui.platform.LocalContext.current
                    OutlinedButton(onClick={runCatching{context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW,android.net.Uri.parse("https://www.visitaloja.com/merchant-dashboard.html?place="+android.net.Uri.encode(place))))}}){Text("Abrir configuraciones avanzadas en el portal web")}

                    Row(Modifier.horizontalScroll(rememberScrollState())) { FilterChip(section=="profile",{section="profile"},{Text("Ficha y fotos")});Spacer(Modifier.width(8.dp));FilterChip(section=="birthday",{section="birthday"},{Text("Cumpleaños")});Spacer(Modifier.width(8.dp));FilterChip(section=="reward",{section="reward"},{Text("Premio")}) }
                    if(section=="reward"){
                        Text("Configura el premio habitual o de una temporada existente. Las metas, sellos y publicación del programa se administran desde el panel central.")
                        OutlinedButton(onClick={model.program("load",season)},enabled=!state.busy){Text("Consultar configuración actual")}
                        state.program?.let{program->
                            TextButton(onClick={season="";model.program("load","")}){Text("Premio habitual")}
                            val seasons=program.optJSONArray("seasons")
                            if(seasons!=null)for(i in 0 until seasons.length()){
                                val item=seasons.optJSONObject(i)?:continue
                                TextButton(onClick={season=item.optString("id");model.program("load",season)}){Text(item.optString("title"))}
                            }
                            OutlinedTextField(rewardTitle,{rewardTitle=it.take(100)},label={Text("Premio")},modifier=Modifier.fillMaxWidth(),enabled=!state.busy)
                            OutlinedTextField(rewardDescription,{rewardDescription=it.take(400)},label={Text("Condiciones")},modifier=Modifier.fillMaxWidth(),enabled=!state.busy)
                            OutlinedTextField(rewardDays,{rewardDays=it.take(3)},label={Text("Días para canjear (1–365)")},enabled=!state.busy)
                            Button(onClick={confirmation="reward"},enabled=!state.busy&&rewardTitle.isNotBlank()&&(rewardDays.toIntOrNull()?:0) in 1..365){Text("Revisar y guardar premio")}
                        }
                    }else if(section=="profile"){
                        if(!state.canProfile)Text("La edición de ficha requiere acceso de propietario.") else {
                            val description=if("description" in state.profile && "desc" !in state.profile)"description" else "desc"
                            field(description,"Descripción",1200,profile){profile=it}()
                            field("phone","Teléfono",30,profile){profile=it}()
                            field("whatsapp","WhatsApp",30,profile){profile=it}()
                            field("hours","Horario publicado",600,profile){profile=it}()
                            listOf("logo" to "customLogoUrl","hero" to "heroImage").forEach{(kind,key)->
                                field(key,if(kind=="logo")"Enlace del logo" else "Enlace de portada",2000,profile){profile=it}()
                                OutlinedButton(onClick={purpose=kind;picker.launch("image/*")},enabled=!state.busy){Text(if(kind=="logo")"Subir logo desde el teléfono" else "Subir portada desde el teléfono")}
                                (profile[key] as? String)?.takeIf{PlacePolicy.safeImage(it)!=null}?.let{coil.compose.AsyncImage(it,null,Modifier.fillMaxWidth().height(110.dp),contentScale=androidx.compose.ui.layout.ContentScale.Fit)}
                            }
                            val gallery=(profile["gallery"] as? List<*>).orEmpty()
                            Text("Galería: ${gallery.size} fotos · límite ${state.limit}")
                            gallery.forEachIndexed{index,row->
                                val url=if(row is String)row else (row as? Map<*,*>)?.get("img") as? String
                                Row(Modifier.fillMaxWidth()){
                                    if(url!=null)coil.compose.AsyncImage(url,null,Modifier.weight(1f).height(100.dp),contentScale=androidx.compose.ui.layout.ContentScale.Fit)
                                    TextButton(onClick={profile=profile+("gallery" to gallery.filterIndexed{i,_->i!=index})},enabled=!state.busy){Text("Quitar")}
                                }
                            }
                            OutlinedButton(onClick={purpose="gallery";picker.launch("image/*")},enabled=!state.busy&&gallery.size<state.limit){Text("Añadir foto de galería")}
                            Button(onClick={confirmation="profile"},enabled=!state.busy,modifier=Modifier.fillMaxWidth().testTag("merchant-profile-save")){Text("Revisar y guardar ficha")}
                        }
                    }else if(!state.canBirthday)Text("Los cumpleaños requieren una cuenta de encargado asignada.") else {
                        val active=birthday["active"]==true
                        Row { Checkbox(active,{birthday=birthday+("active" to it)},enabled=!state.busy);Text("Campaña activa") }
                        field("title","Título del beneficio",120,birthday){birthday=it}()
                        field("description","Descripción y condiciones",500,birthday){birthday=it}()
                        listOf("daysBefore" to "Días antes (0–30)","daysAfter" to "Días después (0–30)","minimumSpend" to "Consumo mínimo").forEach{(key,label)->
                            val value=birthday[key]?.toString()?:if(key=="daysBefore")"7" else if(key=="daysAfter")"2" else "0"
                            OutlinedTextField(value,{birthday=birthday+(key to it.take(12))},label={Text(label)},enabled=!state.busy,modifier=Modifier.fillMaxWidth())
                        }
                        Button(onClick={confirmation="birthday"},enabled=!state.busy,modifier=Modifier.fillMaxWidth()){Text("Revisar y guardar cumpleaños")}
                    }
                }
            }
        }
    }
    confirmation?.let { kind ->
        AlertDialog(onDismissRequest={confirmation=null},title={Text("Guardar cambios publicados")},text={Text("Se actualizará únicamente esta parada. La ficha o campaña será visible según su configuración. No se entregan premios ni se envían avisos al guardar.")},confirmButton={TextButton(onClick={
            formError=null
            if(kind=="reward")model.program("save",season,rewardTitle,rewardDescription,rewardDays.toIntOrNull()?:0)
            else if(kind=="profile"){
                val keys=listOf("desc","description","phone","whatsapp","hours","customLogoUrl","heroImage","gallery")
                val values=profile.filterKeys{it in keys}.let{v->if("desc" in v && "description" in state.profile && v["desc"]!=state.profile["desc"])v+("description" to v["desc"])else v}
                val valid=listOf("customLogoUrl","heroImage").all{values[it].orEmptyString().let{u->u.isBlank()||PlacePolicy.safeImage(u)!=null}}
                if(valid)model.saveProfile(values) else formError="Los enlaces de imágenes deben ser HTTPS válidos."
            } else {
                val before=birthday["daysBefore"]?.toString()?.toIntOrNull()?:if("daysBefore" !in birthday)7 else -1
                val after=birthday["daysAfter"]?.toString()?.toIntOrNull()?:if("daysAfter" !in birthday)2 else -1
                val minimum=birthday["minimumSpend"]?.toString()?.replace(',','.')?.toDoubleOrNull()?:if("minimumSpend" !in birthday)0.0 else -1.0
                if(before in 0..30&&after in 0..30&&minimum.isFinite()&&minimum>=0&&birthday["title"].orEmptyString().trim().isNotEmpty())model.saveBirthday(mapOf("active" to (birthday["active"]==true),"title" to birthday["title"].orEmptyString().trim(),"description" to birthday["description"].orEmptyString().trim(),"daysBefore" to before,"daysAfter" to after,"minimumSpend" to minimum)) else formError="Revisa título, días (0–30) y consumo mínimo."
            }
            confirmation=null
        }){Text("Guardar")}},dismissButton={TextButton(onClick={confirmation=null}){Text("Volver a editar")}})
    }
}
