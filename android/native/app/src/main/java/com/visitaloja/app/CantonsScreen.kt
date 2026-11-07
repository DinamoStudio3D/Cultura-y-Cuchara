package com.visitaloja.app

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage

@Composable
fun CantonsShortcut(open: () -> Unit, blocks: HomeBlocks = HomeBlocks(), english: Boolean = false) {
    OutlinedCard(onClick = open, shape = RoundedCornerShape(22.dp), modifier = Modifier.fillMaxWidth().padding(horizontal = 22.dp),
        colors = CardDefaults.outlinedCardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
        Row(Modifier.padding(20.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            Icon(Icons.Default.Landscape, null, Modifier.size(38.dp), tint = MaterialTheme.colorScheme.primary)
            Column(Modifier.weight(1f)) {
                Text(blocks.text("provinceGateway", "kicker", english, if (english) "MORE LOJA TO DISCOVER" else "MÁS LOJA POR DESCUBRIR"), fontSize = 10.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                Text(blocks.text("provinceGateway", "title", english, if (english) "16 cantons, new stories" else "16 cantones, nuevas historias"), fontSize = 20.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 5.dp))
                Text(blocks.text("provinceGateway", "description", english, if (english) "Landscapes, culture and stops for your next visit." else "Paisajes, cultura y paradas para tu próxima visita."), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 7.dp))
                Text(blocks.text("provinceGateway", "button", english, if (english) "Explore the cantons" else "Descubrir los cantones"), fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 8.dp))
            }
        }
    }
}

