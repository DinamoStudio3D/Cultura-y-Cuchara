package com.visitaloja.app

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@Composable
internal fun AdminDraftPicker(rows: List<LocalAdminDraft>, busy: Boolean, message: String?, close: () -> Unit,
    restore: (String) -> Unit, remove: (String) -> Unit) {
    var action by remember { mutableStateOf<Pair<LocalAdminDraft, Boolean>?>(null) }
    Dialog(onDismissRequest = { if (!busy) close() }) {
        Surface {
            LazyColumn(Modifier.fillMaxHeight(.85f).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                item {
                    Text("Borradores de tu cuenta", style = MaterialTheme.typography.titleLarge)
                    Text("Guardados en este teléfono. Recuperar no publica contenido. Eliminar la app o sus datos también elimina estos borradores.")
                    if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                    message?.let { Text(it) }
                    TextButton(onClick = close, enabled = !busy) { Text("Cerrar") }
                    if (rows.isEmpty() && !busy) Text("No hay borradores guardados de este módulo.")
                }
                items(rows, key = { it.id }) { row ->
                    OutlinedCard(Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(12.dp)) {
                            Text(row.title)
                            Text(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm").withZone(ZoneId.of("America/Guayaquil")).format(Instant.ofEpochMilli(row.savedAt)))
                            TextButton(onClick = { action = row to true }, enabled = !busy) { Text("Recuperar") }
                            TextButton(onClick = { action = row to false }, enabled = !busy) { Text("Eliminar borrador") }
                        }
                    }
                }
            }
        }
    }
    action?.let { (row, recovering) -> AlertDialog(onDismissRequest = { action = null }, title = { Text(if (recovering) "Recuperar borrador" else "Eliminar borrador local") },
        text = { Text(row.title + if (recovering) "\nReemplazará el formulario abierto, sin publicar. Revisa su contenido antes de guardar." else "\nSolo se borrará esta copia local. El contenido publicado se conserva.") },
        confirmButton = { TextButton(onClick = { action = null; if (recovering) restore(row.id) else remove(row.id) }) { Text("Confirmar") } },
        dismissButton = { TextButton(onClick = { action = null }) { Text("Cancelar") } }) }
}
