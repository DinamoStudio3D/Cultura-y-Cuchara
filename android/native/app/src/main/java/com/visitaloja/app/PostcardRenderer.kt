package com.visitaloja.app

import android.content.Context
import android.graphics.*
import android.graphics.drawable.BitmapDrawable
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import coil.imageLoader
import coil.request.ImageRequest
import coil.request.SuccessResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.util.UUID

object PostcardRenderer {
    private suspend fun load(context: Context,source: Any): Bitmap {
        val result=context.imageLoader.execute(ImageRequest.Builder(context).data(source).size(1920).allowHardware(false).build())
        return ((result as? SuccessResult)?.drawable as? BitmapDrawable)?.bitmap?:error("No pudimos abrir esta imagen. Prueba otra foto o marco.")
    }
    suspend fun render(context: Context,source: Any,credit: String,frame: PostcardFrame,settings: PostcardSettings,input: PostcardDraft): Bitmap {
        val photo=load(context,source);val overlay=frame.overlay?.let { load(context,it) };val logo=load(context,R.drawable.visitaloja_logo)
        return withContext(Dispatchers.Default) {
            val draft=PostcardPolicy.draft(input)
            val transformed=if(draft.rotation!=0||draft.mirror)Bitmap.createBitmap(photo,0,0,photo.width,photo.height,Matrix().apply { postRotate(draft.rotation.toFloat());if(draft.mirror)postScale(-1f,1f) },true) else photo
            val size=PostcardPolicy.dimensions(draft.format,overlay?.width?:0,overlay?.height?:0)
            val output=Bitmap.createBitmap(size.first,size.second,Bitmap.Config.ARGB_8888)
            val canvas=Canvas(output);val w=output.width.toFloat();val h=output.height.toFloat()
            canvas.drawColor(Color.rgb(239,247,255))
            val area=if(overlay!=null)RectF(0f,0f,w,h) else RectF(32f,155f,w-32f,h-300f)
            val placement=PostcardPolicy.placement(transformed.width,transformed.height,area.width(),area.height(),draft)
            val paint=Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
            if(draft.filter=="mono")paint.colorFilter=ColorMatrixColorFilter(ColorMatrix().apply { setSaturation(0f) })
            if(draft.filter=="sepia")paint.colorFilter=ColorMatrixColorFilter(ColorMatrix(floatArrayOf(.393f,.769f,.189f,0f,0f,.349f,.686f,.168f,0f,0f,.272f,.534f,.131f,0f,0f,0f,0f,0f,1f,0f)))
            canvas.save();canvas.clipRect(area)
            canvas.drawBitmap(transformed,null,RectF(area.left+placement.x,area.top+placement.y,area.left+placement.x+placement.width,area.top+placement.y+placement.height),paint);canvas.restore();paint.colorFilter=null
            if(overlay!=null)canvas.drawBitmap(overlay,null,RectF(0f,0f,w,h),paint) else {
                paint.color=Color.parseColor(frame.color);canvas.drawRect(0f,0f,w,145f,paint)
                val logoScale=minOf(109f/logo.width,109f/logo.height)
                val logoWidth=logo.width*logoScale;val logoHeight=logo.height*logoScale
                canvas.drawBitmap(logo,null,RectF(84.5f-logoWidth/2,72.5f-logoHeight/2,84.5f+logoWidth/2,72.5f+logoHeight/2),paint)
                text(canvas,settings.watermark,165f,40f,(w-195).toInt(),38f,Color.WHITE,1,true)
                text(canvas,frame.name,165f,90f,(w-195).toInt(),25f,Color.WHITE,1,false)
                paint.style=Paint.Style.STROKE;paint.strokeWidth=8f;canvas.drawRect(area,paint);paint.style=Paint.Style.FILL
                text(canvas,draft.message.ifBlank { settings.message },42f,h-270f,(w-84).toInt(),44f,Color.rgb(23,45,69),2,true)
                text(canvas,listOf(draft.name,draft.place).filter(String::isNotBlank).joinToString(" · "),42f,h-142f,(w-84).toInt(),28f,Color.rgb(23,45,69),2,false)
            }
            paint.color=Color.argb(220,16,36,58);canvas.drawRect(0f,h-68f,w,h,paint)
            text(canvas,"VisitaLoja.com · $credit",20f,h-60f,(w-40).toInt(),20f,Color.WHITE,2,false)
            output
        }
    }
    private fun text(canvas: Canvas,value: String,x: Float,y: Float,width: Int,size: Float,color: Int,lines: Int,bold: Boolean) {
        val paint=TextPaint(Paint.ANTI_ALIAS_FLAG).apply { textSize=size;this.color=color;typeface=if(bold)Typeface.create("sans-serif",Typeface.BOLD) else Typeface.create("sans-serif",Typeface.NORMAL) }
        val layout=StaticLayout.Builder.obtain(value,0,value.length,paint,width).setAlignment(Layout.Alignment.ALIGN_NORMAL).setMaxLines(lines).setEllipsize(android.text.TextUtils.TruncateAt.END).setIncludePad(false).build()
        canvas.save();canvas.translate(x,y);layout.draw(canvas);canvas.restore()
    }
    suspend fun shareFile(context: Context,bitmap: Bitmap): File=withContext(Dispatchers.IO) {
        val dir=File(context.cacheDir,"postcards").apply { mkdirs() }
        dir.listFiles()?.filter { it.isFile&&it.name.startsWith("postal-")&&System.currentTimeMillis()-it.lastModified()>86_400_000 }?.forEach { it.delete() }
        File(dir,"postal-${UUID.randomUUID()}.png").also { file -> file.outputStream().use { check(bitmap.compress(Bitmap.CompressFormat.PNG,100,it)) { "No pudimos generar la postal." } } }
    }
}