@Composable
fun CantonsScreen(state: CantonsState, directory: PlacesState, select: (String) -> Unit, retry: () -> Unit) {
    var query by rememberSaveable { mutableStateOf("") }
    val cantons = CantonPolicy.search(query)
    LazyVerticalGrid(columns = GridCells.Adaptive(150.dp), contentPadding = PaddingValues(22.dp), verticalArrangement = Arrangement.spacedBy(14.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        item(span = { GridItemSpan(maxLineSpan) }) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("UN DESTINO, MUCHAS HISTORIAS", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                Text("Descubre los cantones", fontSize = 29.sp, fontWeight = FontWeight.ExtraBold)
                Text("Elige un destino y conoce sus lugares, sabores y tradiciones.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                OutlinedTextField(value = query, onValueChange = { query = it }, label = { Text("Buscar cantón") }, singleLine = true, modifier = Modifier.fillMaxWidth(),
                    leadingIcon = { Icon(Icons.Default.Search, null) }, trailingIcon = { if (query.isNotBlank()) IconButton(onClick = { query = "" }) { Icon(Icons.Default.Close, "Borrar búsqueda") } }, shape = RoundedCornerShape(16.dp))
                if (state.loading) LinearProgressIndicator(Modifier.fillMaxWidth())
                if (state.error || state.cached || directory.offline) Text("Parte de la información no se ha confirmado. Actualiza antes de organizar tu visita.", fontSize = 12.sp, color = MaterialTheme.colorScheme.error)
                if (state.error || directory.error != null) TextButton(onClick = retry) { Text("Reintentar consulta") }
                Text("${cantons.size} cantones para explorar", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
        items(cantons, key = Canton::id) { canton ->
            val guide = state.guides[canton.id] ?: CantonGuide()
            val places = CantonPolicy.places(canton.id, directory.places)
            val photo = guide.cover ?: places.firstNotNullOfOrNull { it.imageUrl }
            OutlinedCard(onClick = { select(canton.id) }, shape = RoundedCornerShape(22.dp)) {
                if (photo != null) AsyncImage(model = photo, contentDescription = canton.name, modifier = Modifier.fillMaxWidth().height(135.dp), contentScale = ContentScale.Crop, placeholder = painterResource(R.drawable.visitaloja_logo), error = painterResource(R.drawable.visitaloja_logo))
                else Surface(color = MaterialTheme.colorScheme.primaryContainer) { Box(Modifier.fillMaxWidth().height(135.dp), contentAlignment = Alignment.Center) { Icon(Icons.Default.Landscape, null, Modifier.size(52.dp), tint = MaterialTheme.colorScheme.primary) } }
                Column(Modifier.padding(15.dp).fillMaxWidth().heightIn(min = 125.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                    Text(canton.name, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                    Text(guide.tagline.ifBlank { "Conoce este destino de Loja." }, fontSize = 12.sp, maxLines = 2, overflow = TextOverflow.Ellipsis, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(if (directory.loading) "Consultando paradas…" else if (directory.error != null) "Paradas por actualizar" else "${places.size} paradas publicadas", fontSize = 11.sp, color = MaterialTheme.colorScheme.primary)
                    Text("Explorar cantón →", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                }
            }
        }
        if (cantons.isEmpty()) item(span = { GridItemSpan(maxLineSpan) }) { Text("No encontramos un cantón con ese nombre. Prueba otra búsqueda.") }
    }
}

@Composable
fun CantonDetailScreen(canton: Canton, state: CantonsState, directory: PlacesState, back: () -> Unit, detail: (Place) -> Unit, retry: () -> Unit) {
    var query by rememberSaveable(canton.id) { mutableStateOf("") }
    var category by rememberSaveable(canton.id) { mutableStateOf("all") }
    val guide = state.guides[canton.id] ?: CantonGuide()
    val places = CantonPolicy.places(canton.id, directory.places, guide, query, category)
    val routes = guide.routes.map { it to CantonPolicy.routeStops(canton.id, it, directory.places) }.filter { it.second.isNotEmpty() }
    val context = LocalContext.current
    fun open(intent: Intent) { try { context.startActivity(intent) } catch (_: ActivityNotFoundException) { Toast.makeText(context, "No hay una aplicación compatible disponible.", Toast.LENGTH_LONG).show() } }
    LazyColumn(contentPadding = PaddingValues(22.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        item { TextButton(onClick = back) { Text("← Todos los cantones") }; Text(canton.name, fontSize = 32.sp, fontWeight = FontWeight.ExtraBold); if (guide.tagline.isNotBlank()) Text(guide.tagline, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp)) }
        if (state.loading) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
        if (state.error || state.cached || directory.offline) item { Text("Actualiza para confirmar los datos de tu visita.", color = MaterialTheme.colorScheme.error, fontSize = 12.sp) }
        if (guide.cover != null) item { Column { AsyncImage(model = guide.cover, contentDescription = "${canton.name}, Loja", modifier = Modifier.fillMaxWidth().height(230.dp), contentScale = ContentScale.Fit, error = painterResource(R.drawable.visitaloja_logo)); if (guide.credit.isNotBlank()) Text("Fotografía: ${guide.credit}", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) } }
        if (guide.description.isNotBlank()) item { Text(guide.description, lineHeight = 24.sp) }
        if (guide.highlights.isNotBlank()) item { CantonInfo("Lo que hace especial a ${canton.name}", guide.highlights) }
        items(guide.sections) { (title, body) -> CantonInfo(title, body) }
        if (routes.isNotEmpty()) item {
            Text("Rutas recomendadas en ${canton.name}", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Text("Recorridos publicados por VisitaLoja. Las duraciones son orientativas; confirma horarios antes de salir.", style = MaterialTheme.typography.bodySmall)
        }
        items(routes, key = { "canton-route-${it.first.id}" }) { (route, stops) ->
            OutlinedCard(shape = RoundedCornerShape(22.dp)) {
                Column(Modifier.fillMaxWidth().padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("RUTA RECOMENDADA · ${stops.size} PARADAS", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                    Text(route.title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    if (route.duration.isNotBlank()) Text("Duración orientativa: ${route.duration}")
                    if (route.notes.isNotBlank()) Text(route.notes)
                    stops.forEachIndexed { index, place ->
                        HorizontalDivider()
                        Text("${index + 1}. ${place.title}", fontWeight = FontWeight.SemiBold)
                        if (place.address.isNotBlank()) Text(place.address, style = MaterialTheme.typography.bodySmall)
                        TextButton(onClick = { detail(place) }) { Text("Conocer esta parada") }
                        CantonPolicy.directions(place)?.let { url ->
                            TextButton(onClick = { open(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }) { Text("Cómo llegar a esta parada") }
                        }
                    }
                    OutlinedButton(onClick = {
                        val text = "${route.title} · ${canton.name}\n" + (if (route.duration.isBlank()) "" else "Duración orientativa: ${route.duration}\n") +
                            stops.mapIndexed { index, place -> "${index + 1}. ${place.title}" }.joinToString("\n") + "\nhttps://www.visitaloja.com/canton/${canton.id}#cantonRoutesSection"
                        open(Intent.createChooser(Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_TEXT, text) }, "Compartir ruta"))
                    }) { Text("Compartir esta ruta") }
                }
            }
        }
        item { Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedButton(onClick = { open(Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=" + Uri.encode("${canton.name}, Loja, Ecuador")))) }, modifier = Modifier.weight(1f)) { Text("Ubicar cantón") }
            OutlinedButton(onClick = { val send = Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_TEXT, "Descubre ${canton.name} en VisitaLoja\nhttps://www.visitaloja.com/canton/${canton.id}") }; open(Intent.createChooser(send, "Compartir cantón")) }, modifier = Modifier.weight(1f)) { Text("Compartir") }
        } }
        item {
            Text("Paradas en ${canton.name}", fontSize = 23.sp, fontWeight = FontWeight.Bold)
            OutlinedTextField(value = query, onValueChange = { query = it }, label = { Text("Buscar una parada") }, singleLine = true, leadingIcon = { Icon(Icons.Default.Search, null) }, modifier = Modifier.fillMaxWidth().padding(top = 12.dp), shape = RoundedCornerShape(16.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) { listOf("all" to "Todo", "hotel" to "Hospedaje", "food" to "Sabores").forEach { (id, label) -> FilterChip(selected = category == id, onClick = { category = id }, label = { Text(label) }) } }
        }
        if (directory.loading) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
        else if (directory.error != null) item { Text("No pudimos actualizar las paradas de este cantón."); TextButton(onClick = retry) { Text("Reintentar") } }
        if (places.isEmpty() && !directory.loading && directory.error == null) item { Text(if (query.isNotBlank() || category != "all") "No hay paradas con estos filtros." else "Todavía no hay paradas publicadas para este cantón.", color = MaterialTheme.colorScheme.onSurfaceVariant); if (query.isNotBlank() || category != "all") TextButton(onClick = { query = ""; category = "all" }) { Text("Ver todas las paradas") } }
        items(places, key = Place::id) { place -> OutlinedCard(onClick = { detail(place) }, shape = RoundedCornerShape(20.dp)) {
            if (place.imageUrl != null) AsyncImage(model = BrandImagePolicy.model(place.imageUrl), contentDescription = place.title, modifier = Modifier.fillMaxWidth().height(160.dp), contentScale = if (BrandImagePolicy.localLogo(place.imageUrl) != null) ContentScale.Fit else ContentScale.Crop, error = painterResource(R.drawable.visitaloja_logo))
            Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { Text(place.title, fontSize = 20.sp, fontWeight = FontWeight.Bold); Text(place.categoryLabel, fontSize = 12.sp, color = MaterialTheme.colorScheme.primary); if (place.id in guide.featured) Text("Recomendado", fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.primary); if (place.address.isNotBlank()) Text(place.address, fontSize = 13.sp); Text("Ver ficha →", color = MaterialTheme.colorScheme.primary) }
        } }
        item { TextButton(onClick = retry) { Text("Actualizar guía y paradas") } }
    }
}

@Composable
private fun CantonInfo(title: String, body: String) {
    OutlinedCard(shape = RoundedCornerShape(20.dp)) { Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) { Text(title, fontSize = 19.sp, fontWeight = FontWeight.Bold); Text(body, fontSize = 14.sp, lineHeight = 23.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) } }
}
