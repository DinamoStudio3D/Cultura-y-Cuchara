package com.visitaloja.app

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.util.concurrent.TimeUnit

data class FestivalState(val events: List<FestivalEvent> = emptyList(), val loading: Boolean = true,
    val offline: Boolean = false, val now: Long = System.currentTimeMillis())

class FestivalViewModel(private val app: Application) : AndroidViewModel(app) {
    private val client = OkHttpClient.Builder().followRedirects(false).callTimeout(12, TimeUnit.SECONDS).build()
    private val mutable = MutableStateFlow(FestivalState())
    val state = mutable.asStateFlow()
    private var published = emptyList<FestivalEvent>()
    private var imported = emptyList<FestivalEvent>()
    private var refreshJob: Job? = null
    private val listener = FirebaseFirestore.getInstance().collection("siteContent").document("festival")
        .addSnapshotListener { doc, error ->
            if (error == null && doc != null) {
                published = (doc.get("events") as? List<*>).orEmpty().mapNotNull { row ->
                    val fields = (row as? Map<*, *>)?.entries?.associate { it.key.toString() to it.value }
                    fields?.let(FestivalPolicy::parse)
                }
                publish()
            }
        }

    init {
        refresh()
        viewModelScope.launch { while (true) { delay(30_000); mutable.update { it.copy(now = System.currentTimeMillis()) } } }
    }

    fun refresh() {
        if (refreshJob?.isActive == true) return
        refreshJob = viewModelScope.launch {
            mutable.update { it.copy(loading = true) }
            if (imported.isEmpty()) {
                imported = withContext(Dispatchers.IO) {
                    runCatching { app.assets.open("fiavl-2026.json").bufferedReader().use { parse(it.readText()) } }.getOrDefault(emptyList())
                }
                publish()
            }
            val remote = withContext(Dispatchers.IO) {
                runCatching {
                    client.newCall(Request.Builder().url(FestivalPolicy.FEED).build()).execute().use { response ->
                        check(response.isSuccessful)
                        val source = checkNotNull(response.body).source()
                        check(!source.request(1_500_001L))
                        parse(source.readUtf8())
                    }
                }.getOrNull()
            }
            if (remote != null) imported = remote
            publish()
            mutable.update { it.copy(loading = false, offline = remote == null) }
        }
    }

    private fun publish() = mutable.update { it.copy(events = FestivalPolicy.merge(published, imported)) }

    private fun parse(json: String): List<FestivalEvent> {
        val payload = JSONObject(json)
        check(payload.getInt("schemaVersion") == 1)
        val rows = payload.getJSONArray("events")
        check(rows.length() in 1..1500)
        return (0 until rows.length()).mapNotNull { index ->
            val row = rows.getJSONObject(index)
            FestivalPolicy.parse(row.keys().asSequence().associateWith(row::opt))
        }.also { check(it.isNotEmpty()) }
    }

    override fun onCleared() { listener.remove(); super.onCleared() }
}
