package com.visitaloja.app

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.MetadataChanges
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

internal class PlatformContactViewModel : ViewModel() {
    private val mutable = MutableStateFlow(PublicContent(PlatformContact()))
    val state = mutable.asStateFlow()
    private var listener: ListenerRegistration? = null
    private var epoch = 0
    fun bind(active: Boolean, english: Boolean = false) {
        val generation = ++epoch
        listener?.remove(); listener = null
        mutable.value = PublicContent(PlatformContact())
        if (!active) return
        listener = FirebaseFirestore.getInstance().collection("settings").document("main").addSnapshotListener(MetadataChanges.INCLUDE) { doc, error ->
            if (generation != epoch) return@addSnapshotListener
            mutable.value = when {
                error != null || doc == null -> PublicContent(PlatformContact(), false, true)
                doc.metadata.isFromCache -> PublicContent(PlatformContact())
                else -> PublicContent(PlatformPolicy.contact(doc.data.orEmpty(), english), false)
            }
        }
    }
    override fun onCleared() { epoch++; listener?.remove(); super.onCleared() }
}
internal data class LegalContent(val blocks: List<LegalBlock> = emptyList(), val loading: Boolean = true, val bundled: Boolean = false, val document: String = "")
internal class LegalViewModel(application: Application) : AndroidViewModel(application) {
    private val mutable = MutableStateFlow(LegalContent())
    val state = mutable.asStateFlow()
    private var job: Job? = null
    private var epoch = 0
    private val client = OkHttpClient.Builder().followRedirects(false).followSslRedirects(false).connectTimeout(10, TimeUnit.SECONDS).readTimeout(12, TimeUnit.SECONDS).callTimeout(15, TimeUnit.SECONDS).build()
    fun load(key: String) {
        val generation = ++epoch
        job?.cancel(); mutable.value = LegalContent(document = key)
        val url = PlatformPolicy.documentUrl(key) ?: return
        job = viewModelScope.launch {
            val content = withContext(Dispatchers.IO) {
                val live = runCatching {
                    client.newCall(Request.Builder().url(url).get().build()).execute().use { response ->
                        check(response.isSuccessful)
                        val source = response.body?.source() ?: error("Empty document")
                        check(!source.request(256001))
                        PlatformPolicy.legal(source.readUtf8()).also { check(it.isNotEmpty()) }
                    }
                }.getOrNull()
                if (live != null) LegalContent(live, false, false, key) else {
                    val bundled = runCatching { getApplication<Application>().assets.open("legal/${PlatformPolicy.documents.getValue(key)}").bufferedReader().use { PlatformPolicy.legal(it.readText()) } }.getOrDefault(emptyList())
                    LegalContent(bundled, false, true, key)
                }
            }
            if (generation == epoch) mutable.value = content
        }
    }
    fun stop() { epoch++; job?.cancel(); mutable.value = LegalContent() }
    override fun onCleared() { epoch++; job?.cancel(); client.dispatcher.cancelAll(); super.onCleared() }
}
