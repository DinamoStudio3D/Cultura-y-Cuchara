package com.visitaloja.app

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp

@Composable
fun ProfileEditor(initial: ProfileDraft, busy: Boolean, save: (ProfileDraft) -> Unit, cancel: () -> Unit) {
    var draft by remember(initial) { mutableStateOf(initial) }
    var consent by remember { mutableStateOf(false) }
    val links = LocalUriHandler.current
    Text("Completa tus datos para validar y entregar tus recompensas.")
    OutlinedTextField(draft.name, { draft = draft.copy(name = it) }, label = { Text("Nombre completo") }, enabled = !busy, singleLine = true, modifier = Modifier.fillMaxWidth())
    OutlinedTextField(draft.phone, { draft = draft.copy(phone = it) }, label = { Text("Celular de Ecuador · 09…") }, enabled = !busy, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone), modifier = Modifier.fillMaxWidth())
    OutlinedTextField(draft.city, { draft = draft.copy(city = it) }, label = { Text("Ciudad") }, enabled = !busy, singleLine = true, modifier = Modifier.fillMaxWidth())
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        FilterChip(selected = draft.mode == "lojano", onClick = { draft = draft.copy(mode = "lojano", document = "") }, enabled = !busy, label = { Text("Lojano") })
        FilterChip(selected = draft.mode == "turista", onClick = { draft = draft.copy(mode = "turista", document = "") }, enabled = !busy, label = { Text("Turista") })
    }
    OutlinedTextField(draft.birth, { draft = draft.copy(birth = it) }, label = { Text("Nacimiento · AAAA-MM-DD") }, enabled = !busy, singleLine = true, modifier = Modifier.fillMaxWidth())
    OutlinedTextField(draft.document, { draft = draft.copy(document = it) }, label = { Text(if (draft.mode == "lojano") "Cédula" else "Pasaporte") }, enabled = !busy, singleLine = true, modifier = Modifier.fillMaxWidth())
    Row { Checkbox(checked = consent, onCheckedChange = { consent = it }, enabled = !busy); Text("Autorizo el uso de estos datos para mi cuenta y la validación de beneficios en VisitaLoja.", modifier = Modifier.weight(1f).padding(top = 10.dp)) }
    TextButton(onClick = { links.openUri("https://www.visitaloja.com/privacidad.html") }) { Text("Leer política de privacidad") }
    Button(onClick = { save(draft) }, enabled = !busy && consent, modifier = Modifier.fillMaxWidth()) { Text("Guardar mi perfil") }
    TextButton(onClick = cancel, enabled = !busy) { Text("Cancelar edición") }
}
