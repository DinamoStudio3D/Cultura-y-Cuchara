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
import androidx.compose.material.icons.filled.ZoomIn
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.platform.LocalConfiguration
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

internal fun placePhotos(place: Place): List<PlacePhoto> {
    val cover = place.imageUrl?.let { url -> place.photos.firstOrNull { it.url == url } ?: PlacePhoto(url) }
    return (listOfNotNull(cover) + place.photos).distinctBy { it.url }
}

@Composable
fun PlaceGallery(place: Place, heading: String? = null) {
    val photos = remember(place) { placePhotos(place) }
    if (photos.isEmpty()) return
    var selected by remember(place.id) { mutableStateOf<Int?>(null) }
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(heading ?: "Conoce el lugar · ${photos.size} ${if (photos.size == 1) "foto" else "fotos"}", style = MaterialTheme.typography.titleMedium)
        LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            itemsIndexed(photos, key = { _, photo -> photo.url }) { index, photo ->
                AsyncImage(model = BrandImagePolicy.model(photo.url), contentDescription = "Abrir fotografía ${index + 1} de ${place.title}",
                    contentScale = ContentScale.Fit, modifier = Modifier.size(112.dp, 88.dp).clip(RoundedCornerShape(14.dp)).background(MaterialTheme.colorScheme.surfaceVariant).clickable { selected = index },
                    placeholder = painterResource(R.drawable.visitaloja_logo), error = painterResource(R.drawable.visitaloja_logo))
            }
        }
        Text("Toca una fotografía para verla completa y desliza para seguir viendo.", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
    PlacePhotoViewer(place, photos, selected, false) { selected = null }
}

