package com.visitaloja.app

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray

internal data class OfficialSystemLink(val title: String, val path: String, val audience: String, val description: String) {
    val url: String get() = "https://www.visitaloja.com$path"
}
/** Public URLs only. This directory never embeds a visit token, claim code or session. */
internal object OfficialSystemLinkPolicy {
    fun path(value: String): Boolean = Regex("^/(?:[a-z0-9-]+\\.html)?$").matches(value)
}
@Composable
internal fun AdminSystemLinksEntry(uid: String) {
    val context = LocalContext.current
    var open by remember(uid) { mutableStateOf(false) }; var query by remember(uid) { mutableStateOf("") }
    var rows by remember(uid) { mutableStateOf<List<OfficialSystemLink>>(emptyList()) }; var message by remember(uid) { mutableStateOf<String?>(null) }
    LaunchedEffect(uid, open) {
        if (!open) return@LaunchedEffect
        rows = emptyList(); message = null
        try {
            rows = withContext(Dispatchers.IO) {
                context.assets.open("admin-system-links.json").bufferedReader().use { reader ->
                    val data = JSONArray(reader.readText()); require(data.length() <= 50)
                    (0 until data.length()).map { index -> val row = data.getJSONObject(index); val path = row.getString("path")
                        require(OfficialSystemLinkPolicy.path(path)); OfficialSystemLink(row.getString("title"), path, row.getString("audience"), row.getString("description"))
                    }
                }
            }
        } catch (e: CancellationException) { throw e }
        catch (_: Exception) { message = "No se pudo abrir el directorio de enlaces de esta versión." }
    }
    fun feedback(text: String) { Toast.makeText(context, text, Toast.LENGTH_SHORT).show() }
    OutlinedButton(onClick = { if (FirebaseAuth.getInstance().currentUser?.uid == uid) open = true else feedback("Vuelve a iniciar sesión.") }) { Text("Enlaces oficiales del sistema") }
    if (open) Dialog(onDismissRequest = { open = false }, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxSize().systemBarsPadding()) { LazyColumn(Modifier.fillMaxSize().imePadding(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item {
                Text("Enlaces oficiales del sistema", style = MaterialTheme.typography.headlineSmall)
                TextButton(onClick = { open = false }) { Text("Cerrar") }
                Text("Direcciones de la web oficial. Revisa el destinatario antes de copiar: los paneles protegidos requieren una cuenta autorizada; compartir su dirección no concede permisos.")
                Text("Los QR y códigos seguros de visitas se generan para cada parada o visita. No tienen un enlace fijo que pueda sustituirse por estas direcciones.")
                OutlinedTextField(query, { query = it.take(150) }, label = { Text("Buscar acceso o destinatario") }, modifier = Modifier.fillMaxWidth())
                message?.let { Text(it) }
            }
            val matches = rows.filter { PlacePolicy.normalize(it.title + " " + it.audience + " " + it.description).contains(PlacePolicy.normalize(query)) }
            if (rows.isNotEmpty() && matches.isEmpty()) item { Text("No hay enlaces que coincidan.") }
            items(matches, key = { it.path }) { row ->
                OutlinedCard(Modifier.fillMaxWidth()) { Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(row.title, style = MaterialTheme.typography.titleMedium); Text(row.audience, style = MaterialTheme.typography.labelLarge)
                    Text(row.description); Text(row.url, style = MaterialTheme.typography.bodySmall)
                    Row {
                        TextButton(onClick = { runCatching { (context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText(row.title, row.url)) }.onSuccess { feedback("Enlace copiado") }.onFailure { feedback("No se pudo copiar el enlace.") } }) { Text("Copiar dirección") }
                        TextButton(onClick = { runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(row.url))) }.onFailure { feedback("No se pudo abrir el enlace.") } }) { Text("Abrir enlace web") }
                    }
                } }
            }
        } }
    }
}
