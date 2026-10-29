package com.visitaloja.app

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Link
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp

@Composable
internal fun NativeLinkEntry(open: (String) -> Unit) {
    var dialog by rememberSaveable { mutableStateOf(false) }
    var text by rememberSaveable { mutableStateOf("") }
    var error by rememberSaveable { mutableStateOf(false) }
    OutlinedButton(onClick = { dialog = true }, modifier = Modifier.fillMaxWidth().testTag("open-link"), shape = RoundedCornerShape(16.dp)) { Icon(Icons.Default.Link, null); Spacer(Modifier.width(8.dp)); Text("Abrir enlace de VisitaLoja") }
    if (dialog) AlertDialog(onDismissRequest = { dialog = false }, title = { Text("Abre lo que te compartieron") }, text = {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Pega un enlace de una parada o sección de visitaloja.com. También puedes compartirlo con VisitaLoja desde otra aplicación.")
            OutlinedTextField(text, { text = it.take(4096); error = false }, modifier = Modifier.fillMaxWidth().testTag("native-link-input"), label = { Text("Enlace de VisitaLoja") }, maxLines = 4, isError = error)
            if (error) Text("Usa un solo enlace HTTPS de una parada o sección compatible de VisitaLoja.", color = MaterialTheme.colorScheme.error, modifier = Modifier.testTag("native-link-invalid"))
        }
    }, confirmButton = { TextButton(onClick = { if (NativeLinkPolicy.shared(text) == null) error = true else { dialog = false; open(text); text = ""; error = false } }, modifier = Modifier.testTag("native-link-confirm")) { Text("Abrir en la app") } }, dismissButton = { TextButton(onClick = { dialog = false }) { Text("Cancelar") } })
}
