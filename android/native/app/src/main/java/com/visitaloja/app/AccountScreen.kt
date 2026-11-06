package com.visitaloja.app

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextAlign
import coil.compose.AsyncImage
import coil.decode.SvgDecoder
import coil.request.ImageRequest
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun AccountScreen(state: AccountState, guestFavourites: Set<String>, model: AccountViewModel, wallet: () -> Unit, notices: () -> Unit = {}, privacy: () -> Unit = {}, contact: () -> Unit = {}) {
    val context = LocalContext.current
    var email by rememberSaveable { mutableStateOf("") }
    // Passwords are deliberately excluded from saved instance state.
    var password by remember { mutableStateOf("") }
    var visible by remember { mutableStateOf(false) }
    var editingProfile by remember(state.uid) { mutableStateOf(false) }
    LaunchedEffect(state.profileRevision) { if (state.profileRevision > 0) editingProfile = false }
    var confirmImport by remember { mutableStateOf(false) }
    var confirmSignOut by remember { mutableStateOf(false) }
    LaunchedEffect(state.uid) { password = ""; confirmImport = false; confirmSignOut = false }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).imePadding().padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text("TU HISTORIA EN LOJA", fontSize = 11.sp, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
        Text("Mi cuenta", fontSize = 30.sp, fontWeight = FontWeight.ExtraBold)
        if (state.uid != null && editingProfile) {
            ProfileEditor(state.profile ?: ProfileDraft(name = state.name), state.busy, model::saveProfile, { editingProfile = false })
            if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
            state.message?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            return@Column
        }
        if (state.uid == null) {
            Surface(color = Color(0xFFF2F7FD), shape = RoundedCornerShape(22.dp)) {
                Row(Modifier.padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
                    Image(painterResource(R.drawable.visitaloja_logo), "VisitaLoja", Modifier.size(68.dp))
                    Column(Modifier.weight(1f).padding(start = 14.dp)) {
                        Text("La misma cuenta, donde vayas", fontSize = 18.sp, fontWeight = FontWeight.Bold)
                        Text("Ingresa como lo haces en la web para encontrar tus favoritos.", fontSize = 13.sp, modifier = Modifier.padding(top = 7.dp))
                    }
                }
            }
            Button(onClick = { model.googleLogin(context) }, enabled = !state.busy, modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp), shape = RoundedCornerShape(14.dp)) { Text("Continuar con Google") }
            Text("O ingresa con tu correo y contraseña", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            OutlinedTextField(email, { email = it }, label = { Text("Correo electrónico") }, singleLine = true, enabled = !state.busy,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email), modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp))
            OutlinedTextField(password, { password = it }, label = { Text("Contraseña") }, singleLine = true, enabled = !state.busy,
                visualTransformation = if (visible) VisualTransformation.None else PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password), modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp),
                trailingIcon = { IconButton(onClick = { visible = !visible }) { Icon(if (visible) Icons.Default.VisibilityOff else Icons.Default.Visibility, if (visible) "Ocultar contraseña" else "Mostrar contraseña") } })
            OutlinedButton(onClick = { val value = password; password = ""; model.emailLogin(email, value) }, enabled = !state.busy && email.isNotBlank() && password.isNotEmpty(), modifier = Modifier.fillMaxWidth().heightIn(min = 50.dp)) { Text("Ingresar con correo") }
            TextButton(onClick = { password = ""; model.resetPassword(email) }, enabled = !state.busy) { Text("Olvidé mi contraseña") }
            Text("Usa el mismo método de acceso que en VisitaLoja.com. Si tu cuenta es de Google, pulsa Continuar con Google.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        } else {
            AccountIdentity(state)
            Text(if (state.profileComplete) "Perfil completo para tus beneficios" else "Completa tu perfil para solicitar recompensas", fontWeight = FontWeight.Bold)
            Button(onClick = { editingProfile = true }, enabled = state.profileReady && !state.busy, modifier = Modifier.fillMaxWidth()) { Text(if (state.profileComplete) "Editar mis datos" else "Completar mi perfil") }
            Text("Tus favoritos, contigo", fontSize = 21.sp, fontWeight = FontWeight.Bold)
            Text(if (!state.favouritesReady) "Consultando tus favoritos…" else "${state.favourites.size} lugares guardados en tu cuenta. Los cambios se comparten con la web.", fontSize = 14.sp)
            if (state.fromCache) Text("Sin confirmación del servidor. Conéctate para consultar y cambiar tus favoritos.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (guestFavourites.isNotEmpty()) OutlinedButton(onClick = { confirmImport = true }, enabled = !state.busy && state.favouritesReady && !state.fromCache, modifier = Modifier.fillMaxWidth()) { Text("Añadir favoritos de este teléfono (${guestFavourites.size})") }
            OutlinedButton(onClick = wallet, modifier = Modifier.fillMaxWidth()) { Text("Ver mi pasaporte y mis tarjetas") }
            Text("Consulta tus sellos y recompensas en Pasaporte. Iniciar sesión no crea visitas ni modifica recompensas.", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (state.profileError != null) Text(state.profileError, color = MaterialTheme.colorScheme.error)
            if (state.favouritesError != null) Text(state.favouritesError, color = MaterialTheme.colorScheme.error)
            TextButton(onClick = model::retry, enabled = !state.busy) { Text("Actualizar mi información") }
            OutlinedButton(onClick = { confirmSignOut = true }, enabled = !state.busy, modifier = Modifier.fillMaxWidth()) { Text("Cerrar sesión") }
        }
        if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
        if (state.message != null) Surface(color = Color(0xFFF2F7FD), shape = RoundedCornerShape(12.dp)) { Text(state.message, modifier = Modifier.padding(16.dp), fontSize = 13.sp) }
        OutlinedButton(onClick = notices, modifier = Modifier.fillMaxWidth()) { Icon(Icons.Default.Notifications, null); Spacer(Modifier.width(8.dp)); Text("Avisos y notificaciones") }
        TextButton(onClick = privacy) { Text("Privacidad y uso de tus datos") }
        TextButton(onClick = contact) { Text("Contacto y redes de VisitaLoja") }
        Spacer(Modifier.height(12.dp))
    }
    if (confirmImport) AlertDialog(onDismissRequest = { confirmImport = false }, title = { Text("¿Añadir estos favoritos?") },
        text = { Text("Se añadirán los lugares guardados sin sesión en este teléfono a ${state.email}. Tus favoritos actuales se conservarán.") },
        confirmButton = { TextButton(onClick = { confirmImport = false; model.importGuest(guestFavourites) }) { Text("Añadir a mi cuenta") } },
        dismissButton = { TextButton(onClick = { confirmImport = false }) { Text("Cancelar") } })
    if (confirmSignOut) AlertDialog(onDismissRequest = { confirmSignOut = false }, title = { Text("¿Cerrar sesión?") },
        text = { Text("Tus favoritos seguirán en tu cuenta. En este teléfono se mostrarán los favoritos guardados sin sesión.") },
        confirmButton = { TextButton(onClick = { password = ""; confirmSignOut = false; model.signOut(context) }) { Text("Cerrar sesión") } },
        dismissButton = { TextButton(onClick = { confirmSignOut = false }) { Text("Cancelar") } })
}


