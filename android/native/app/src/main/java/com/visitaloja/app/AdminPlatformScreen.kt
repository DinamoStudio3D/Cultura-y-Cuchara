package com.visitaloja.app

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import kotlin.math.roundToInt

@Composable
internal fun AdminPlatformEntry(uid: String, kind: String) {
    val model: AdminPlatformViewModel = viewModel(key = "admin-platform-" + kind)
    val observed by model.state.collectAsStateWithLifecycle()
    val state = observed.takeIf { it.uid == uid } ?: AdminPlatformState(kind = kind)
    val title = when (kind) { "home" -> "Portada e identidad"; "passport" -> "Configuración de pasaporte"; "maintenance" -> "Mantenimiento de la web"; "chabaquito" -> "Chabaquito"; "benefit" -> "Recompensa comercial Chabaquito"; else -> "Ellos hacen posible VisitaLoja" }
    var open by remember(uid) { mutableStateOf(false) }
    var group by remember(uid) { mutableStateOf(when (kind) { "home" -> "general"; "passport" -> "passport"; "maintenance" -> "maintenance"; "chabaquito" -> "character"; "benefit" -> "benefit"; else -> "supporters" }) }
    var chooseGroup by remember(uid) { mutableStateOf(false) }
    var query by remember(uid) { mutableStateOf("") }
    var discard by remember(uid) { mutableStateOf(false) }
    var reload by remember(uid) { mutableStateOf(false) }
    var review by remember(uid) { mutableStateOf(false) }
    var drafts by remember(uid) { mutableStateOf(false) }
    var preview by remember(uid) { mutableStateOf(false) }
    var english by remember(uid) { mutableStateOf(false) }
    var uploadKey by rememberSaveable(uid, kind) { mutableStateOf("") }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri -> if (uri != null) model.upload(uri, uploadKey) }
    DisposableEffect(uid) { onDispose { model.bind(null, kind) } }
    fun close() {
        if (state.busy) return
        if (state.draft != state.initial) discard = true else { open = false; model.bind(null, kind) }
    }
    val current = state.groups.firstOrNull { it.id == group }
    val config = if (kind == "supporters") SupportersPolicy.config(model.config(state.draft)) else SupportConfig()
    val now = System.currentTimeMillis()
    val rank = config.orderIds.withIndex().associate { it.value to it.index }
    val eligible = if (kind == "supporters") state.places.filter { SupportersPolicy.eligible(it, now) }.sortedBy { rank[it.id] ?: (100000 + state.places.indexOf(it)) } else emptyList()
    OutlinedButton(onClick = { open = true; model.bind(uid, kind) }) { Text("Administrar " + title) }
    if (open) Dialog(onDismissRequest = ::close, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxSize().systemBarsPadding()) {
            LazyColumn(Modifier.fillMaxSize().imePadding(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                item {
                    Text(title, style = MaterialTheme.typography.headlineSmall)
                    TextButton(onClick = ::close, enabled = !state.busy) { Text("Cerrar") }
                    if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                    state.message?.let { Text(it) }
                    OutlinedButton(onClick = { if (state.draft != state.initial) reload = true else model.bind(uid, kind) }, enabled = !state.busy) { Text("Actualizar configuración y permisos") }
                    OutlinedButton(onClick = { model.local("list"); drafts = true }, enabled = state.ready && !state.busy) { Text("Recuperar borrador de este teléfono") }
                    if (kind == "home" || kind == "chabaquito") {
                        if (kind == "home") Text("Edita el contenido compartido con la web. La app aplica los campos que tiene integrados; estilos, redes y algunos bloques pertenecen a la web. El logo público es independiente del icono instalado.")
                        if (kind == "home") Text("Para organizar la biblioteca y los encuadres de portada, abre Fotografías y créditos en Administración. Aquí se conservan sus datos.")
                        OutlinedButton(onClick = { query = ""; chooseGroup = true }, enabled = state.ready && !state.busy) { Text("Elegir bloque · " + current?.title.orEmpty()) }
                        if (kind == "home") OutlinedButton(onClick = { group = "footerContact" }, enabled = state.ready && !state.busy) { Text("Ir a contacto y redes sociales") }
                        if (kind == "chabaquito") Text("La guía nativa usa imagen, visibilidad y saludo de inicio en español. Animación, otros mensajes, retos clásicos y certificado pertenecen a la web. No cambia las misiones V2 ni sus insignias. La campaña comercial y sus existencias se conservan; se gestionan por separado.")
                        current?.let { Text(it.title, style = MaterialTheme.typography.titleLarge); Text(if (it.native) "Incluye contenido utilizado por la app y la web." else "Bloque de presentación de la web.") }
                    } else if (kind == "benefit") {
                        Text("Recompensa comercial de los cinco retos clásicos de la web; no modifica insignias digitales V2 ni premios del pasaporte. El ID identifica la campaña actual y no se cambia desde este editor.")
                        val issued = maxOf(state.countedClaims.toLong(), runCatching { AdminMissionBenefitPolicy.counter(state.campaign?.get("issuedCount")) }.getOrDefault(0))
                        val stock = state.draft["n|benefit|stock"]?.toLongOrNull() ?: 0
                        Text("Cupo total preparado: $stock · Emitidos confirmados en la última consulta: $issued · Restantes estimados: " + (stock - issued).coerceAtLeast(0))
                        Text("Los códigos emitidos consumen cupo aunque se anulen. Guardar conserva el contador más reciente del servidor; no reinicia códigos ni canjes. Revisa las fechas y el cupo antes de activar.")
                    } else if (kind == "maintenance") {
                        Text("Este control cubre la web pública con un aviso temporal. El panel administrativo sigue accesible. La app nativa continúa funcionando: este ajuste corresponde a la web.")
                        Text("La fecha de regreso es un texto informativo; no programa la desactivación. Sin enlace, el aviso no muestra botón de contacto. Revisa la vista previa antes de publicar.")
                    } else if (kind == "passport") {
                        Text("Edita el nombre, mensaje y periodo de premios de la campaña actual. Desactivar premios conserva el funcionamiento de los sellos.")
                        Text("Campaña actual: " + state.base?.text("campaignId").orEmpty().ifBlank { "Sin campaña configurada" })
                        Text("Aquí se conservan el ID, los premios Turista/Lojano, alternativas y negocios de entrega. Para editarlos, abre Administrar premios del pasaporte. Cambiar fechas o activar premios afecta a la campaña actual.")
                    } else {
                        Text("Solo aparecen negocios con plan de pago vigente. Los planes se gestionan en Suscripciones; este editor organiza la franja de apoyo.")
                        Text("En modo Automático se incluyen los elegibles excepto los excluidos. En modo Seleccionar se muestran los elegidos. Mesa Turística se controla por separado.")
                    }
                }
                if (state.ready && current != null) {
                    items(current.fields.filter { it.type != "ids" }, key = { it.key }) { field ->
                        PlatformFieldControl(field, state.draft[field.key].orEmpty(), !state.busy, { model.edit(field.key, it) })
                        if (field.type == "image") {
                            OutlinedButton(onClick = { uploadKey = field.key; picker.launch("image/*") }, enabled = !state.busy) { Text("Elegir imagen del teléfono") }
                            DiscoveryPolicy.media(state.draft[field.key].orEmpty())?.let { AsyncImage(it, field.label, Modifier.fillMaxWidth().height(170.dp), contentScale = ContentScale.Fit) }
                            Text("Una imagen subida se añade al formulario. Guarda un borrador o publica para conservar el enlace.")
                        }
                    }
                    if (kind == "supporters") {
                        item {
                            Text("Negocios elegibles según la última consulta: " + eligible.size)
                            Row { TextButton(onClick = { model.chooseAll(true) }, enabled = !state.busy) { Text("Incluir todos los elegibles") }; TextButton(onClick = { model.chooseAll(false) }, enabled = !state.busy) { Text("Excluir todos los elegibles") } }
                            OutlinedTextField(query, { query = it.take(150) }, label = { Text("Buscar en el directorio cargado") }, modifier = Modifier.fillMaxWidth())
                            Text("Se muestran hasta 50 coincidencias. Escribe para localizar otros negocios. Se conservan las referencias guardadas aunque un negocio haya dejado de ser elegible.")
                        }
                        val shown = eligible.filter { PlacePolicy.normalize(it.title).contains(PlacePolicy.normalize(query)) }.take(50)
                        if (shown.isEmpty()) item { Text("No hay negocios con un plan vigente que coincidan.") }
                        items(shown, key = { it.id }) { place ->
                            val index = eligible.indexOf(place)
                            OutlinedCard(Modifier.fillMaxWidth()) {
                                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Row { Checkbox(if (config.selected) place.id in config.selectedIds else place.id !in config.excludedIds, { model.choose(place.id, it) }, enabled = !state.busy); Text(place.title, Modifier.weight(1f)) }
                                    place.support.logo?.let { AsyncImage(it, place.title, Modifier.fillMaxWidth().height(70.dp), contentScale = ContentScale.Fit) }
                                    Row { TextButton(onClick = { model.move(place.id, -1) }, enabled = !state.busy && index > 0) { Text("Subir") }; TextButton(onClick = { model.move(place.id, 1) }, enabled = !state.busy && index < eligible.lastIndex) { Text("Bajar") } }
                                }
                            }
                        }
                    }
                    item {
                        OutlinedButton(onClick = { preview = true }, enabled = !state.busy) { Text(if (kind == "supporters") "Ver selección de la franja" else "Previsualizar textos") }
                        OutlinedButton(onClick = { model.local("save") }, enabled = !state.busy) { Text("Guardar borrador local") }
                        Button(onClick = { review = true }, enabled = !state.busy && state.draft != state.initial) { Text("Revisar y publicar cambios") }
                    }
                }
            }
        }
    }
    if (chooseGroup) Dialog(onDismissRequest = { chooseGroup = false }) {
        Surface { LazyColumn(Modifier.fillMaxHeight(.85f).padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            item { Text("Elegir bloque"); OutlinedTextField(query, { query = it.take(150) }, label = { Text("Buscar sección") }); TextButton(onClick = { chooseGroup = false; query = "" }) { Text("Volver") } }
            items(state.groups.filter { PlacePolicy.normalize(it.title).contains(PlacePolicy.normalize(query)) }, key = { it.id }) { row ->
                OutlinedButton(onClick = { group = row.id; chooseGroup = false; query = "" }, modifier = Modifier.fillMaxWidth()) { Text(row.title) }
            }
        } }
    }
    if (drafts) AdminDraftPicker(state.localDrafts, state.busy, state.message, { drafts = false }, { drafts = false; model.local("restore") }, { model.local("delete") })
    if (preview) Dialog(onDismissRequest = { preview = false }) {
        Surface { LazyColumn(Modifier.fillMaxHeight(.85f).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item { Text("Vista previa sin publicar", style = MaterialTheme.typography.titleLarge); TextButton(onClick = { preview = false }) { Text("Volver al editor") } }
            if (kind == "supporters") {
                val entries = SupportersPolicy.entries(state.places, config, now, fresh = state.ready)
                item { Text(config.title, style = MaterialTheme.typography.titleMedium); Text(config.subtitle); Text("Negocios e instituciones que aparecerían según la última consulta: " + entries.size) }
                items(entries, key = { it.id }) { entry -> OutlinedCard(Modifier.fillMaxWidth()) { Column(Modifier.padding(12.dp)) { entry.logo?.let { AsyncImage(it, entry.name, Modifier.fillMaxWidth().height(75.dp), contentScale = ContentScale.Fit) }; Text(entry.name) } } }
            } else if (kind == "maintenance") {
                item {
                    Text(if (state.draft["r|active"] == "true") "Aviso preparado: activo" else "Aviso preparado: desactivado")
                    OutlinedCard(Modifier.fillMaxWidth()) { Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text(state.draft["r|badge"].orEmpty(), style = MaterialTheme.typography.labelLarge)
                        Text(state.draft["r|title"].orEmpty(), style = MaterialTheme.typography.headlineSmall)
                        Text(state.draft["r|text"].orEmpty())
                        state.draft["r|returnText"].orEmpty().takeIf { it.isNotBlank() }?.let { Text(it) }
                        state.draft["r|buttonUrl"].orEmpty().takeIf { it.isNotBlank() }?.let { Text(state.draft["r|buttonText"].orEmpty()); Text(it, style = MaterialTheme.typography.bodySmall) }
                    } }
                    Text("Muestra del contenido del aviso web, sin activarlo. El diseño y logo finales pertenecen a la web.")
                }
            } else {
                item { if (kind == "home") Row { Checkbox(english, { english = it }); Text("Ver textos EN") }; Text("Esta vista revisa textos; el diseño final corresponde a cada pantalla.") }
                val values = current?.fields?.filter { field -> field.type == "image" || field.type == "text" && (if (english) field.key.endsWith("En") else !field.key.endsWith("En")) }.orEmpty()
                items(values, key = { it.key }) { field ->
                    if (field.type == "image") DiscoveryPolicy.media(state.draft[field.key].orEmpty())?.let { AsyncImage(it, field.label, Modifier.fillMaxWidth().height(200.dp), contentScale = ContentScale.Fit) }
                    else { Text(field.label, style = MaterialTheme.typography.labelMedium); Text(state.draft[field.key].orEmpty()) }
                }
            }
        } }
    }
    if (review) AlertDialog(onDismissRequest = { review = false }, title = { Text("Publicar configuración") }, text = {
        Text(if (kind == "benefit") "Se guardarán juntos el premio visible y las existencias de la campaña actual. Se conservarán los códigos emitidos, canjes y permisos de negocios. Cambiar el cupo no reinicia el contador. Revisa el estado y las fechas antes de confirmar." else if (kind == "maintenance") "Se guardará el aviso. " + (if (state.draft["r|active"] == "true") "La web pública quedará cubierta por el mensaje hasta que lo desactives. El panel administrativo y la app nativa seguirán accesibles." else "La web pública volverá a estar disponible sin el aviso.") else title + "\nSe guardarán los cambios preparados en todos los bloques de este formulario, con efecto en las vistas que comparten esta configuración. Revisa antes de confirmar.")
    }, confirmButton = { TextButton(onClick = { review = false; model.save() }) { Text("Guardar y publicar") } }, dismissButton = { TextButton(onClick = { review = false }) { Text("Volver") } })
    if (discard || reload) AlertDialog(onDismissRequest = { discard = false; reload = false }, title = { Text("Descartar cambios del formulario") }, text = { Text("Los borradores ya guardados y la configuración publicada se conservan.") },
        confirmButton = { TextButton(onClick = { if (reload) model.bind(uid, kind) else { open = false; model.bind(null, kind) }; discard = false; reload = false }) { Text("Descartar") } }, dismissButton = { TextButton(onClick = { discard = false; reload = false }) { Text("Conservar formulario") } })
}
@Composable
internal fun PlatformFieldControl(field: PlatformField, value: String, enabled: Boolean, change: (String) -> Unit) {
    val labels = mapOf("active" to "Activo", "trial" to "Periodo de prueba", "pending" to "Pendiente de pago", "expired" to "Vencido", "paused" to "Suspendido", "transfer" to "Transferencia", "cash" to "Efectivo", "card" to "Tarjeta", "deposit" to "Depósito", "other" to "Otro", "all" to "Automático", "selected" to "Seleccionar negocios", "small" to "Pequeños", "medium" to "Medianos", "large" to "Grandes", "left" to "Izquierda", "right" to "Derecha", "immersive" to "Inmersiva", "standard" to "Estándar", "compact" to "Compacta", "cinematic" to "Fondo completo", "classic" to "Clásica", "clean" to "Lateral", "extra" to "Muy redondeadas", "elevated" to "Elevadas", "bordered" to "Contorno", "soft" to "Suaves", "contain" to "Foto completa", "cover" to "Llenar y recortar")
    when (field.type) {
        "readonly" -> { Text(field.label, style = MaterialTheme.typography.labelLarge); Text(value) }
        "bool" -> Row { Checkbox(value == "true", { change(it.toString()) }, enabled = enabled); Text(field.label) }
        "choice" -> { Text(field.label); Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) { field.options.forEach { option -> FilterChip(value == option, { change(option) }, label = { Text(labels[option] ?: option) }, enabled = enabled) } } }
        "number" -> {
            Text(field.label + " · " + value)
            Slider((value.toFloatOrNull()?.takeIf { it.isFinite() } ?: field.fallback.toFloatOrNull() ?: field.min.toFloat()).coerceIn(field.min.toFloat(), field.upper.toFloat()),
                { change(if (field.upper <= 1.0) it.toString() else it.roundToInt().toString()) }, valueRange = field.min.toFloat()..field.upper.toFloat(), enabled = enabled)
        }
        else -> OutlinedTextField(value, { change(it.take(field.max)) }, label = { Text(mapOf("inicio" to "Saludo inicial", "mapa" to "Mensaje del mapa", "establecimientos" to "Mensaje de paradas", "fiavl" to "Mensaje del festival", "postales" to "Mensaje de postales", "pasaporte" to "Mensaje del pasaporte", "misiones" to "Mensaje de misiones", "podcast" to "Mensaje de podcast", "title" to "Título ES", "titleEn" to "Título EN", "description" to "Descripción ES", "descriptionEn" to "Descripción EN", "rewardTitle" to "Título del logro ES", "rewardTitleEn" to "Título del logro EN", "rewardDescription" to "Mensaje del logro ES", "rewardDescriptionEn" to "Mensaje del logro EN", "text" to "Reconocimiento", "signature" to "Firma institucional")[field.label] ?: field.label) }, enabled = enabled, modifier = Modifier.fillMaxWidth())
    }
}
