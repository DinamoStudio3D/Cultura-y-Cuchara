package com.visitaloja.app

import android.app.Application
import android.content.SharedPreferences
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class PushState(val uid: String? = null, val active: Boolean = false, val permission: Boolean = false, val busy: Boolean = false, val message: String? = null, val notices: List<ReceivedNotice> = emptyList())

class PushViewModel(application: Application) : AndroidViewModel(application) {
    private val context = application
    private val auth = FirebaseAuth.getInstance()
    private val mutable = MutableStateFlow(PushState())
    val state = mutable.asStateFlow()
    private val preferences = PushStore.preferences(context)
    private var action = 0
    private fun publish() {
        val uid = auth.currentUser?.uid
        mutable.update { old -> PushState(uid, PushStore.active(context, uid), NativePush.allowed(context), if (old.uid == uid) old.busy else false, if (old.uid == uid) old.message else null, PushStore.notices(context, uid)) }
    }
    private val preferenceListener = SharedPreferences.OnSharedPreferenceChangeListener { _, _ -> publish() }
    private val authListener = FirebaseAuth.AuthStateListener {
        if (mutable.value.uid != it.currentUser?.uid) action++
        NativePush.reconcile(context, it.currentUser?.uid)
        publish()
        val uid = it.currentUser?.uid
        if (uid != null && PushStore.active(context, uid) && preferences.getBoolean("needsSync", false)) NativePush.enqueueSync(context)
    }
    init { NativePush.createChannel(context); preferences.registerOnSharedPreferenceChangeListener(preferenceListener); auth.addAuthStateListener(authListener) }
    fun refresh() {
        publish()
        val uid = auth.currentUser?.uid ?: return
        if (PushStore.active(context, uid) && preferences.getBoolean("needsSync", false)) NativePush.enqueueSync(context)
    }
    fun enable(uid: String) {
        if (auth.currentUser?.uid != uid) return
        if (mutable.value.busy || !NativePush.allowed(context)) { mutable.update { it.copy(message = "Permite las notificaciones en los ajustes de Android para continuar.") }; return }
        val epoch = ++action
        val revision = PushStore.begin(context, uid)
        mutable.update { it.copy(busy = true, message = null) }
        viewModelScope.launch {
            try {
                NativePush.subscribe(context, uid, revision)
                if (epoch == action && auth.currentUser?.uid == uid) mutable.update { it.copy(message = "Notificaciones activadas en este móvil. Recibirás los próximos avisos enviados desde VisitaLoja.") }
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (error: Exception) {
                if (epoch == action && auth.currentUser?.uid == uid) {
                    if (PushStore.current(context, uid, revision)) NativePush.stop(context)
                    mutable.update { it.copy(message = (error as? NativeHttpError)?.message ?: "No pudimos confirmar la activación. Comprueba la conexión y vuelve a intentarlo.") }
                }
            } finally { if (epoch == action && auth.currentUser?.uid == uid) { publish(); mutable.update { it.copy(busy = false) } } }
        }
    }
    fun disable(uid: String) {
        if (auth.currentUser?.uid != uid) return
        if (mutable.value.busy) return
        val id = preferences.getString("deviceId", null)
        val epoch = ++action
        NativePush.stop(context)
        mutable.update { it.copy(busy = true, message = "Desactivadas en este móvil.") }
        viewModelScope.launch {
            try { NativePush.unsubscribe(context, uid, id) }
            catch (cancelled: CancellationException) { throw cancelled }
            catch (_: Exception) { if (epoch == action && auth.currentUser?.uid == uid) mutable.update { it.copy(message = "Desactivadas en este móvil. No pudimos confirmar la baja con el servidor; puedes reintentarlo al conectarte.") } }
            finally { if (epoch == action && auth.currentUser?.uid == uid) { publish(); mutable.update { it.copy(busy = false) } } }
        }
    }
    fun localTest() { NativePush.localTest(context); publish(); mutable.update { it.copy(message = if (NativePush.allowed(context)) "Prueba local mostrada. Revisa la bandeja de notificaciones de Android. No prueba un envío desde el panel." else "Permite los avisos en los ajustes de Android.") } }
    fun clearHistory(uid: String?) { if (uid != null && auth.currentUser?.uid == uid) preferences.edit().putString("history", "[]").apply() }
    override fun onCleared() { action++; auth.removeAuthStateListener(authListener); preferences.unregisterOnSharedPreferenceChangeListener(preferenceListener); super.onCleared() }
}
