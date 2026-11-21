package com.visitaloja.app

import android.content.Context
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

internal data class AdminPlaceEditorState(
    val uid: String? = null, val place: String = "", val creating: Boolean = false, val busy: Boolean = false,
    val ready: Boolean = false, val base: Map<String, Any?>? = null, val draft: AdminPlaceDraft = AdminPlaceDraft(),
    val galleryLimit: Int = 3, val hasPin: Boolean = false, val message: String? = null, val saved: Boolean = false
)
internal class AdminPlaceEditorViewModel : ViewModel() {
    private val auth = FirebaseAuth.getInstance()
    private val db = FirebaseFirestore.getInstance()
    private val mutable = MutableStateFlow(AdminPlaceEditorState())
    val state = mutable.asStateFlow()
    private var epoch = 0
    // Private PIN values never enter the public place draft or saved instance state.
    private var pinBase: Map<String, Any?>? = null
    private fun same(uid: String, version: Int) = epoch == version && auth.currentUser?.uid == uid && mutable.value.uid == uid
    private fun validPin(value: Any?) = value is String && value.matches(Regex("[0-9]{4,6}"))
    private suspend fun authorize(uid: String) {
        val user = auth.currentUser?.takeIf { it.uid == uid } ?: error("La sesión cambió.")
        val claims = user.getIdToken(true).await().claims
        check(AdminPlacePolicy.allowed(user.email, claims, emptyMap()) ||
            AdminPlacePolicy.allowed(user.email, claims, db.collection("adminUsers").document(uid).get(Source.SERVER).await().data.orEmpty())) {
            "Necesitas administración general para gestionar paradas."
        }
    }
    fun bind(uid: String?, place: String, creating: Boolean) {
        val version = ++epoch
        pinBase = null
        mutable.value = AdminPlaceEditorState(uid, place, creating, busy = uid != null)
        if (uid == null) return
        if (!MerchantScanPolicy.placeId(place)) {
            mutable.value = mutable.value.copy(busy = false, message = "Identificador no compatible.")
            return
        }
        viewModelScope.launch {
            try {
                authorize(uid)
                if (!same(uid, version)) return@launch
                val locale = db.collection("locales").document(place).get(Source.SERVER).await()
                val recovered = creating && locale.exists() && AdminPlaceEditorPolicy.recoveredCreation(locale.data.orEmpty(), uid, place)
                check(if (creating) !locale.exists() || recovered else locale.exists()) { "La parada cambió. Cierra el editor y actualiza el listado." }
                val create = creating && !recovered
                val privatePin = db.collection("passportPins").document(place).get(Source.SERVER).await()
                val settings = db.collection("settings").document("subscriptions").get(Source.SERVER).await()
                val base = locale.data
                val draft = AdminPlaceEditorPolicy.read(base.orEmpty(), create)
                val limit = AdminPlaceEditorPolicy.galleryLimit(base.orEmpty(), settings.data.orEmpty())
                if (same(uid, version)) {
                    pinBase = privatePin.data
                    mutable.value = AdminPlaceEditorState(uid, place, create, ready = true, base = base, draft = draft,
                        galleryLimit = limit, hasPin = validPin(privatePin.get("pin")) || validPin(base?.get("pin")),
                        message = if (recovered) "Se recuperó la parada creada. Ya puedes revisarla sin crear otra." else null)
                }
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) {
                if (same(uid, version)) mutable.value = AdminPlaceEditorState(uid, place, creating,
                    message = if (e is IllegalArgumentException || e is IllegalStateException) e.message else "No se pudo consultar la parada y los permisos. Vuelve a actualizar.")
            }
        }
    }
    fun edit(draft: AdminPlaceDraft) {
        val old = mutable.value
        if (old.ready && !old.busy) mutable.value = old.copy(draft = draft, message = null)
    }
    fun upload(context: Context, uri: Uri, purpose: String) {
        val old = mutable.value
        val uid = old.uid ?: return
        if (!old.ready || old.busy || purpose !in setOf("logo", "hero", "gallery")) return
        if (purpose == "gallery" && old.draft.photos.size >= minOf(100, maxOf(old.galleryLimit,
                AdminPlaceEditorPolicy.read(old.base.orEmpty(), false).photos.size))) {
            mutable.value = old.copy(message = "La galería alcanzó el límite. Retira una foto antes de añadir otra.")
            return
        }
        val version = epoch
        mutable.value = old.copy(busy = true, message = "Subiendo imagen…")
        viewModelScope.launch {
            try {
                authorize(uid)
                if (!same(uid, version)) return@launch
                val url = MerchantImageUpload.upload(context.applicationContext, uri, old.place, purpose, uid, admin = true)
                if (!same(uid, version)) return@launch
                val draft = if (purpose == "gallery") old.draft.copy(photos = old.draft.photos +
                    AdminPlacePhoto(java.util.UUID.randomUUID().toString(), url))
                    else old.draft.copy(text = old.draft.text + ((if (purpose == "logo") "customLogoUrl" else "heroImage") to url))
                mutable.value = old.copy(draft = draft, message = "Imagen subida. Revisa y guarda la parada para aplicar el cambio.")
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) {
                if (same(uid, version)) mutable.value = old.copy(message =
                    if (e is IllegalArgumentException || e is IllegalStateException) e.message
                    else "No se pudo subir la imagen. El formulario se conserva; puedes volver a elegirla.")
            }
        }
    }
    fun save() {
        val old = mutable.value
        val uid = old.uid ?: return
        if (old.busy || !old.ready) return
        try { AdminPlaceEditorPolicy.publicFields(old.place, old.base.orEmpty(), old.draft, old.creating, old.galleryLimit, old.hasPin) }
        catch (e: Exception) { mutable.value = old.copy(message = e.message ?: "Revisa los datos."); return }
        val version = epoch
        val expectedPin = pinBase
        mutable.value = old.copy(busy = true, message = null)
        viewModelScope.launch {
            try {
                authorize(uid)
                if (!same(uid, version)) return@launch
                val ref = db.collection("locales").document(old.place)
                val pin = db.collection("passportPins").document(old.place)
                val settings = db.collection("settings").document("subscriptions")
                val audit = db.collection("adminAudit").document()
                db.runTransaction { tx ->
                    check(same(uid, version)) { "La sesión cambió." }
                    val current = tx.get(ref)
                    val privatePin = tx.get(pin)
                    val plans = tx.get(settings)
                    check((if (old.creating) !current.exists() else current.exists()) &&
                        current.data == old.base && privatePin.data == expectedPin) { "La parada o su PIN cambiaron en otro dispositivo. Actualiza antes de guardar." }
                    val limit = AdminPlaceEditorPolicy.galleryLimit(current.data.orEmpty(), plans.data.orEmpty())
                    val fields = AdminPlaceEditorPolicy.publicFields(old.place, current.data.orEmpty(), old.draft,
                        old.creating, limit, validPin(privatePin.get("pin")) || validPin(current.get("pin")))
                    val metadata = mapOf("updatedAt" to FieldValue.serverTimestamp(), "updatedBy" to (auth.currentUser?.email ?: ""))
                    val payload = fields + metadata
                    if (old.creating) tx.set(ref, payload + mapOf("createdAt" to FieldValue.serverTimestamp(),
                        "createdBy" to uid, "creationRequestId" to old.place))
                    else tx.update(ref, payload + if (current.data?.containsKey("pin") == true) mapOf("pin" to FieldValue.delete()) else emptyMap())
                    if (AdminPlaceEditorPolicy.usesPin(old.draft.category)) {
                        val newPin = old.draft.pin.takeIf { validPin(it) }
                            ?: (current.get("pin") as? String).takeIf { !validPin(privatePin.get("pin")) && validPin(it) }
                        if (newPin != null) tx.set(pin, metadata + ("pin" to newPin), SetOptions.merge())
                    } else if (privatePin.exists()) tx.delete(pin)
                    tx.set(audit, mapOf("action" to if (old.creating) "place.created" else "place.updated", "module" to "places",
                        "summary" to "Guardó una parada desde Android", "details" to mapOf("placeId" to old.place,
                            "publicationStatus" to old.draft.publication, "category" to old.draft.category,
                            "photoCount" to old.draft.photos.size),
                        "actorUid" to uid, "actorEmail" to (auth.currentUser?.email ?: ""),
                        "createdAt" to FieldValue.serverTimestamp()))
                    Unit
                }.await()
                if (same(uid, version)) {
                    pinBase = null
                    mutable.value = AdminPlaceEditorState(uid, old.place, old.creating, saved = true,
                        message = "Parada guardada en VisitaLoja.")
                }
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) {
                if (same(uid, version)) mutable.value = old.copy(ready = false, busy = false, draft = old.draft.copy(pin = ""),
                    message = if (e is IllegalStateException || e is IllegalArgumentException) e.message else
                        "No se pudo confirmar el guardado. Actualiza esta misma parada antes de repetir; se conserva su identificador.")
            }
        }
    }
}
