package com.visitaloja.app

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.provider.CalendarContract
import android.widget.Toast
import java.time.Instant
import java.time.format.DateTimeFormatter
import java.util.Locale

internal object EventActionPolicy {
    fun end(start: Long, durationMinutes: Long?): Long? = durationMinutes?.takeIf { it in 1L..1440L }?.let { start + it * 60_000 }
    fun share(title: String, start: Long, location: String, url: String): String {
        val date = DateTimeFormatter.ofPattern("EEE d MMM yyyy · HH:mm", Locale.forLanguageTag("es-EC"))
            .withZone(AgendaPolicy.zone).format(Instant.ofEpochMilli(start))
        return listOf(title, "$date · Hora de Loja, Ecuador", location, url).filter(String::isNotBlank).joinToString("\n")
    }
}
internal object EventActions {
    private fun launch(context: Context, intent: Intent) {
        try { context.startActivity(intent) }
        catch (_: ActivityNotFoundException) { Toast.makeText(context, "No hay una aplicación compatible disponible.", Toast.LENGTH_LONG).show() }
    }
    fun calendar(context: Context, title: String, description: String, location: String, start: Long, durationMinutes: Long? = null) {
        launch(context, Intent(Intent.ACTION_INSERT, CalendarContract.Events.CONTENT_URI).apply {
            putExtra(CalendarContract.Events.TITLE, title)
            putExtra(CalendarContract.Events.DESCRIPTION, description)
            putExtra(CalendarContract.Events.EVENT_LOCATION, location)
            putExtra(CalendarContract.Events.EVENT_TIMEZONE, AgendaPolicy.zone.id)
            putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, start)
            EventActionPolicy.end(start, durationMinutes)?.let { putExtra(CalendarContract.EXTRA_EVENT_END_TIME, it) }
        })
    }
    fun share(context: Context, title: String, start: Long, location: String, url: String) {
        launch(context, Intent.createChooser(Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, title)
            putExtra(Intent.EXTRA_TEXT, EventActionPolicy.share(title, start, location, url))
        }, "Compartir actividad"))
    }
}
