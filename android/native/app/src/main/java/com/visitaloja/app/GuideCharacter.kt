package com.visitaloja.app

import androidx.compose.foundation.Image
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.repeatOnLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

internal data class GuideCharacter(val active: Boolean = true, val image: String? = null, val greeting: String? = null)
internal object GuideCharacterPolicy {
    fun read(raw: Map<String, Any?>): GuideCharacter {
        val messages = raw["messages"] as? Map<*, *>
        return GuideCharacter(raw["active"] != false, DiscoveryPolicy.media(raw.text("imageUrl")), (messages?.get("inicio") as? String)?.trim()?.take(220)?.takeIf { it.isNotBlank() })
    }
}
internal class GuideCharacterViewModel : ViewModel() {
    private val mutable = MutableStateFlow(GuideCharacter()); val state = mutable.asStateFlow()
    private var listener: ListenerRegistration? = null; private var epoch = 0
    fun bind(active: Boolean) {
        val version = ++epoch; listener?.remove(); listener = null; if (!active) return
        listener = FirebaseFirestore.getInstance().collection("siteContent").document("chabaquito").addSnapshotListener { doc, error ->
            if (version == epoch && error == null && doc != null) mutable.value = GuideCharacterPolicy.read(doc.data.orEmpty())
        }
    }
    override fun onCleared() { epoch++; listener?.remove(); super.onCleared() }
}
@Composable
internal fun guideCharacter(key: String): GuideCharacter {
    val model: GuideCharacterViewModel = viewModel(key = key)
    val state by model.state.collectAsStateWithLifecycle()
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    LaunchedEffect(model, lifecycle) { lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) { model.bind(true); try { awaitCancellation() } finally { model.bind(false) } } }
    return state
}
@Composable
internal fun ChabaquitoArt(character: GuideCharacter, modifier: Modifier, description: String?) {
    if (!character.active) return
    if (character.image == null) Image(painterResource(R.drawable.chabaquito), description, modifier, contentScale = ContentScale.Fit)
    else AsyncImage(character.image, description, modifier, placeholder = painterResource(R.drawable.chabaquito), error = painterResource(R.drawable.chabaquito), contentScale = ContentScale.Fit)
}
