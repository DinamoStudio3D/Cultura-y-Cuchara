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
        AppSection("festival", "FIAVL 2026", "Programación del Festival de Artes Vivas", groups[0], Icons.Default.Event),
        AppSection("agenda", "Agenda", "Eventos y actividades por descubrir", groups[0], Icons.Default.Event),
        AppSection("cantons", "Cantones", "Recorre los 16 cantones de la provincia", groups[0], Icons.Default.Landscape),
        AppSection("stories", "Historias de Loja", "Relatos, sabores y tradición de nuestra tierra", groups[0], Icons.Default.AutoStories),
        AppSection("mesa", "Mesa Turística de Loja", "Institución, directiva, programación y proyectos", groups[2], Icons.Default.AccountBalance),
        AppSection("supporters", "Ellos hacen posible VisitaLoja", "Conoce los negocios y la institución que apoyan el proyecto", groups[2], Icons.Default.Handshake),
        AppSection("enterprises", "Emprendedores", "Conoce y apoya al talento local", groups[2], Icons.Default.Storefront),
        AppSection("photos", "Fotografías", "Miradas de Loja y sus autores", groups[0], Icons.Default.PhotoLibrary),
        AppSection("time", "Loja en el Tiempo", "Historia y fotografías de ayer y hoy", groups[0], Icons.Default.History),
        AppSection("videos", "Videos", "Conoce Loja en movimiento", groups[0], Icons.Default.PlayCircle),
        AppSection("podcast", "Podcast", "Historias y sonidos para escuchar", groups[0], Icons.Default.Headphones),
        AppSection("itinerary", "Mi ruta", "Prepara una propuesta o recorre tus favoritos", groups[1], Icons.Default.Route),
        AppSection("guide", "Habla con Chabaquito", "Tu compañero para elegir tu próxima parada", groups[1], Icons.Default.ChatBubbleOutline),
        AppSection("missions", "Misiones de Chabaquito", "Retos, insignias y tu aventura", groups[1], Icons.Default.EmojiEvents),
        AppSection("passport", "Pasaporte y fidelidad", "Consulta tus sellos y recompensas", groups[1], Icons.Default.MenuBook),
        AppSection("saved", "Favoritos", "Tus próximas paradas, siempre a mano", groups[1], Icons.Default.FavoriteBorder),
        AppSection("postcards", "Postales", "Crea y comparte un recuerdo de Loja", groups[2], Icons.Default.PhotoCamera),
        AppSection("shop", "Tienda", "Recuerdos de Loja y tu pedido", groups[2], Icons.Default.ShoppingBag),
        AppSection("notices", "Avisos", "Novedades y notificaciones opcionales", groups[2], Icons.Default.NotificationsActive),
        AppSection("contact", "Contacto y redes", "Ayuda, alianzas, privacidad y términos de VisitaLoja", groups[2], Icons.Default.SupportAgent),
        AppSection("account", "Mi cuenta", "Tu perfil y acceso a VisitaLoja", groups[2], Icons.Default.PersonOutline)
    )
    private val englishCopy = mapOf(
        "map" to ("Interactive map" to "Find places and your location in Loja"),
        "explore" to ("Places" to "Coffee, local food, lodging and tourism"),
        "promotions" to ("Offers" to "Current offers and business benefits"),
        "festival" to ("FIAVL 2026" to "Festival of Live Arts programme"),
        "agenda" to ("Events" to "Discover events and activities"),
        "cantons" to ("Cantons" to "Explore the province’s 16 cantons"),
        "stories" to ("Stories of Loja" to "Stories, flavours and traditions of our land"),
        "mesa" to ("Mesa Turística de Loja" to "Institution, board, programme and projects"),
        "supporters" to ("They make VisitaLoja possible" to "Meet the businesses and institution supporting the project"),
        "enterprises" to ("Entrepreneurs" to "Meet and support local talent"),
        "photos" to ("Photographs" to "Views of Loja and their photographers"),
        "time" to ("Loja Through Time" to "History and photographs of yesterday and today"),
        "videos" to ("Videos" to "See Loja in motion"),
        "podcast" to ("Podcast" to "Stories and sounds to listen to"),
        "itinerary" to ("My route" to "Plan a route or explore your saved places"),
        "guide" to ("Talk to Chabaquito" to "Your companion for choosing your next stop"),
        "missions" to ("Chabaquito missions" to "Challenges, badges and your adventure"),
        "passport" to ("Passport and loyalty" to "Check your stamps and rewards"),
        "saved" to ("Saved places" to "Your next stops, always at hand"),
        "postcards" to ("Postcards" to "Create and share a memory of Loja"),
        "shop" to ("Shop" to "Souvenirs of Loja and your order"),
        "notices" to ("Notices" to "News and optional notifications"),
        "contact" to ("Contact and social media" to "Help, partnerships, privacy and terms"),
        "account" to ("My account" to "Your profile and access to VisitaLoja")
    )
    fun localize(section: AppSection, english: Boolean): AppSection {
        val copy = englishCopy[section.route].takeIf { english } ?: return section
        return section.copy(title = copy.first, description = copy.second)
    }
    fun groupLabel(group: String, english: Boolean): String = if (!english) group else when (group) {
        "Descubrir" -> "Discover"
        "Tu aventura" -> "Your adventure"
        "Recuerdos y novedades" -> "Memories and news"
        else -> "All"
    }
    private fun key(value: String) = Normalizer.normalize(value, Normalizer.Form.NFD).replace(Regex("\\p{M}+"), "").lowercase(Locale.ROOT)
    fun filter(query: String, group: String, english: Boolean = false) = sections.filter { section ->
        (group == "Todas" || group == section.group) && key(query).trim().split(Regex("\\s+")).all { it in key("${section.title} ${section.description} ${section.group} ${localize(section, true).title} ${localize(section, true).description} ${groupLabel(section.group, true)}") }
    }.map { localize(it, english) }
    fun parent(route: String, fromSections: Boolean): String = when {
        route == "canton" -> "cantons"
        fromSections && route != "sections" && route != "home" -> "sections"
        else -> "home"
    }
}

