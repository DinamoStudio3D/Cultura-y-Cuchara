package com.visitaloja.app

import android.app.Application
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseAuthUserCollisionException
import com.google.firebase.firestore.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

internal data class CreatedBusinessAccount(val uid: String, val email: String, val name: String)
internal data class AdminAccountCreationState(val actor: String = "", val busy: Boolean = false,
    val pending: CreatedBusinessAccount? = null, val message: String? = null, val complete: Boolean = false)

internal class AdminAccountCreationViewModel(app: Application) : AndroidViewModel(app) {
    private val auth = FirebaseAuth.getInstance()
    private val db = FirebaseFirestore.getInstance()
    private val mutable = MutableStateFlow(AdminAccountCreationState())
    val state = mutable.asStateFlow()
    private suspend fun authorize(actor: String) {
        val user = auth.currentUser?.takeIf { it.uid == actor } ?: error("La sesión cambió.")
        val claims = user.getIdToken(true).await().claims
        check(AdminPlacePolicy.allowed(user.email, claims, emptyMap()) ||
            AdminPlacePolicy.allowed(user.email, claims, db.collection("adminUsers").document(actor).get(Source.SERVER).await().data.orEmpty())) {
            "Necesitas administración general para crear cuentas."
        }
    }
    fun begin(actor: String) {
        val old = mutable.value
        if (!old.busy && old.pending == null) mutable.value = AdminAccountCreationState(actor)
    }
    fun create(actor: String, name: String, email: String, password: String) {
        if (mutable.value.busy || mutable.value.pending != null) return
        mutable.value = AdminAccountCreationState(actor, busy = true)
        viewModelScope.launch {
            var secondary: FirebaseApp? = null
            var secondaryAuth: FirebaseAuth? = null
            try {
                val cleanName = name.trim()
                require(cleanName.length in 2..120) { "Escribe un nombre de 2 a 120 caracteres." }
                val address = RegistrationPolicy.validate(email, password, password)
                authorize(actor)
                val primary = FirebaseApp.getInstance()
                check(primary.options.projectId == "cultura-y-cuchara") { "Configuración de Firebase no compatible." }
                secondary = FirebaseApp.initializeApp(getApplication(), primary.options, "admin-create-" + java.util.UUID.randomUUID())
                secondaryAuth = FirebaseAuth.getInstance(secondary)
                val result = secondaryAuth.createUserWithEmailAndPassword(address, password).await()
                val user = result.user ?: error("No se pudo confirmar el identificador de la cuenta.")
                // Keep the result before any further network operation. Never retain the password.
                val created = CreatedBusinessAccount(user.uid, address, cleanName)
                mutable.value = mutable.value.copy(pending = created)
                register(actor, created)
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { failure(e) }
            finally {
                runCatching { secondaryAuth?.signOut() }
                runCatching { secondary?.delete() }
                mutable.value = mutable.value.copy(busy = false)
            }
        }
    }
    fun retry(actor: String) {
        val old = mutable.value
        val pending = old.pending ?: return
        if (old.busy || old.actor != actor) return
        mutable.value = old.copy(busy = true, message = null)
        viewModelScope.launch {
            try { register(actor, pending) }
            catch (e: CancellationException) { throw e }
            catch (e: Exception) { failure(e) }
            finally { mutable.value = mutable.value.copy(busy = false) }
        }
    }
    private suspend fun register(actor: String, created: CreatedBusinessAccount) {
        authorize(actor)
        val ref = db.collection("missionRewardMerchants").document(created.uid)
        // Deterministic event ID allows retry after an ambiguous commit without duplicate audit entries.
        val audit = db.collection("adminAudit").document("account-created-" + created.uid)
        db.runTransaction { tx ->
            check(auth.currentUser?.uid == actor) { "La sesión cambió." }
            val old = tx.get(ref)
            val event = tx.get(audit)
            if (old.exists()) {
                check(old.getString("email") == created.email && old.getString("provisionedBy") == actor && event.exists()) {
                    "La cuenta ya tiene un registro distinto. Actualiza el directorio para revisar sus accesos."
                }
            } else {
                check(!event.exists()) { "El registro cambió. Revisa la cuenta desde el directorio." }
                tx.set(ref, mapOf("uid" to created.uid, "email" to created.email, "businessName" to created.name,
                    "active" to false, "placeIds" to emptyList<String>(), "provisionedBy" to actor,
                    "createdAt" to FieldValue.serverTimestamp(), "updatedAt" to FieldValue.serverTimestamp()))
                tx.set(audit, mapOf("action" to "businessAccount.created", "module" to "businessAccess",
                    "summary" to "Creó una cuenta sin accesos de negocios", "details" to mapOf("targetUid" to created.uid, "email" to created.email),
                    "actorUid" to actor, "actorEmail" to (auth.currentUser?.email ?: ""), "createdAt" to FieldValue.serverTimestamp()))
            }
            Unit
        }.await()
        check(auth.currentUser?.uid == actor) { "La sesión cambió." }
        mutable.value = AdminAccountCreationState(actor, complete = true,
            message = "Cuenta creada. Actualiza las cuentas de negocios para asignarle paradas y habilitarla. Su titular deberá completar su perfil al ingresar.")
    }
    private fun failure(e: Exception) {
        val old = mutable.value
        val message = when {
            old.pending != null -> "La cuenta de acceso ya fue creada, pero falta confirmar su registro de negocio. Usa Completar registro; no vuelvas a crearla."
            e is FirebaseAuthUserCollisionException -> "Ese correo ya tiene una cuenta. No se cambió su contraseña. Búscala en usuarios registrados o pide a su titular que complete su perfil."
            e is IllegalArgumentException || e is IllegalStateException -> e.message
            else -> "No se pudo confirmar la creación. Si el correo ya quedó registrado, su titular puede ingresar y completar su perfil. No repitas la operación sin revisar el resultado."
        }
        mutable.value = old.copy(message = message)
    }
}

@Composable
internal fun AdminAccountCreationEntry(uid: String, refresh: () -> Unit) {
    val model: AdminAccountCreationViewModel = viewModel(key = "admin-account-create-" + uid)
    val observed by model.state.collectAsStateWithLifecycle()
    val state = observed.takeIf { it.actor == uid } ?: AdminAccountCreationState()
    var open by remember(uid) { mutableStateOf(false) }
    var name by remember(uid) { mutableStateOf("") }
    var email by remember(uid) { mutableStateOf("") }
    // Credentials intentionally never enter saved state, Firestore, logs or the directory.
    var password by remember(uid) { mutableStateOf("") }
    var confirmation by remember(uid) { mutableStateOf("") }
    var review by remember(uid) { mutableStateOf(false) }
    OutlinedButton(onClick = { model.begin(uid); name = ""; email = ""; open = true }, enabled = !state.busy) { Text("Crear cuenta para un responsable") }
    if (open) Dialog(onDismissRequest = { if (!state.busy) { open = false; password = ""; confirmation = "" } }) {
        Surface {
            Column(Modifier.padding(20.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Nueva cuenta", style = MaterialTheme.typography.headlineSmall)
                Text("Se creará una cuenta de correo y contraseña, sin asignar paradas ni permisos administrativos. Tu sesión se conserva. No se envían correos automáticamente.")
                if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                state.message?.let { Text(it) }
                state.pending?.let { Text("Cuenta creada: " + it.email) }
                if (!state.complete && state.pending == null) {
                    OutlinedTextField(name, { name = it.take(120) }, label = { Text("Nombre del responsable o negocio") }, enabled = !state.busy)
                    OutlinedTextField(email, { email = it.take(254) }, label = { Text("Correo del titular") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email), enabled = !state.busy)
                    OutlinedTextField(password, { password = it }, label = { Text("Contraseña inicial (8 a 128 caracteres)") }, visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password), enabled = !state.busy)
                    OutlinedTextField(confirmation, { confirmation = it }, label = { Text("Repetir contraseña") }, visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password), enabled = !state.busy)
                    Text("Entrega la contraseña al titular por un medio privado. No se guardará en el directorio.")
                    Button(onClick = { review = true }, enabled = !state.busy && name.trim().length >= 2 && email.isNotBlank() && password.length in 8..128 && password == confirmation) { Text("Revisar creación") }
                }
                if (state.pending != null) Button(onClick = { model.retry(uid) }, enabled = !state.busy) { Text("Completar registro de negocio") }
                if (state.complete) Button(onClick = { refresh(); open = false }) { Text("Ir a cuentas de negocios") }
                TextButton(onClick = { open = false; password = ""; confirmation = "" }, enabled = !state.busy) { Text("Cerrar") }
            }
        }
    }
    if (review) AlertDialog(onDismissRequest = { review = false }, title = { Text("Crear esta cuenta") },
        text = { Text(name.trim() + "\n" + email.trim() + "\nQuedará sin acceso a paradas hasta que se las asignes. Verifica el correo antes de continuar.") },
        confirmButton = { TextButton(onClick = {
            review = false
            model.create(uid, name, email, password)
            password = ""; confirmation = ""
        }) { Text("Crear cuenta") } }, dismissButton = { TextButton(onClick = { review = false }) { Text("Volver") } })
}

