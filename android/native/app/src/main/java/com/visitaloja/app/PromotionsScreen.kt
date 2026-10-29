package com.visitaloja.app

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
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
private fun promotionClock(): Long {
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val now by produceState(System.currentTimeMillis(), lifecycle) {
        lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) { while (isActive) { value = System.currentTimeMillis(); delay(1000) } }
    }
    return now
}

@Composable
internal fun PromotionsScreen(state: PlacesState, refresh: () -> Unit, open: (Place) -> Unit) {
    var query by rememberSaveable { mutableStateOf("") }
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    LaunchedEffect(lifecycle) { lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) { while (isActive) { refresh(); delay(60_000) } } }
    val now = promotionClock()
    val fresh = !state.offline && state.error == null && !state.loading
    val result = PromotionPolicy.filter(state.places, query, now, fresh)
    LazyColumn(Modifier.fillMaxSize().testTag("promotions-screen"), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item {
            Surface(color = Color(0xFF0C3768), shape = RoundedCornerShape(24.dp)) {
                Column(Modifier.fillMaxWidth().padding(22.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Icon(Icons.Default.Redeem, null, tint = Color(0xFFFFD591), modifier = Modifier.size(34.dp))
                    Text("Promociones vigentes", color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = 26.sp)
                    Text("Descubre los beneficios disponibles ahora en los negocios de VisitaLoja.", color = Color(0xFFE2EFFF))
                }
            }
        }
        item { OutlinedTextField(query, { query = it }, modifier = Modifier.fillMaxWidth().testTag("promotions-search"), singleLine = true, label = { Text("Buscar promoción o negocio") }, leadingIcon = { Icon(Icons.Default.Search, null) }, trailingIcon = { if (query.isNotBlank()) IconButton(onClick = { query = "" }) { Icon(Icons.Default.Close, "Borrar búsqueda de promociones") } }, shape = RoundedCornerShape(16.dp)) }
        when {
            state.loading -> item { LinearProgressIndicator(Modifier.fillMaxWidth()); Text("Actualizando promociones…", modifier = Modifier.padding(top = 12.dp)) }
            !fresh -> item { Text("Conéctate para consultar las promociones vigentes. Su disponibilidad puede cambiar."); Button(onClick = refresh) { Text("Reintentar") } }
            result.isEmpty() -> item { Text(if (query.isBlank()) "No hay promociones vigentes por ahora." else "No hay promociones con esta búsqueda.", fontWeight = FontWeight.Bold); TextButton(onClick = if (query.isBlank()) refresh else ({ query = "" })) { Text(if (query.isBlank()) "Actualizar promociones" else "Ver todas las promociones") } }
            else -> {
                item { Text("${result.size} ${if (result.size == 1) "promoción disponible" else "promociones disponibles"}", fontWeight = FontWeight.Bold) }
                items(result, key = { it.id }) { place ->
                    Card(onClick = { if (PromotionPolicy.visible(place, System.currentTimeMillis(), fresh)) open(place) }, modifier = Modifier.fillMaxWidth().testTag("promotion-${place.id}"), shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
                        val image = place.promotion.image ?: place.imageUrl
                        if (image != null) AsyncImage(image, null, Modifier.fillMaxWidth().height(180.dp), contentScale = ContentScale.Crop)
                        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                            Text(place.title, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                            Text(place.promotion.title.ifBlank { "Promoción vigente" }, fontSize = 21.sp, fontWeight = FontWeight.Bold)
                            Text(place.promotion.description.ifBlank { "Consulta este beneficio especial en el negocio." })
                            Text(PromotionPolicy.validity(place.promotion), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text("Ver promoción y parada →", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                        }
                    }
                }
            }
        }
        item { Text("Confirma las condiciones con cada negocio. Estas ofertas son independientes de los sellos y recompensas de tu pasaporte.", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp) }
    }
}

@Composable
internal fun PlacePromotionEntry(place: Place, fresh: Boolean) {
    if (!fresh || !place.promotion.enabled) return
    val now = promotionClock()
    val context = LocalContext.current
    if (!PromotionPolicy.visible(place, now, fresh)) return
    val promo = place.promotion
    Surface(color = Color(0xFFFFF4DF), shape = RoundedCornerShape(16.dp), modifier = Modifier.fillMaxWidth().testTag("place-promotion")) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            Text("PROMOCIÓN DISPONIBLE", fontWeight = FontWeight.Bold, color = Color(0xFF8B4600), fontSize = 11.sp)
            Text(promo.title.ifBlank { "Promoción vigente" }, fontWeight = FontWeight.Bold, fontSize = 19.sp)
            Text(promo.description.ifBlank { "Consulta este beneficio especial en el negocio." })
            Text(PromotionPolicy.validity(promo), fontSize = 12.sp)
            if (promo.url != null) OutlinedButton(onClick = {
                if (PromotionPolicy.visible(place, System.currentTimeMillis(), fresh)) try { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(promo.url))) } catch (_: ActivityNotFoundException) { Toast.makeText(context, "No hay una aplicación compatible disponible.", Toast.LENGTH_LONG).show() }
            }) { Text(promo.button.ifBlank { "Conocer promoción" }); Spacer(Modifier.width(8.dp)); Icon(Icons.Default.OpenInNew, null, Modifier.size(16.dp)) }
        }
    }
}
