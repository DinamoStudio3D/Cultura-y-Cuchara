package com.visitaloja.app

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.text.Normalizer
import java.util.Locale

internal data class AppSection(val route: String, val title: String, val description: String, val group: String, val icon: ImageVector)
internal object SectionsPolicy {
    val groups = listOf("Descubrir", "Tu aventura", "Recuerdos y novedades")
    val sections = listOf(
        AppSection("map", "Mapa interactivo", "Encuentra paradas y ubícate en Loja", groups[0], Icons.Default.Map),
        AppSection("explore", "Paradas", "Cafeterías, sabores, hospedaje y turismo", groups[0], Icons.Default.Explore),
        AppSection("promotions", "Promociones", "Ofertas vigentes y beneficios de los negocios", groups[0], Icons.Default.Redeem),
        AppSection("agenda", "Agenda", "Eventos y actividades por descubrir", groups[0], Icons.Default.Event),
        AppSection("cantons", "Cantones", "Recorre los 16 cantones de la provincia", groups[0], Icons.Default.Landscape),
        AppSection("stories", "Historias de Loja", "Relatos, sabores y tradición de nuestra tierra", groups[0], Icons.Default.AutoStories),
        AppSection("supporters", "Ellos hacen posible VisitaLoja", "Conoce los negocios y la institución que apoyan el proyecto", groups[2], Icons.Default.Handshake),
        AppSection("enterprises", "Emprendedores", "Conoce y apoya al talento local", groups[2], Icons.Default.Storefront),
        AppSection("photos", "Fotografías", "Miradas de Loja y sus autores", groups[0], Icons.Default.PhotoLibrary),
        AppSection("time", "Loja en el Tiempo", "Historia y fotografías de ayer y hoy", groups[0], Icons.Default.History),
        AppSection("videos", "Videos", "Conoce Loja en movimiento", groups[0], Icons.Default.PlayCircle),
        AppSection("podcast", "Podcast", "Historias y sonidos para escuchar", groups[0], Icons.Default.Headphones),
        AppSection("itinerary", "Mi ruta", "Organiza el recorrido de tus favoritos", groups[1], Icons.Default.Route),
        AppSection("missions", "Chabaquito", "Retos, insignias y tu aventura", groups[1], Icons.Default.EmojiEvents),
        AppSection("passport", "Pasaporte y fidelidad", "Consulta tus sellos y recompensas", groups[1], Icons.Default.MenuBook),
        AppSection("saved", "Favoritos", "Tus próximas paradas, siempre a mano", groups[1], Icons.Default.FavoriteBorder),
        AppSection("postcards", "Postales", "Crea y comparte un recuerdo de Loja", groups[2], Icons.Default.PhotoCamera),
        AppSection("shop", "Tienda", "Recuerdos de Loja y tu pedido", groups[2], Icons.Default.ShoppingBag),
        AppSection("notices", "Avisos", "Novedades y notificaciones opcionales", groups[2], Icons.Default.NotificationsActive),
        AppSection("account", "Mi cuenta", "Tu perfil y acceso a VisitaLoja", groups[2], Icons.Default.PersonOutline)
    )
    private fun key(value: String) = Normalizer.normalize(value, Normalizer.Form.NFD).replace(Regex("\\p{M}+"), "").lowercase(Locale.ROOT)
    fun filter(query: String, group: String) = sections.filter { section ->
        (group == "Todas" || group == section.group) && key(query).trim().split(Regex("\\s+")).all { it in key("${section.title} ${section.description} ${section.group}") }
    }
    fun parent(route: String, fromSections: Boolean): String = when {
        route == "canton" -> "cantons"
        fromSections && route != "sections" && route != "home" -> "sections"
        else -> "home"
    }
}