@Composable
internal fun SectionsScreen(open: (String) -> Unit, openLink: (String) -> Unit, english: Boolean = false, changeLanguage: (Boolean) -> Unit = {}) {
    var query by rememberSaveable { mutableStateOf("") }
    var group by rememberSaveable { mutableStateOf("Todas") }
    val result = remember(query, group, english) { SectionsPolicy.filter(query, group, english) }
    val wide = LocalConfiguration.current.let { it.screenWidthDp >= 600 && it.fontScale <= 1.3f }
    val blue = MaterialTheme.colorScheme.primary
    LazyColumn(Modifier.fillMaxSize().testTag("sections-screen"), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            Surface(color = Color(0xFF0C3768), shape = RoundedCornerShape(24.dp)) {
                Row(Modifier.fillMaxWidth().padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(if (english) "ALL OF VISITALOJA" else "TODO VISITALOJA", color = Color(0xFFABDBFF), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        Text(if (english) "Loja, your way" else "Loja, a tu manera", color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.ExtraBold, lineHeight = 31.sp, modifier = Modifier.padding(top = 7.dp))
                        Text(if (english) "Choose what you want to discover today." else "Elige qué quieres descubrir hoy.", color = Color(0xFFE2EFFF), fontSize = 13.sp, modifier = Modifier.padding(top = 8.dp))
                    }
                    Image(painterResource(R.drawable.visitaloja_logo), null, Modifier.padding(start = 12.dp).size(70.dp))
                }
            }
        }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                TextButton(onClick = { changeLanguage(!english) }, modifier = Modifier.testTag("sections-language")) { Text(if (english) "Español" else "English") }
            }
        }
        item { NativeLinkEntry(openLink, english) }
        item {
            OutlinedTextField(value = query, onValueChange = { query = it }, modifier = Modifier.fillMaxWidth().testTag("sections-search"), singleLine = true,
                label = { Text(if (english) "Search sections" else "Buscar una sección") }, placeholder = { Text(if (english) "Videos, postcards, stamps…" else "Videos, postales, sellos…") },
                leadingIcon = { Icon(Icons.Default.Search, null) }, trailingIcon = { if (query.isNotBlank()) IconButton(onClick = { query = "" }) { Icon(Icons.Default.Close, if (english) "Clear section search" else "Borrar búsqueda de secciones") } },
                shape = RoundedCornerShape(16.dp), colors = OutlinedTextFieldDefaults.colors(unfocusedContainerColor = Color.White, focusedContainerColor = Color.White))
        }
        item {
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                (listOf("Todas") + SectionsPolicy.groups).forEach { choice ->
                    FilterChip(selected = group == choice, onClick = { group = choice }, label = { Text(SectionsPolicy.groupLabel(choice, english)) }, modifier = Modifier.testTag("sections-group-${SectionsPolicy.groups.indexOf(choice)}"))
                }
            }
        }
        if (result.isEmpty()) item {
            Column(Modifier.fillMaxWidth().padding(vertical = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(Icons.Default.Search, null, Modifier.size(36.dp), tint = blue)
                Text(if (english) "Let’s find another section" else "Busquemos otra sección", fontWeight = FontWeight.Bold, fontSize = 20.sp, modifier = Modifier.padding(top = 12.dp))
                Text(if (english) "Try photos, route or passport." else "Prueba con fotos, ruta o pasaporte.", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 6.dp))
                TextButton(onClick = { query = ""; group = "Todas" }, modifier = Modifier.testTag("sections-reset")) { Text(if (english) "View all sections" else "Ver todas las secciones") }
            }
        }
        SectionsPolicy.groups.forEach { sectionGroup ->
            val entries = result.filter { it.group == sectionGroup }
            if (entries.isNotEmpty()) {
                item(key = "heading-$sectionGroup") { Text(SectionsPolicy.groupLabel(sectionGroup, english), fontSize = 19.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 8.dp)) }
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
