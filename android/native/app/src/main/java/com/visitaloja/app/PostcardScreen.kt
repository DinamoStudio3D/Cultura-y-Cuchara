package com.visitaloja.app

import android.content.ClipData
import android.content.Intent
import android.graphics.Bitmap
import java.io.File
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private val PostcardSaver=listSaver<PostcardDraft,Any>(save={listOf(it.name,it.place,it.message,it.format,it.contain,it.zoom,it.x,it.y,it.rotation,it.mirror,it.filter)},restore={PostcardDraft(it[0]as String,it[1]as String,it[2]as String,it[3]as String,it[4]as Boolean,it[5]as Float,it[6]as Float,it[7]as Float,it[8]as Int,it[9]as Boolean,it[10]as String)})
private data class PostcardRenderKey(val source: String?,val credit: String,val frame: PostcardFrame,val settings: PostcardSettings,val draft: PostcardDraft)
private data class RenderedPostcard(val key: PostcardRenderKey,val bitmap: Bitmap)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PostcardScreen(config: PostcardConfig,photos: PublicContent<List<LojaPhoto>>,retry: ()->Unit) {
    val context=LocalContext.current;val scope=rememberCoroutineScope()
    var draft by rememberSaveable(stateSaver=PostcardSaver){mutableStateOf(PostcardDraft())}
    var sourceKey by rememberSaveable {mutableStateOf<String?>(null)}
    var frameId by rememberSaveable {mutableStateOf("brand-memory")}
    var preview by rememberSaveable {mutableStateOf(false)}
    var choosePhoto by remember {mutableStateOf(false)}
    var exporting by remember {mutableStateOf(false)}
    var status by remember {mutableStateOf<String?>(null)}
    var renderError by remember {mutableStateOf<String?>(null)}
    var rendered by remember {mutableStateOf<RenderedPostcard?>(null)}
    var pendingSavePath by rememberSaveable {mutableStateOf<String?>(null)}
    val gallery=photos.value.find { sourceKey=="gallery:${it.id}" }
    val source=when {sourceKey?.startsWith("phone:")==true->sourceKey?.removePrefix("phone:");sourceKey=="sample"->config.settings.sample;else->gallery?.url}
    val credit=when {sourceKey?.startsWith("phone:")==true->"Foto personal";gallery!=null->"Foto: ${gallery.credit}";else->"Crédito no indicado"}
    val frame=config.settings.frames.find {it.id==frameId}?:config.settings.frames.first()
    val key=PostcardRenderKey(source,credit,frame,config.settings,draft)
    val output=rendered?.takeIf {it.key==key}
    LaunchedEffect(photos.value,photos.loading,config.settings.sample) {
        if(sourceKey==null) { if(photos.value.isNotEmpty())sourceKey="gallery:${photos.value.first().id}" else if(!photos.loading&&config.settings.sample!=null)sourceKey="sample" }
    }
    LaunchedEffect(key) {
        rendered=null;renderError=null
        if(key.source==null)return@LaunchedEffect
        delay(180)
        try {rendered=RenderedPostcard(key,PostcardRenderer.render(context,if(key.source.startsWith("content:"))Uri.parse(key.source) else key.source,credit,frame,config.settings,draft))}
        catch(cancelled: CancellationException){throw cancelled}
        catch(_:OutOfMemoryError){renderError="La imagen necesita demasiada memoria. Elige otra fotografía."}
        catch(_:Exception){renderError="No pudimos preparar la foto o el marco. Comprueba la conexión o elige otra imagen."}
    }
    val pick=rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()){uri->if(uri!=null){sourceKey="phone:$uri";status=null}}
    val save=rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("image/png")){uri->
        val path=pendingSavePath;pendingSavePath=null
        if(uri!=null&&path!=null)scope.launch {
            exporting=true
            try {withContext(Dispatchers.IO){
                val file=File(path);check(file.parentFile?.canonicalFile==File(context.cacheDir,"postcards").canonicalFile&&file.isFile&&file.name.startsWith("postal-"))
                context.contentResolver.openOutputStream(uri)?.use {out->file.inputStream().use {it.copyTo(out)}}?:error("No se pudo abrir el destino.")
            };status="Postal guardada en el lugar que elegiste."}
            catch(cancelled: CancellationException){throw cancelled}
            catch(_:Exception){status="No se pudo guardar la postal. Prueba otra ubicación."}
            finally{exporting=false}
        }
    }
    fun share(image: Bitmap){scope.launch {
        exporting=true
        try {
            val file=PostcardRenderer.shareFile(context,image)
            val uri=FileProvider.getUriForFile(context,context.packageName+".postcards",file)
            val intent=Intent(Intent.ACTION_SEND).setType("image/png").putExtra(Intent.EXTRA_STREAM,uri).putExtra(Intent.EXTRA_TEXT,"Un saludo desde Loja · VisitaLoja.com").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            intent.clipData=ClipData.newUri(context.contentResolver,"Postal VisitaLoja",uri)
            context.startActivity(Intent.createChooser(intent,"Compartir postal").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION))
        }catch(cancelled:CancellationException){throw cancelled}
        catch(_:Exception){status="No pudimos abrir las opciones para compartir. Puedes guardar la imagen e intentarlo desde tu galería."}
        finally{exporting=false}
    }}
    LazyColumn(Modifier.fillMaxSize().testTag("postcards-screen"),contentPadding=PaddingValues(20.dp),verticalArrangement=Arrangement.spacedBy(12.dp)) {
        item {
            Text("UN SALUDO DESDE LOJA",style=MaterialTheme.typography.labelLarge,color=MaterialTheme.colorScheme.primary)
            Text("Crea tu postal",style=MaterialTheme.typography.headlineMedium,fontWeight=FontWeight.Bold)
            Text("Elige una foto, encuadra tu recuerdo y compártelo. La creación se realiza en este móvil.")
            Row(horizontalArrangement=Arrangement.spacedBy(10.dp)) {
                FilterChip(selected=!preview,onClick={preview=false},label={Text("Diseñar")})
                FilterChip(selected=preview,onClick={preview=true},modifier=Modifier.testTag("postcard-preview-tab"),label={Text("Ver postal")})
            }
        }
        if(config.loading)item{LinearProgressIndicator(Modifier.fillMaxWidth());Text("Consultando los marcos del panel…")}
        if(config.error)item{Text("No pudimos actualizar los marcos.");OutlinedButton(onClick=retry){Text("Reintentar")}}
        if(!preview) {
            item {
                Button(onClick={pick.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))},modifier=Modifier.fillMaxWidth()){Text("Elegir foto de mi móvil")}
                OutlinedButton(onClick={choosePhoto=true},modifier=Modifier.fillMaxWidth(),enabled=photos.value.isNotEmpty()){Text("Elegir foto de Loja")}
                Text(gallery?.let {"${it.title} · ${it.credit}"}?:if(sourceKey?.startsWith("phone:")==true)"Foto seleccionada del móvil" else "Selecciona una fotografía",style=MaterialTheme.typography.bodySmall)
            }
            item {
                Text("Marco",fontWeight=FontWeight.Bold)
                Row(Modifier.horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(8.dp)){config.settings.frames.forEach { f->FilterChip(selected=frame.id==f.id,onClick={frameId=f.id},label={Text(f.name)})}}
                if(frame.overlay==null) {
                    Text("Formato",fontWeight=FontWeight.Bold)
                    Row(Modifier.horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(8.dp)){listOf("story"to"Historia 9:16","portrait"to"Publicación 4:5","square"to"Cuadrado").forEach {(id,label)->FilterChip(selected=draft.format==id,onClick={draft=draft.copy(format=id)},label={Text(label)})}}
                    OutlinedTextField(draft.name,{draft=draft.copy(name=it.take(25))},label={Text("Tu nombre o apodo")},modifier=Modifier.fillMaxWidth(),singleLine=true)
                    OutlinedTextField(draft.place,{draft=draft.copy(place=it.take(30))},label={Text("Lugar o parada")},modifier=Modifier.fillMaxWidth(),singleLine=true)
                    OutlinedTextField(draft.message,{draft=draft.copy(message=it.take(50))},label={Text("Frase o saludo")},placeholder={Text(config.settings.message)},modifier=Modifier.fillMaxWidth(),singleLine=true)
                }else Text("Este marco conserva el diseño del panel y su proporción original. Los textos personales están disponibles en los estilos de VisitaLoja.",style=MaterialTheme.typography.bodySmall)
            }
            item {
                Text("Encuadre",fontWeight=FontWeight.Bold)
                Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){FilterChip(selected=!draft.contain,onClick={draft=draft.copy(contain=false)},label={Text("Llenar")});FilterChip(selected=draft.contain,onClick={draft=draft.copy(contain=true)},label={Text("Foto completa")})}
                Text("Zoom ${(draft.zoom*100).toInt()}%");Slider(draft.zoom,{draft=draft.copy(zoom=it)},valueRange=1f..3f)
                Text("Horizontal");Slider(draft.x,{draft=draft.copy(x=it)},valueRange=-1f..1f)
                Text("Vertical");Slider(draft.y,{draft=draft.copy(y=it)},valueRange=-1f..1f)
                Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){OutlinedButton(onClick={draft=draft.copy(rotation=(draft.rotation+90)%360,zoom=1f,x=0f,y=0f)}){Text("Girar 90°")};FilterChip(selected=draft.mirror,onClick={draft=draft.copy(mirror=!draft.mirror)},label={Text("Espejo")})}
                Row(Modifier.horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(8.dp)){listOf("natural"to"Natural","sepia"to"Sepia","mono"to"Blanco y negro").forEach {(id,label)->FilterChip(selected=draft.filter==id,onClick={draft=draft.copy(filter=id)},label={Text(label)})}}
                TextButton(onClick={draft=PostcardDraft();status=null}){Text("Restablecer ajustes sin borrar la foto")}
                Button(onClick={preview=true},modifier=Modifier.fillMaxWidth()){Text("Ver mi postal")}
            }
        }else {
            item {
                if(output!=null){Image(output.bitmap.asImageBitmap(),"Vista previa de tu postal",Modifier.fillMaxWidth().heightIn(min=240.dp,max=520.dp).testTag("postcard-image"),contentScale=ContentScale.Fit);Text("${output.bitmap.width} × ${output.bitmap.height} px · PNG",style=MaterialTheme.typography.bodySmall)}
                else if(source==null)Text("Elige una foto publicada de Loja o una imagen de tu móvil.")
                else if(renderError==null){CircularProgressIndicator();Text("Preparando tu postal…")}
                renderError?.let {Text(it,color=MaterialTheme.colorScheme.error)}
            }
            item {
                val enabled=output!=null&&!exporting&&!config.error&&!config.loading
                Button(onClick={output?.bitmap?.let {image->scope.launch {
                    exporting=true
                    try {pendingSavePath=PostcardRenderer.shareFile(context,image).absolutePath;save.launch("Postal-VisitaLoja.png")}
                    catch(cancelled:CancellationException){throw cancelled}
                    catch(_:Exception){status="No pudimos preparar la imagen para guardarla."}
                    finally{exporting=false}
                }}},enabled=enabled,modifier=Modifier.fillMaxWidth()){Text("Guardar PNG")}
                OutlinedButton(onClick={output?.bitmap?.let(::share)},enabled=enabled,modifier=Modifier.fillMaxWidth().testTag("postcard-share")){Text("Compartir postal")}
                TextButton(onClick={preview=false}){Text("Volver a editar")}
                Text("La imagen original se conserva. La postal no se sube a la web; tú eliges dónde guardarla o con quién compartirla.",style=MaterialTheme.typography.bodySmall)
            }
        }
        status?.let{message->item{Text(message,color=MaterialTheme.colorScheme.primary)}}
        if(exporting)item{LinearProgressIndicator(Modifier.fillMaxWidth())}
    }
    if(choosePhoto)ModalBottomSheet(onDismissRequest={choosePhoto=false}){LazyColumn(Modifier.fillMaxWidth().heightIn(max=500.dp).navigationBarsPadding(),contentPadding=PaddingValues(20.dp)){
        item{Text("Fotografías publicadas de Loja",style=MaterialTheme.typography.titleLarge)}
        items(photos.value,key={it.id}){photo->TextButton(onClick={sourceKey="gallery:${photo.id}";choosePhoto=false;if(draft.place.isBlank()||draft.place=="Loja, Ecuador")draft=draft.copy(place=photo.title.take(30))}){Text("${photo.title}\nFoto: ${photo.credit}")}}
    }}
}