@Composable
internal fun SectionsScreen(open: (String) -> Unit, openLink: (String) -> Unit) {
    var query by rememberSaveable { mutableStateOf("") }
    var group by rememberSaveable { mutableStateOf("Todas") }
    val result = remember(query, group) { SectionsPolicy.filter(query, group) }
    val wide = LocalConfiguration.current.let { it.screenWidthDp >= 600 && it.fontScale <= 1.3f }
    val blue = MaterialTheme.colorScheme.primary
    LazyColumn(Modifier.fillMaxSize().testTag("sections-screen"), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            Surface(color = Color(0xFF0C3768), shape = RoundedCornerShape(24.dp)) {
                Row(Modifier.fillMaxWidth().padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("TODO VISITALOJA", color = Color(0xFFABDBFF), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        Text("Loja, a tu manera", color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.ExtraBold, lineHeight = 31.sp, modifier = Modifier.padding(top = 7.dp))
                        Text("Elige qué quieres descubrir hoy.", color = Color(0xFFE2EFFF), fontSize = 13.sp, modifier = Modifier.padding(top = 8.dp))
                    }
                    Image(painterResource(R.drawable.visitaloja_logo), null, Modifier.padding(start = 12.dp).size(70.dp))
                }
            }
        }
        item { NativeLinkEntry(openLink) }
        item {
            OutlinedTextField(value = query, onValueChange = { query = it }, modifier = Modifier.fillMaxWidth().testTag("sections-search"), singleLine = true,
                label = { Text("Buscar una sección") }, placeholder = { Text("Videos, postales, sellos…") },
                leadingIcon = { Icon(Icons.Default.Search, null) }, trailingIcon = { if (query.isNotBlank()) IconButton(onClick = { query = "" }) { Icon(Icons.Default.Close, "Borrar búsqueda de secciones") } },
                shape = RoundedCornerShape(16.dp), colors = OutlinedTextFieldDefaults.colors(unfocusedContainerColor = Color.White, focusedContainerColor = Color.White))
        }
        item {
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                (listOf("Todas") + SectionsPolicy.groups).forEach { choice ->
                    FilterChip(selected = group == choice, onClick = { group = choice }, label = { Text(choice) }, modifier = Modifier.testTag("sections-group-${SectionsPolicy.groups.indexOf(choice)}"))
                }
            }
        }
        if (result.isEmpty()) item {
            Column(Modifier.fillMaxWidth().padding(vertical = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(Icons.Default.Search, null, Modifier.size(36.dp), tint = blue)
                Text("Busquemos otra sección", fontWeight = FontWeight.Bold, fontSize = 20.sp, modifier = Modifier.padding(top = 12.dp))
                Text("Prueba con fotos, ruta o pasaporte.", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 6.dp))
                TextButton(onClick = { query = ""; group = "Todas" }, modifier = Modifier.testTag("sections-reset")) { Text("Ver todas las secciones") }
            }
        }
        SectionsPolicy.groups.forEach { sectionGroup ->
            val entries = result.filter { it.group == sectionGroup }
            if (entries.isNotEmpty()) {
                item(key = "heading-$sectionGroup") { Text(sectionGroup, fontSize = 19.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 8.dp)) }
                items(entries.chunked(if (wide) 2 else 1), key = { it.first().route }) { row ->
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        row.forEach { section -> SectionTile(section, Modifier.weight(1f)) { open(section.route) } }
                        if (wide && row.size == 1) Spacer(Modifier.weight(1f))
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionTile(section: AppSection, modifier: Modifier, open: () -> Unit) {
    Surface(onClick = open, modifier = modifier.testTag("section-${section.route}"), shape = RoundedCornerShape(18.dp), color = Color.White, tonalElevation = 1.dp) {
        Row(Modifier.fillMaxWidth().heightIn(min = 92.dp).padding(16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(13.dp)) {
            Surface(shape = RoundedCornerShape(14.dp), color = MaterialTheme.colorScheme.primaryContainer) {
                Box(Modifier.size(44.dp), contentAlignment = Alignment.Center) { Icon(section.icon, null, tint = MaterialTheme.colorScheme.primary) }
            }
            Column(Modifier.weight(1f)) {
                Text(section.title, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                Text(section.description, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 4.dp), lineHeight = 17.sp)
            }
            Icon(Icons.AutoMirrored.Filled.ArrowForward, null, Modifier.size(18.dp), tint = MaterialTheme.colorScheme.primary)
        }
    }
}
