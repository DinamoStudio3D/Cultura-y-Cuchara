package com.visitaloja.app

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Intent
import android.content.IntentFilter
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import androidx.core.content.ContextCompat
import androidx.core.location.LocationManagerCompat
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.location.*

/** Updates exist only after a user request, while this map is in the foreground. */
class MapLocation(private val context: Context) {
    private val handler = Handler(Looper.getMainLooper())
    private val manager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    private val fused = LocationServices.getFusedLocationProviderClient(context)
    private var fusedCallback: LocationCallback? = null
    private var platformCallback: LocationListener? = null
    private var settingsReceiver: BroadcastReceiver? = null
    private var generation = 0
    private var current = MapLocationState()
    fun hasPermission(): Boolean = granted(Manifest.permission.ACCESS_COARSE_LOCATION) || granted(Manifest.permission.ACCESS_FINE_LOCATION)
    fun precise(): Boolean = granted(Manifest.permission.ACCESS_FINE_LOCATION)
    private fun granted(permission: String): Boolean = ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
    fun cancel() {
        generation++
        handler.removeCallbacksAndMessages(null)
        fusedCallback?.let { fused.removeLocationUpdates(it) }; fusedCallback = null
        platformCallback?.let { runCatching { manager.removeUpdates(it) } }; platformCallback = null
        settingsReceiver?.let { runCatching { context.unregisterReceiver(it) } }; settingsReceiver = null
        current = MapLocationState()
    }
    // All registrations check foreground permission and handle revocation before using providers.
    @android.annotation.SuppressLint("MissingPermission")
    fun start(result: (MapLocationState) -> Unit) {
        cancel()
        val epoch = generation
        fun publish(value: MapLocationState) { if (generation == epoch) { current = value; result(value) } }
        if (!hasPermission()) { publish(MapLocationState(problem = MapLocationProblem.PERMISSION)); return }
        if (!LocationManagerCompat.isLocationEnabled(manager)) { publish(MapLocationState(problem = MapLocationProblem.DISABLED)); return }
        publish(MapLocationState(active = true, precise = precise()))
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                if (generation != epoch) return
                if (!LocationManagerCompat.isLocationEnabled(manager)) publish(current.copy(fix = null, problem = MapLocationProblem.DISABLED))
                else if (current.problem == MapLocationProblem.DISABLED) start(result)
            }
        }
        settingsReceiver = receiver
        ContextCompat.registerReceiver(context, receiver, IntentFilter().apply {
            addAction(LocationManager.MODE_CHANGED_ACTION); addAction(LocationManager.PROVIDERS_CHANGED_ACTION)
        }, ContextCompat.RECEIVER_NOT_EXPORTED)
        fun receive(location: Location) {
            if (generation != epoch) return
            if (!hasPermission()) { cancel(); result(MapLocationState(problem = MapLocationProblem.PERMISSION)); return }
            if (!LocationManagerCompat.isLocationEnabled(manager)) { publish(current.copy(fix = null, problem = MapLocationProblem.DISABLED)); return }
            val fix = MapFix(location.latitude, location.longitude, if (location.hasAccuracy()) location.accuracy else Float.NaN, location.elapsedRealtimeNanos / 1000000)
            if (MapLocationPolicy.accept(fix, current.fix, SystemClock.elapsedRealtime())) publish(current.copy(fix = fix, problem = MapLocationProblem.NONE, precise = precise()))
        }
        fun platform() {
            if (generation != epoch || platformCallback != null || !hasPermission()) return
            if (!LocationManagerCompat.isLocationEnabled(manager)) { publish(current.copy(fix = null, problem = MapLocationProblem.DISABLED)); return }
            val listener = object : LocationListener {
                override fun onLocationChanged(location: Location) = receive(location)
                override fun onProviderEnabled(provider: String) = Unit
                override fun onProviderDisabled(provider: String) {
                    if (generation == epoch && !LocationManagerCompat.isLocationEnabled(manager)) publish(current.copy(fix = null, problem = MapLocationProblem.DISABLED))
                }
                @Deprecated("Required on older Android devices") override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) = Unit
            }
            platformCallback = listener
            var registered = false
            listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER).forEach { provider ->
                if (provider == LocationManager.GPS_PROVIDER && !precise()) return@forEach
                try {
                    if (manager.allProviders.contains(provider) && manager.isProviderEnabled(provider)) {
                        manager.requestLocationUpdates(provider, 3000L, 0f, listener, Looper.getMainLooper())
                        registered = true
                        manager.getLastKnownLocation(provider)?.let(::receive)
                    }
                } catch (_: SecurityException) { }
                catch (_: IllegalArgumentException) { }
            }
            if (!registered && current.fix == null) publish(current.copy(problem = if (!hasPermission()) MapLocationProblem.PERMISSION else MapLocationProblem.NO_SIGNAL))
        }
        if (GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(context) == ConnectionResult.SUCCESS) {
            val callback = object : LocationCallback() {
                override fun onLocationResult(locations: LocationResult) { locations.locations.sortedBy { it.elapsedRealtimeNanos }.forEach(::receive) }
            }
            fusedCallback = callback
            val request = LocationRequest.Builder(if (precise()) Priority.PRIORITY_HIGH_ACCURACY else Priority.PRIORITY_BALANCED_POWER_ACCURACY, 3000L)
                .setMinUpdateIntervalMillis(2000L).setMaxUpdateAgeMillis(5000L).setWaitForAccurateLocation(precise()).build()
            try {
                fused.requestLocationUpdates(request, callback, Looper.getMainLooper())
                    .addOnSuccessListener { if (generation != epoch) fused.removeLocationUpdates(callback) }
                    .addOnFailureListener { if (generation == epoch) platform() }
            } catch (_: SecurityException) { platform() }
            handler.postDelayed({ if (generation == epoch && (current.fix == null || current.fix!!.accuracy > 150)) platform() }, 10000L)
        } else platform()
        handler.postDelayed({ if (generation == epoch && current.fix == null && current.problem != MapLocationProblem.DISABLED) publish(current.copy(problem = MapLocationProblem.NO_SIGNAL)) }, 30000L)
    }
}
