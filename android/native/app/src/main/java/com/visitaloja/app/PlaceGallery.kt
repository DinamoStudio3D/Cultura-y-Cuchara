package com.visitaloja.app

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import kotlinx.coroutines.launch

@Composable
fun PlaceGallery(place: Place) {
    val photos = remember(place) {
        val all = place.photos.toMutableList()
        if (place.imageUrl != null && all.none { it.url == place.imageUrl }) all.add(0, PlacePhoto(place.imageUrl))
        all.distinctBy { it.url }
    }
    if (photos.isEmpty()) return
    var selected by remember(place.id) { mutableStateOf<Int?>(null) }
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Conoce el lugar · ${photos.size} ${if (photos.size == 1) "foto" else "fotos"}", style = MaterialTheme.typography.titleMedium)
        LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            itemsIndexed(photos, key = { _, photo -> photo.url }) { index, photo ->
                AsyncImage(model = if (photo.url == "https://i.imgur.com/CpCnMpw.png") R.drawable.codeproim_logo else photo.url, contentDescription = "Abrir fotografía ${index + 1} de ${place.title}",
                    contentScale = ContentScale.Crop, modifier = Modifier.size(112.dp, 88.dp).clip(RoundedCornerShape(14.dp)).background(MaterialTheme.colorScheme.surfaceVariant).clickable { selected = index },
                    placeholder = painterResource(R.drawable.visitaloja_logo), error = painterResource(R.drawable.visitaloja_logo))
            }
        }
        Text("Toca una fotografía para verla completa y desliza para seguir viendo.", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
    if (selected != null) {
        val pager = rememberPagerState(initialPage = selected!!.coerceIn(photos.indices), pageCount = { photos.size })
        val scope = rememberCoroutineScope()
        Dialog(onDismissRequest = { selected = null }, properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
            Surface(color = Color(0xFF10243A), modifier = Modifier.fillMaxSize()) {
                Column(Modifier.fillMaxSize().systemBarsPadding().padding(12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("${pager.currentPage + 1} / ${photos.size} · ${place.title}", color = Color.White, modifier = Modifier.weight(1f).padding(start = 8.dp), maxLines = 2)
                        IconButton(onClick = { selected = null }) { Icon(Icons.Default.Close, "Cerrar fotografías", tint = Color.White) }
                    }
                    HorizontalPager(state = pager, modifier = Modifier.weight(1f).fillMaxWidth()) { index ->
                        AsyncImage(model = if (photos[index].url == "https://i.imgur.com/CpCnMpw.png") R.drawable.codeproim_logo else photos[index].url, contentDescription = photos[index].caption.ifBlank { "Fotografía de ${place.title}" },
                            contentScale = ContentScale.Fit, modifier = Modifier.fillMaxSize(), error = painterResource(R.drawable.visitaloja_logo), placeholder = painterResource(R.drawable.visitaloja_logo))
                    }
                    val photo = photos[pager.currentPage]
                    if (photo.caption.isNotBlank()) Text(photo.caption, color = Color.White, modifier = Modifier.padding(8.dp), fontSize = 13.sp)
                    if (photo.credit.isNotBlank()) Text("Fotografía: ${photo.credit}", color = Color(0xFFCCE1F6), modifier = Modifier.padding(8.dp), fontSize = 12.sp)
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        IconButton(onClick = { scope.launch { pager.animateScrollToPage(pager.currentPage - 1) } }, enabled = pager.currentPage > 0) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, "Fotografía anterior", tint = if (pager.currentPage > 0) Color.White else Color.Gray)
                        }
                        Text("Desliza para cambiar", color = Color(0xFFCCE1F6), modifier = Modifier.align(Alignment.CenterVertically), fontSize = 12.sp)
                        IconButton(onClick = { scope.launch { pager.animateScrollToPage(pager.currentPage + 1) } }, enabled = pager.currentPage < photos.lastIndex) {
                            Icon(Icons.AutoMirrored.Filled.ArrowForward, "Fotografía siguiente", tint = if (pager.currentPage < photos.lastIndex) Color.White else Color.Gray)
                        }
                    }
                }
            }
        }
    }
}
