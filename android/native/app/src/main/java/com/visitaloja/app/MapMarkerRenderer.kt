package com.visitaloja.app

import android.content.Context
import android.graphics.*

/** Shared web marker vocabulary, drawn at an explicit 3x density (48 dp face). */
class MapMarkerRenderer(context: Context) {
    private val font = Typeface.createFromAsset(context.assets, "fa-solid-900.ttf")
    fun render(place: Place, logo: Bitmap? = null): Bitmap {
        val bitmap = Bitmap.createBitmap(192, 192, Bitmap.Config.ARGB_8888).apply { density = 480 }
        val canvas = Canvas(bitmap)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        val color = Color.parseColor(MapPolicy.color(MapPolicy.kind(place)))
        paint.color = color; paint.alpha = 42; canvas.drawCircle(96f, 96f, 88f, paint)
        paint.alpha = 255; paint.color = Color.argb(36, 0, 0, 0); canvas.drawCircle(96f, 102f, 78f, paint)
        paint.color = if (logo != null) Color.WHITE else if (MapPolicy.kind(place) == "partner") Color.rgb(109, 40, 217) else Color.rgb(15, 35, 58)
        canvas.drawCircle(96f, 96f, 74f, paint)
        if (logo != null) {
            canvas.save(); canvas.clipPath(Path().apply { addCircle(96f, 96f, 65f, Path.Direction.CW) })
            val scale = minOf(122f / logo.width, 122f / logo.height)
            val w = logo.width * scale; val h = logo.height * scale
            canvas.drawBitmap(logo, null, RectF(96f - w / 2, 96f - h / 2, 96f + w / 2, 96f + h / 2), Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG))
            canvas.restore()
        } else {
            paint.color = if (MapPolicy.kind(place) == "partner") Color.WHITE else color
            paint.typeface = font; paint.textSize = 62f; paint.textAlign = Paint.Align.CENTER
            val baseline = 96f - (paint.fontMetrics.ascent + paint.fontMetrics.descent) / 2f
            canvas.drawText(MapPolicy.glyph(place), 96f, baseline, paint)
        }
        paint.style = Paint.Style.STROKE; paint.strokeWidth = 9f; paint.color = color
        canvas.drawCircle(96f, 96f, 74f, paint)
        return bitmap
    }
}