@Composable
fun PlacePhotoHeader(place: Place, english: Boolean, close: () -> Unit) {
    val photos = remember(place) { placePhotos(place) }
    var selected by remember(place.id) { mutableStateOf<Int?>(null) }
    val ratios = remember(place.id) { mutableStateMapOf<String, Float>() }
    val maximumHeight = (LocalConfiguration.current.screenHeightDp * .45f).coerceIn(220f, 420f)
    Column(Modifier.fillMaxWidth()) {
        Row(Modifier.fillMaxWidth().padding(start = 20.dp, end = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(PlacePresentationPolicy.category(place, english), modifier = Modifier.weight(1f), color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelLarge)
            IconButton(onClick = close) { Icon(Icons.Default.Close, if (english) "Close place details" else "Cerrar ficha") }
        }
        if (photos.isEmpty()) {
            androidx.compose.foundation.Image(painterResource(R.drawable.visitaloja_logo), place.title,
                Modifier.fillMaxWidth().height(200.dp).background(Color(0xFFF3F6FA)).padding(40.dp), contentScale = ContentScale.Fit)
        } else {
            val pager = rememberPagerState(pageCount = { photos.size })
            val index = pager.currentPage.coerceIn(photos.indices)
            BoxWithConstraints(Modifier.fillMaxWidth().background(Color(0xFFF3F6FA))) {
                val ratio = ratios[photos[index].url] ?: (4f / 3f)
                val height = (maxWidth.value / ratio).coerceIn(220f, maximumHeight).dp
                HorizontalPager(state = pager, modifier = Modifier.fillMaxWidth().height(height).testTag("place-photo-hero")) { page ->
                    val photo = photos[page]
                    AsyncImage(model = BrandImagePolicy.model(photo.url),
                        contentDescription = if (english) "Enlarge photo ${page + 1} of ${place.title}" else "Ampliar fotografía ${page + 1} de ${place.title}",
                        contentScale = ContentScale.Fit,
                        modifier = Modifier.fillMaxSize().clickable { selected = page },
                        onSuccess = { result ->
                            val drawable = result.result.drawable
                            if (drawable.intrinsicWidth > 0 && drawable.intrinsicHeight > 0) {
                                ratios[photo.url] = (drawable.intrinsicWidth.toFloat() / drawable.intrinsicHeight).coerceIn(.05f, 20f)
                            }
                        }, placeholder = painterResource(R.drawable.visitaloja_logo), error = painterResource(R.drawable.visitaloja_logo))
                }
            }
            Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("${index + 1} / ${photos.size}" + if (photos.size > 1) { if (english) " · Swipe to explore" else " · Desliza para explorar" } else "",
                    modifier = Modifier.weight(1f), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                TextButton(onClick = { selected = index }, modifier = Modifier.testTag("place-photo-expand")) {
                    Icon(Icons.Default.ZoomIn, null, Modifier.size(18.dp)); Spacer(Modifier.width(5.dp)); Text(if (english) "Enlarge" else "Ampliar")
                }
            }
            val photo = photos[index]
            if (photo.caption.isNotBlank()) Text(photo.caption, Modifier.padding(horizontal = 20.dp), style = MaterialTheme.typography.bodySmall)
            if (photo.credit.isNotBlank()) Text((if (english) "Photo: " else "Fotografía: ") + photo.credit, Modifier.padding(horizontal = 20.dp, vertical = 4.dp), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
    PlacePhotoViewer(place, photos, selected, english) { selected = null }
}

@Composable
private fun PlacePhotoViewer(place: Place, photos: List<PlacePhoto>, selected: Int?, english: Boolean, dismiss: () -> Unit) {
    if (selected != null && photos.isNotEmpty()) {
        val pager = rememberPagerState(initialPage = selected.coerceIn(photos.indices), pageCount = { photos.size })
        val current = pager.currentPage.coerceIn(photos.indices)
        val scope = rememberCoroutineScope()
        Dialog(onDismissRequest = { dismiss() }, properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
            Surface(color = Color(0xFF10243A), modifier = Modifier.fillMaxSize()) {
                Column(Modifier.fillMaxSize().systemBarsPadding().padding(12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("${current + 1} / ${photos.size} · ${place.title}", color = Color.White, modifier = Modifier.weight(1f).padding(start = 8.dp), maxLines = 2)
                        IconButton(onClick = { dismiss() }) { Icon(Icons.Default.Close, if (english) "Close photos" else "Cerrar fotografías", tint = Color.White) }
                    }
                    HorizontalPager(state = pager, modifier = Modifier.weight(1f).fillMaxWidth()) { index ->
                        AsyncImage(model = BrandImagePolicy.model(photos[index].url), contentDescription = photos[index].caption.ifBlank { "Fotografía de ${place.title}" },
                            contentScale = ContentScale.Fit, modifier = Modifier.fillMaxSize(), error = painterResource(R.drawable.visitaloja_logo), placeholder = painterResource(R.drawable.visitaloja_logo))
                    }
                    val photo = photos[current]
                    if (photo.caption.isNotBlank()) Text(photo.caption, color = Color.White, modifier = Modifier.padding(8.dp), fontSize = 13.sp)
                    if (photo.credit.isNotBlank()) Text((if (english) "Photo: " else "Fotografía: ") + photo.credit, color = Color(0xFFCCE1F6), modifier = Modifier.padding(8.dp), fontSize = 12.sp)
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        IconButton(onClick = { scope.launch { pager.animateScrollToPage(current - 1) } }, enabled = current > 0) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, if (english) "Previous photo" else "Fotografía anterior", tint = if (current > 0) Color.White else Color.Gray)
                        }
                        Text(if (english) "Swipe to change" else "Desliza para cambiar", color = Color(0xFFCCE1F6), modifier = Modifier.align(Alignment.CenterVertically), fontSize = 12.sp)
                        IconButton(onClick = { scope.launch { pager.animateScrollToPage(current + 1) } }, enabled = current < photos.lastIndex) {
                            Icon(Icons.AutoMirrored.Filled.ArrowForward, if (english) "Next photo" else "Fotografía siguiente", tint = if (current < photos.lastIndex) Color.White else Color.Gray)
                        }
                    }
                }
            }
        }
    }
}
