package com.visitaloja.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.*
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.tasks.await
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

object PushStore {
    fun preferences(context: Context) = context.getSharedPreferences("visitaloja_push_v1", Context.MODE_PRIVATE)
    @Synchronized fun revision(context: Context) = preferences(context).getLong("revision", 0)
    @Synchronized fun owner(context: Context) = preferences(context).getString("owner", null)
    @Synchronized fun active(context: Context, uid: String?) = preferences(context).let { PushPolicy.eligible(it.getString("owner", null), uid, it.getBoolean("consent", false), it.getBoolean("active", false)) }
    @Synchronized fun current(context: Context, uid: String, revision: Long) = preferences(context).let { it.getString("owner", null) == uid && it.getBoolean("consent", false) && it.getLong("revision", 0) == revision && FirebaseAuth.getInstance().currentUser?.uid == uid }
    @Synchronized fun begin(context: Context, uid: String): Long {
        val p = preferences(context); val next = revision(context) + 1
        val editor = p.edit().putString("owner", uid).putBoolean("consent", true).putBoolean("active", false).putLong("revision", next)
        if (p.getString("historyUid", null) != uid) editor.putString("history", "[]").putString("historyUid", uid)
        editor.apply(); return next
    }
    @Synchronized fun acknowledge(context: Context, uid: String, rev: Long, deviceId: String): Boolean {
        if (!current(context, uid, rev) || !PushPolicy.deviceId(deviceId)) return false
        preferences(context).edit().putBoolean("active", true).putString("deviceId", deviceId).putBoolean("needsSync", false).apply(); return true
    }
    @Synchronized fun stop(context: Context, clearHistory: Boolean = false) {
        val p = preferences(context)
        val e = p.edit().remove("owner").remove("deviceId").putBoolean("active", false).putBoolean("consent", false).putBoolean("needsReset", true).putLong("revision", revision(context) + 1)
        if (clearHistory) e.remove("historyUid").remove("history")
        e.apply()
    }
    @Synchronized fun notices(context: Context, uid: String?): List<ReceivedNotice> {
        val p = preferences(context)
        if (uid == null || uid != FirebaseAuth.getInstance().currentUser?.uid || p.getString("historyUid", null) != uid) return emptyList()
        return runCatching { JSONArray(p.getString("history", "[]")).let { a -> (0 until a.length()).mapNotNull { i ->
            val r = a.getJSONObject(i)
            PushPolicy.notice(mapOf("title" to r.optString("title"), "body" to r.optString("body"), "url" to r.optString("url")), r.optString("id"), r.optLong("at"))
        } } }.getOrDefault(emptyList())
    }
    @Synchronized fun deliver(context: Context, uid: String, notice: ReceivedNotice) {
        if (active(context, uid) && FirebaseAuth.getInstance().currentUser?.uid == uid && NativePush.allowed(context) && record(context, uid, notice)) NativePush.show(context, notice)
    }
    @Synchronized fun record(context: Context, uid: String, notice: ReceivedNotice): Boolean {
        if (!active(context, uid) || FirebaseAuth.getInstance().currentUser?.uid != uid) return false
        val rows = PushPolicy.history(notices(context, uid), notice)
        preferences(context).edit().putString("historyUid", uid).putString("history", JSONArray(rows.map { JSONObject().put("id", it.id).put("title", it.title).put("body", it.body).put("url", it.url).put("at", it.receivedAt) }).toString()).apply()
        return true
    }
}

