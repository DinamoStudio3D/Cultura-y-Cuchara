package com.visitaloja.app

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.LocationManager
import android.os.CancellationSignal
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat
import androidx.core.location.LocationManagerCompat

/** A single approximate foreground fix. No background listener or stored history. */
class MapLocation(private val context: Context) {
    private val handler = Handler(Looper.getMainLooper())
    private var signal: CancellationSignal? = null
    private var timeout: Runnable? = null
    private var generation = 0
    fun cancel() { generation++; timeout?.let(handler::removeCallbacks); timeout = null; signal?.cancel(); signal = null }
    fun locate(result: (Double?, Double?, String?) -> Unit) {
        cancel()
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            result(null, null, "Permite la ubicación aproximada para centrar el mapa."); return
        }
        val manager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        if (!LocationManagerCompat.isLocationEnabled(manager) || !manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
            result(null, null, "Activa la ubicación y el servicio de ubicación de red del teléfono. Puedes explorar el mapa sin este permiso."); return
        }
        val epoch = generation
        val cancellation = CancellationSignal()
        signal = cancellation
        fun finish(lat: Double?, lng: Double?, message: String?) {
            if (generation == epoch) { cancel(); result(lat, lng, message) }
        }
        val expire = Runnable { finish(null, null, "No pudimos obtener tu ubicación. Vuelve a intentar en un lugar con señal.") }
        timeout = expire
        handler.postDelayed(expire, 20000)
        try {
            LocationManagerCompat.getCurrentLocation(manager, LocationManager.NETWORK_PROVIDER, cancellation, ContextCompat.getMainExecutor(context)) { location ->
                if (location != null && PlacePolicy.safeCoordinate(location.latitude, true) != null && PlacePolicy.safeCoordinate(location.longitude, false) != null)
                    finish(location.latitude, location.longitude, null)
                else finish(null, null, "No pudimos obtener una ubicación actual. Puedes seguir usando el mapa.")
            }
        } catch (_: SecurityException) { finish(null, null, "No hay permiso de ubicación. Puedes seguir explorando el mapa.") }
        catch (_: IllegalArgumentException) { finish(null, null, "Este dispositivo no ofrece ubicación de red. Puedes explorar manualmente.") }
    }
}
