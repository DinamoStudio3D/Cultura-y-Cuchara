package com.visitaloja.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.core.location.LocationManagerCompat
import androidx.work.*
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofencingEvent
import com.google.android.gms.location.GeofencingRequest
import com.google.android.gms.location.LocationServices
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import org.json.JSONArray
import java.io.File
import java.util.concurrent.TimeUnit

object NearbyGeofences {
    const val CHANNEL = "visitaloja_cercania"
    private const val WORK = "visitaloja-nearby-sync"
    private const val PERIODIC = "visitaloja-nearby-refresh"
    fun prefs(context: Context) = context.getSharedPreferences("nearby-stops", Context.MODE_PRIVATE)
    fun enabled(context: Context) = prefs(context).getBoolean("enabled", false)
    fun permission(context: Context, value: String) = ContextCompat.checkSelfPermission(context, value) == PackageManager.PERMISSION_GRANTED
    fun precise(context: Context) = permission(context, Manifest.permission.ACCESS_FINE_LOCATION)
    fun background(context: Context) = Build.VERSION.SDK_INT < 29 || permission(context, Manifest.permission.ACCESS_BACKGROUND_LOCATION)
    fun notifications(context: Context): Boolean {
        val manager = NotificationManagerCompat.from(context)
        return manager.areNotificationsEnabled() && (Build.VERSION.SDK_INT < 33 || permission(context, Manifest.permission.POST_NOTIFICATIONS)) &&
            (context.getSystemService(NotificationManager::class.java).getNotificationChannel(CHANNEL)?.importance != NotificationManager.IMPORTANCE_NONE)
    }
    fun available(context: Context) = precise(context) && background(context) && notifications(context) &&
        LocationManagerCompat.isLocationEnabled(context.getSystemService(Context.LOCATION_SERVICE) as LocationManager)
    fun status(context: Context, message: String) { prefs(context).edit().putString("status", message).apply() }
    fun setEnabled(context: Context, value: Boolean) {
        prefs(context).edit().putBoolean("enabled", value).apply()
        if (!value) {
            WorkManager.getInstance(context).cancelUniqueWork(PERIODIC)
            NotificationManagerCompat.from(context).cancel("nearby", 600)
            status(context, "Avisos desactivados")
        }
        sync(context)
    }
    fun save(context: Context, places: List<Place>, savedAt: Long) {
        val json = JSONArray(NearbyPolicy.eligible(places).map(PlaceJson::cachePlace)).toString()
        val p = prefs(context)
        val changed = p.getString("catalog", "") != json
        p.edit().putString("catalog", json).putLong("catalogAt", savedAt).apply()
        if (enabled(context) && changed) sync(context)
    }
    fun catalog(context: Context): List<Place> = runCatching {
        val a = JSONArray(prefs(context).getString("catalog", "[]"))
        (0 until a.length()).mapNotNull { PlaceJson.cached(a.getJSONObject(it)) }
    }.getOrDefault(emptyList())
    fun sync(context: Context) {
        WorkManager.getInstance(context).enqueueUniqueWork(WORK, ExistingWorkPolicy.REPLACE, OneTimeWorkRequestBuilder<NearbySyncWorker>().build())
        if (enabled(context)) WorkManager.getInstance(context).enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.KEEP,
            PeriodicWorkRequestBuilder<NearbySyncWorker>(12, TimeUnit.HOURS).setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build())
    }
    fun pending(context: Context): PendingIntent = PendingIntent.getBroadcast(context, 60,
        Intent(context, NearbyReceiver::class.java).setAction("com.visitaloja.app.NEARBY_GEOFENCE"),
        PendingIntent.FLAG_UPDATE_CURRENT or if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0)
}

class NearbySyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    companion object { private val mutex = Mutex() }
    @SuppressLint("MissingPermission")
    override suspend fun doWork(): Result = mutex.withLock { withContext(Dispatchers.IO) {
        val c = applicationContext
        val client = LocationServices.getGeofencingClient(c)
        try {
            client.removeGeofences(NearbyGeofences.pending(c)).await()
            if (!NearbyGeofences.enabled(c)) return@withContext Result.success()
            if (!NearbyGeofences.available(c)) { NearbyGeofences.status(c, "Falta ubicación precisa, permiso Siempre, GPS o notificaciones. Revisa los pasos de activación."); return@withContext Result.success() }
            if (GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(c) != ConnectionResult.SUCCESS) {
                NearbyGeofences.status(c, "Actualiza Google Play Services para usar los avisos de cercanía."); return@withContext Result.success()
            }
            // Separate cache avoids racing the foreground directory writer. No account or GPS upload.
            runCatching { PlacesRepository(File(c.filesDir, "nearby-published-places.json")).load() }.getOrNull()?.let {
                if (!it.offline) {
                    val json = JSONArray(NearbyPolicy.eligible(it.places).map(PlaceJson::cachePlace)).toString()
                    NearbyGeofences.prefs(c).edit().putString("catalog", json).putLong("catalogAt", it.savedAt).apply()
                }
            }
            val places = NearbyPolicy.eligible(NearbyGeofences.catalog(c))
            val age = System.currentTimeMillis() - NearbyGeofences.prefs(c).getLong("catalogAt", 0)
            if (places.isEmpty() || age !in 0..NearbyPolicy.CATALOG_AGE) {
                NearbyGeofences.status(c, "Conéctate para actualizar las paradas cercanas."); return@withContext Result.retry()
            }
            if (!NearbyGeofences.enabled(c) || !NearbyGeofences.available(c)) return@withContext Result.success()
            val fences = places.map { p -> Geofence.Builder().setRequestId(p.id).setCircularRegion(p.latitude!!, p.longitude!!, NearbyPolicy.RADIUS)
                .setExpirationDuration(NearbyPolicy.CATALOG_AGE - age).setTransitionTypes(Geofence.GEOFENCE_TRANSITION_DWELL)
                .setLoiteringDelay(10000).setNotificationResponsiveness(30000).build() }
            val request = GeofencingRequest.Builder().setInitialTrigger(GeofencingRequest.INITIAL_TRIGGER_DWELL).addGeofences(fences).build()
            withContext(NonCancellable) {
                client.addGeofences(request, NearbyGeofences.pending(c)).await()
                if (!NearbyGeofences.enabled(c)) client.removeGeofences(NearbyGeofences.pending(c)).await()
                else NearbyGeofences.status(c, "Activos · ${places.size} paradas · radio aproximado de 60 m")
            }
            Result.success()
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) {
            NearbyGeofences.status(c, "No se pudieron activar los avisos. Comprueba GPS y permisos; vuelve a intentar.")
            if (runAttemptCount < 3 && NearbyGeofences.enabled(c)) Result.retry() else Result.failure()
        }
    }
}
}

class NearbyReceiver : BroadcastReceiver() {
    @SuppressLint("MissingPermission")
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != "com.visitaloja.app.NEARBY_GEOFENCE" || !NearbyGeofences.enabled(context) || !NearbyGeofences.available(context)) return
        val event = GeofencingEvent.fromIntent(intent) ?: return
        if (event.hasError()) { NearbyGeofences.status(context, "Android pausó los avisos. Abre la configuración de cercanía para reactivarlos."); return }
        if (event.geofenceTransition != Geofence.GEOFENCE_TRANSITION_DWELL) return
        val location = event.triggeringLocation ?: return
        val fix = MapFix(location.latitude, location.longitude, if (location.hasAccuracy()) location.accuracy else Float.NaN, location.elapsedRealtimeNanos / 1000000)
        val p = NearbyGeofences.prefs(context)
        val ids = event.triggeringGeofences.orEmpty().map { it.requestId }.toSet()
        val wall = System.currentTimeMillis()
        if (wall - p.getLong("lastAnyAlert", 0) in 0..60000) return
        val place = NearbyGeofences.catalog(context).filter { it.id in ids }.filter {
            NearbyPolicy.canNotify(it, fix, SystemClock.elapsedRealtime(), wall, p.getLong("catalogAt", 0), p.getLong("alert:" + it.id, -1).takeIf { v -> v >= 0 })
        }.minWithOrNull(compareBy({ NearbyPolicy.distance(fix, it) }, { it.id })) ?: return
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel(NearbyGeofences.CHANNEL, "Paradas cercanas", NotificationManager.IMPORTANCE_DEFAULT).apply { description = "Avisos voluntarios al acercarte a una parada de VisitaLoja" })
        val link = Intent(context, MainActivity::class.java).setAction(Intent.ACTION_VIEW).setData(Uri.parse(PlacePolicy.publicUrl(place)))
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        val pending = PendingIntent.getActivity(context, 600, link, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification = NotificationCompat.Builder(context, NearbyGeofences.CHANNEL).setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("Estás cerca de ${place.title}").setContentText("Descubre esta parada de VisitaLoja. Toca para verla.")
            .setContentIntent(pending).setAutoCancel(true).setOnlyAlertOnce(false).setTimeoutAfter(10 * 60 * 1000L).build()
        runCatching { NotificationManagerCompat.from(context).notify("nearby", 600, notification) }.onSuccess {
            p.edit().putLong("alert:" + place.id, wall).putLong("lastAnyAlert", wall).apply()
        }
    }
}

class NearbyBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action in setOf(Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED) && NearbyGeofences.enabled(context)) NearbyGeofences.sync(context)
    }
}