object NativePush {
    const val channel = "visitaloja_novedades"
    const val openAction = "com.visitaloja.app.OPEN_NOTICES"
    private const val syncWork = "visitaloja-push-token-sync"
    private val mutex = Mutex()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private const val endpoint = "https://www.visitaloja.com/api/chabaquito-ranking?action=notifications"
    fun createChannel(context: Context) {
        context.getSystemService(NotificationManager::class.java).createNotificationChannel(NotificationChannel(channel, "Novedades de VisitaLoja", NotificationManager.IMPORTANCE_DEFAULT).apply { description = "Eventos, novedades y promociones que aceptaste recibir." })
    }
    fun allowed(context: Context): Boolean {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return false
        val manager = context.getSystemService(NotificationManager::class.java)
        return NotificationManagerCompat.from(context).areNotificationsEnabled() && manager.getNotificationChannel(channel)?.importance != NotificationManager.IMPORTANCE_NONE
    }
    fun stop(context: Context, clearHistory: Boolean = false) {
        PushStore.stop(context, clearHistory)
        WorkManager.getInstance(context).cancelUniqueWork(syncWork)
        NotificationManagerCompat.from(context).cancelAll()
        FirebaseMessaging.getInstance().isAutoInitEnabled = false
        scope.launch { mutex.withLock {
            if (PushStore.owner(context) == null) runCatching {
                FirebaseMessaging.getInstance().deleteToken().await()
                if (PushStore.owner(context) == null) PushStore.preferences(context).edit().putBoolean("needsReset", false).apply()
            }
        } }
    }
    fun reconcile(context: Context, uid: String?) {
        val p = PushStore.preferences(context)
        if ((PushStore.owner(context) != null && PushStore.owner(context) != uid) || (p.getString("historyUid", null) != null && p.getString("historyUid", null) != uid)) stop(context, true)
    }
    suspend fun subscribe(context: Context, uid: String, rev: Long) = mutex.withLock {
        check(PushStore.current(context, uid, rev) && allowed(context)) { "La sesión o el permiso cambiaron. Vuelve a intentarlo." }
        val messaging = FirebaseMessaging.getInstance()
        if (PushStore.preferences(context).getBoolean("needsReset", false)) {
            messaging.deleteToken().await()
            check(PushStore.current(context, uid, rev))
            PushStore.preferences(context).edit().putBoolean("needsReset", false).apply()
        }
        messaging.isAutoInitEnabled = true
        val token = messaging.token.await()
        check(PushStore.current(context, uid, rev) && allowed(context))
        val user = FirebaseAuth.getInstance().currentUser?.takeIf { it.uid == uid } ?: error("Inicia sesión nuevamente.")
        val bearer = user.getIdToken(false).await().token ?: error("Inicia sesión nuevamente.")
        check(PushStore.current(context, uid, rev))
        val response = withContext(Dispatchers.IO) { NativeApi.post(endpoint, bearer, JSONObject().put("action", "subscribe").put("token", token).put("consent", true)) }
        val id = response.optString("deviceId")
        check(response.optBoolean("active") && PushPolicy.deviceId(id)) { "No pudimos confirmar la activación. Reintenta." }
        if (!allowed(context) || !PushStore.acknowledge(context, uid, rev, id)) {
            // Roll back an acknowledged registration when consent/session changed during the request.
            withContext(NonCancellable + Dispatchers.IO) { runCatching { NativeApi.post(endpoint, bearer, JSONObject().put("action", "unsubscribe").put("deviceId", id)) } }
            error("La sesión o el permiso cambiaron.")
        }
        Unit
    }
    suspend fun unsubscribe(context: Context, uid: String, deviceId: String?) = mutex.withLock {
        if (!PushPolicy.deviceId(deviceId)) return@withLock
        val user = FirebaseAuth.getInstance().currentUser?.takeIf { it.uid == uid } ?: return@withLock
        val bearer = user.getIdToken(false).await().token ?: error("Inicia sesión nuevamente.")
        withContext(Dispatchers.IO) { NativeApi.post(endpoint, bearer, JSONObject().put("action", "unsubscribe").put("deviceId", deviceId)) }
    }
    fun enqueueSync(context: Context) {
        val uid = FirebaseAuth.getInstance().currentUser?.uid ?: return
        if (!PushStore.active(context, uid)) return
        PushStore.preferences(context).edit().putBoolean("needsSync", true).apply()
        if (!allowed(context)) return
        val work = OneTimeWorkRequestBuilder<PushTokenWorker>().setInputData(workDataOf("uid" to uid, "revision" to PushStore.revision(context)))
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS).build()
        WorkManager.getInstance(context).enqueueUniqueWork(syncWork, ExistingWorkPolicy.REPLACE, work)
    }
    @SuppressLint("MissingPermission")
    fun show(context: Context, notice: ReceivedNotice) {
        createChannel(context)
        if (!allowed(context)) return
        val intent = Intent(context, MainActivity::class.java).setAction(openAction).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        val pending = PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification = NotificationCompat.Builder(context, channel).setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(notice.title).setContentText(notice.body).setStyle(NotificationCompat.BigTextStyle().bigText(notice.body))
            .setContentIntent(pending).setAutoCancel(true).setVisibility(NotificationCompat.VISIBILITY_PRIVATE).build()
        NotificationManagerCompat.from(context).notify(notice.id, 1, notification)
    }
    fun localTest(context: Context) { show(context, ReceivedNotice("local-test", "VisitaLoja · Prueba local", "Así se mostrarán los avisos en este móvil. Esta prueba no realiza un envío desde el servidor.", "/", System.currentTimeMillis())) }
}

class PushTokenWorker(context: Context, parameters: WorkerParameters) : CoroutineWorker(context, parameters) {
    override suspend fun doWork(): Result {
        val uid = inputData.getString("uid") ?: return Result.success()
        val revision = inputData.getLong("revision", -1)
        if (!PushStore.current(applicationContext, uid, revision) || !PushStore.active(applicationContext, uid) || !NativePush.allowed(applicationContext)) return Result.success()
        return try { NativePush.subscribe(applicationContext, uid, revision); Result.success() }
        catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) { if (runAttemptCount < 3 && PushStore.current(applicationContext, uid, revision)) Result.retry() else Result.failure() }
    }
}

class VisitaLojaMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) { NativePush.enqueueSync(this) }
    override fun onMessageReceived(message: RemoteMessage) {
        val uid = FirebaseAuth.getInstance().currentUser?.uid ?: return
        if (!PushStore.active(this, uid) || !NativePush.allowed(this)) return
        val now = System.currentTimeMillis()
        if (!PushPolicy.fresh(message.sentTime, now, message.data["tag"].orEmpty())) return
        val notice = PushPolicy.notice(message.data, message.messageId ?: message.data["tag"] ?: return, now) ?: return
        PushStore.deliver(this, uid, notice)
    }
}