@Composable
private fun AccountIdentity(state: AccountState) {
    val context = LocalContext.current
    val name = state.name.ifBlank { "Tu cuenta de VisitaLoja" }
    val initials = remember(state.name, state.email) {
        state.name.trim().split(Regex("\\s+")).filter(String::isNotBlank).take(2)
            .joinToString("") { it.take(1) }.ifBlank { state.email.take(1) }.uppercase().ifBlank { "VL" }
    }
    Surface(Modifier.fillMaxWidth(), color = MaterialTheme.colorScheme.primaryContainer, shape = RoundedCornerShape(26.dp)) {
        Column(Modifier.fillMaxWidth().padding(22.dp), horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Surface(Modifier.size(116.dp), shape = CircleShape, color = MaterialTheme.colorScheme.surface) {
                Box(Modifier.fillMaxSize().padding(5.dp).clip(CircleShape).background(MaterialTheme.colorScheme.primary),
                    contentAlignment = Alignment.Center) {
                    Text(initials, color = MaterialTheme.colorScheme.onPrimary, fontSize = 36.sp, fontWeight = FontWeight.Bold)
                    state.photoUrl?.let { url ->
                        val image = remember(context, url) {
                            ImageRequest.Builder(context).data(url).apply {
                                if (url.substringBefore('?').endsWith(".svg", ignoreCase = true))
                                    decoderFactory(SvgDecoder.Factory())
                            }.build()
                        }
                        AsyncImage(model = image, contentDescription = "Foto de perfil", modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Crop)
                    }
                }
            }
            Text(name, fontSize = 23.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.onPrimaryContainer)
            if (state.email.isNotBlank()) Text(state.email, fontSize = 14.sp, textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.onPrimaryContainer)
            if (state.city.isNotBlank()) Text(state.city, fontSize = 13.sp, textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.onPrimaryContainer)
            if (state.visitorType in setOf("lojano", "turista")) Text(
                if (state.visitorType == "lojano") "Modo lojano" else "Modo turista",
                color = MaterialTheme.colorScheme.onPrimaryContainer, fontWeight = FontWeight.Bold)
        }
    }
}
