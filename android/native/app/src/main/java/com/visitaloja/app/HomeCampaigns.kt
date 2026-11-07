package com.visitaloja.app

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.repeatOnLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive

/** Uses the same live schedule as the entry popup; never presents expired cached offers. */
@Composable
internal fun HomeCampaigns(state: PlacesState, open: (Place) -> Unit, all: () -> Unit, model: AnnouncementViewModel = viewModel()) {
    val announcements by model.state.collectAsStateWithLifecycle()
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val context = LocalContext.current
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(lifecycle) {
        lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            while (isActive) { now = System.currentTimeMillis(); delay(1000) }
        }
    }
    val announcement = AnnouncementPolicy.current(announcements, now)
    val fresh = !state.offline && state.error == null && !state.loading
    val promotions = PromotionPolicy.filter(state.places, "", now, fresh)
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        announcement?.let { item ->
            Card(Modifier.fillMaxWidth().padding(horizontal = 18.dp), shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = Color(0xFFEAF2FF))) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("ANUNCIO ESPECIAL", color = Color(0xFF173A70), style = MaterialTheme.typography.labelSmall)
                    item.image?.let { AsyncImage(it, item.title, Modifier.fillMaxWidth().heightIn(min = 120.dp, max = 240.dp), contentScale = ContentScale.Fit) }
                    Text(item.title, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleLarge)
                    if (item.description.isNotBlank()) Text(item.description)
                    item.contact?.let { link ->
                        OutlinedButton(onClick = {
                            if (AnnouncementPolicy.current(announcements, System.currentTimeMillis()) == item)
                                runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(link))) }
                        }) { Text("Consultar disponibilidad") }
                    }
                }
            }
        }
        if (promotions.isNotEmpty()) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 18.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Promociones vigentes", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                TextButton(onClick = all) { Text("Ver todas") }
            }
            LazyRow(contentPadding = PaddingValues(horizontal = 18.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                items(promotions.take(8), key = { it.id }) { place ->
                    Card(onClick = { if (PromotionPolicy.visible(place, System.currentTimeMillis(), fresh)) open(place) }, modifier = Modifier.width(268.dp), shape = RoundedCornerShape(20.dp)) {
                        (place.promotion.image ?: place.imageUrl)?.let { AsyncImage(it, null, Modifier.fillMaxWidth().height(132.dp), contentScale = ContentScale.Crop) }
                        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(place.title, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
                            Text(place.promotion.title.ifBlank { "Beneficio disponible" }, fontWeight = FontWeight.Bold, maxLines = 2)
                            Text(PromotionPolicy.validity(place.promotion), style = MaterialTheme.typography.bodySmall)
                            Text("Ver beneficio →", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}
