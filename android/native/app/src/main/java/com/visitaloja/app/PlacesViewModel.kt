package com.visitaloja.app

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

data class PlacesState(
    val places: List<Place> = emptyList(), val loading: Boolean = false, val error: String? = null,
    val offline: Boolean = false, val fetchedAt: Long = 0, val favourites: Set<String> = emptySet(), val cacheAvailable: Boolean = false
)
class PlacesViewModel(application: Application) : AndroidViewModel(application) {
    private val preferences = application.getSharedPreferences("visitaloja_local_favourites", Context.MODE_PRIVATE)
    private val repository = PlacesRepository(File(application.filesDir, "published-places-v1.json"))
    private val mutable = MutableStateFlow(PlacesState(favourites = preferences.getStringSet("places", emptySet())?.toSet() ?: emptySet()))
    val state = mutable.asStateFlow()
    init { refresh() }
    fun refresh() {
        if (mutable.value.loading) return
        mutable.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            try {
                val result = withContext(Dispatchers.IO) { repository.load() }
                mutable.update { it.copy(places = result.places, loading = false, error = null, offline = result.offline, fetchedAt = result.savedAt, cacheAvailable = result.cacheAvailable) }
            } catch (_: Exception) {
                mutable.update { it.copy(loading = false, error = "No pudimos cargar los lugares publicados. Comprueba la conexión y vuelve a intentar.") }
            }
        }
    }
    fun toggleFavourite(id: String) {
        val current = mutable.value.favourites
        val next = if (id in current) current - id else current + id
        preferences.edit().putStringSet("places", next).apply()
        mutable.update { it.copy(favourites = next) }
    }
}
