package com.visitaloja.app

import androidx.lifecycle.ViewModel

data class MapCamera(val latitude: Double = MapPolicy.LOJA_LAT, val longitude: Double = MapPolicy.LOJA_LNG, val zoom: Double = MapPolicy.DEFAULT_ZOOM, val bearing: Double = 0.0, val tilt: Double = 0.0)
/** Retains the viewport across rotation in memory only, never in account data or disk. */
class MapViewportViewModel : ViewModel() {
    var camera = MapCamera()
        private set
    fun update(next: MapCamera) {
        if (PlacePolicy.safeCoordinate(next.latitude, true) != null && PlacePolicy.safeCoordinate(next.longitude, false) != null &&
            next.zoom.isFinite() && next.zoom in 3.0..19.0 && next.bearing.isFinite() && next.tilt.isFinite()) camera = next
    }
}
