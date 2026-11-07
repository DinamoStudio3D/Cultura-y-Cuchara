package com.visitaloja.app

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive

@Composable
internal fun PlaceHours(info: PlaceInfo, fresh: Boolean) {
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val now by produceState(System.currentTimeMillis(), lifecycle) {
        lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            while (isActive) { value = System.currentTimeMillis(); delay(30_000) }
        }
    }
    val open = PlaceInfoPolicy.open(info, now, fresh)
    Surface(shape = RoundedCornerShape(16.dp), color = MaterialTheme.colorScheme.primaryContainer, modifier = Modifier.fillMaxWidth().testTag("place-hours")) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(Icons.Default.Schedule, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
                Text("Horario de atención", fontWeight = FontWeight.Bold)
            }
            val published = PlaceInfoPolicy.publishedHours(info)
            if (published.isNotBlank()) Text(published, fontSize = 14.sp)
            val range = PlaceInfoPolicy.range(info)
            if (range != null && range != published) Text(range, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
            Text(when (open) { true -> "Dentro del horario general"; false -> "Fuera del horario general"; null -> if (!fresh) "Horario guardado · Actualiza al conectarte" else if (published.isBlank()) "Horario por confirmar" else "Consulta el horario publicado" }, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
            Text("Hora de Ecuador. Confirma días y atención con el negocio.", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun PlaceServices(info: PlaceInfo) {
    val context = LocalContext.current
    val services = info.amenities.mapNotNull { PlaceInfoPolicy.amenities[it] }
    val payments = info.payments.mapNotNull { PlaceInfoPolicy.payments[it] }
    if (services.isNotEmpty() || payments.isNotEmpty() || info.priceRange.isNotBlank()) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth().testTag("place-services")) {
            Text("Servicios y formas de pago", fontWeight = FontWeight.Bold, fontSize = 18.sp)
            if (info.priceRange.isNotBlank()) Text("Rango de precios: ${info.priceRange}", fontSize = 13.sp)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                (services + payments).forEach { label ->
                    Surface(shape = RoundedCornerShape(10.dp), color = MaterialTheme.colorScheme.primaryContainer) {
                        Text(label, modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp), fontSize = 12.sp, color = MaterialTheme.colorScheme.onPrimaryContainer)
                    }
                }
            }
        }
    }
    if (info.links.isNotEmpty()) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth().testTag("place-socials")) {
            Text("Encuentra al negocio", fontWeight = FontWeight.Bold, fontSize = 18.sp)
            info.links.forEach { (kind, url) ->
                OutlinedButton(onClick = {
                    runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }.onFailure { Toast.makeText(context, "No hay una aplicación disponible para abrir el enlace.", Toast.LENGTH_SHORT).show() }
                }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(13.dp)) {
                    Icon(Icons.Default.OpenInNew, null, Modifier.size(18.dp)); Spacer(Modifier.width(8.dp)); Text(PlaceInfoPolicy.links[kind].orEmpty())
                }
            }
        }
    }
}

@Composable
internal fun CopyPlaceAddress(place: Place) {
    val context = LocalContext.current
    TextButton(onClick = {
        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(ClipData.newPlainText(place.title, place.address))
        Toast.makeText(context, "Dirección copiada", Toast.LENGTH_SHORT).show()
    }, modifier = Modifier.testTag("place-copy-address"), contentPadding = PaddingValues(0.dp)) {
        Icon(Icons.Default.ContentCopy, null, Modifier.size(16.dp)); Spacer(Modifier.width(7.dp)); Text("Copiar dirección")
    }
}
