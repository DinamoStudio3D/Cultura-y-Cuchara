package com.visitaloja.app

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import org.json.JSONObject

data class ClaimState(val uid: String? = null, val busy: Boolean = false, val message: String? = null)
class PassportClaimViewModel : ViewModel() {
    private val auth = FirebaseAuth.getInstance()
    private val mutable = MutableStateFlow(ClaimState())
    val state = mutable.asStateFlow()
    private var generation = 0
    fun bind(uid: String?) { generation++; mutable.value = ClaimState(uid) }
    fun claim(campaign: String, mode: String, option: String) {
        val user = auth.currentUser ?: return
        val uid = user.uid; val epoch = generation
        if (mutable.value.busy || mutable.value.uid != uid) return
        mutable.update { it.copy(busy = true, message = null) }
        viewModelScope.launch {
            fun current() = generation == epoch && auth.currentUser?.uid == uid
            try {
                require(campaign.matches(Regex("[A-Za-z0-9_-]{1,60}")) && mode in setOf("lojano", "turista") && option.length <= 80)
                val token = user.getIdToken(false).await().token ?: error("Inicia sesión nuevamente.")
                if (!current()) return@launch
                val response = withContext(Dispatchers.IO) { NativeApi.post("https://www.visitaloja.com/api/chabaquito-ranking?action=passport-claim", token, JSONObject().put("campaignId", campaign).put("mode", mode).put("optionId", option)) }
                check(response.optString("claimCode").matches(Regex("PAS-[A-F0-9]{12}"))) { "No recibimos un código válido. Actualiza tu recorrido antes de reintentar." }
                if (current()) mutable.update { it.copy(message = if (response.optString("status") == "delivered") "Esta recompensa ya fue entregada." else if (response.optBoolean("alreadyRegistered")) "Tu premio ya estaba registrado. Conservas el mismo código; consúltalo abajo." else "Tu recompensa quedó registrada. Encontrarás el código de canje en tu pasaporte.") }
            } catch (cancel: kotlinx.coroutines.CancellationException) { throw cancel }
            catch (error: Exception) { if (current()) mutable.update { it.copy(message = if (error is NativeHttpError || error is IllegalArgumentException || error is IllegalStateException) error.message else "No pudimos confirmar la solicitud. Actualiza y reintenta: el sistema recuperará el premio existente si se registró.") } }
            finally { if (current()) mutable.update { it.copy(busy = false) } }
        }
    }
}
