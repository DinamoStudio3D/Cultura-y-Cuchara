package com.visitaloja.app

import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

data class PostcardFrame(val id: String, val name: String, val color: String, val overlay: String? = null)
data class PostcardSettings(val watermark: String = "VisitaLoja.com", val sample: String? = null, val message: String = "Saludos desde Loja", val frames: List<PostcardFrame> = emptyList())
data class PostcardDraft(val name: String = "", val place: String = "Loja, Ecuador", val message: String = "", val format: String = "story", val contain: Boolean = false, val zoom: Float = 1f, val x: Float = 0f, val y: Float = 0f, val rotation: Int = 0, val mirror: Boolean = false, val filter: String = "natural")
data class PostcardPlacement(val x: Float,val y: Float,val width: Float,val height: Float)
object PostcardPolicy {
    fun settings(raw: Map<String,Any?>?, custom: Map<String,Any?>?): PostcardSettings {
        val defaults=listOf(PostcardFrame("fiavl","Artes vivas","#C75214"),PostcardFrame("vintage","Postal clásica","#765C38"),PostcardFrame("cafe","Ruta del Café","#714528"),PostcardFrame("polaroid","Polaroid","#075BB2"))
        val brands=listOf(PostcardFrame("brand-nature","Loja Natural","#173D30"),PostcardFrame("brand-food","Sabores de Loja","#9A3412"),PostcardFrame("brand-memory","Recuerdo Visita Loja","#123B66"))
        val config=raw?.get("brandFrames") as? Map<*,*>
        val enabled=brands.mapNotNull { frame ->
            val row=config?.get(frame.id) as? Map<*,*>
            if(row?.get("enabled")==false)null else frame.copy(name=(row?.get("name") as? String)?.trim()?.take(40)?.takeIf(String::isNotBlank)?:frame.name,color=(row?.get("color") as? String)?.takeIf { Regex("#[0-9a-fA-F]{6}").matches(it) }?:frame.color)
        }
        val extra=(custom?.get("frames") as? List<*>)?.mapNotNull { entry ->
            val r=entry as? Map<*,*>?:return@mapNotNull null
            val id=(r["id"] as? String)?.takeIf { Regex("[a-zA-Z0-9_-]{1,100}").matches(it) }?:return@mapNotNull null
            val image=DiscoveryPolicy.media((r["img"] as? String).orEmpty())?:return@mapNotNull null
            PostcardFrame(id,(r["name"] as? String).orEmpty().take(60).ifBlank { "Marco personalizado" },"#075BB2",image)
        }?.distinctBy { it.id }?.filter { f -> (defaults+brands).none { it.id==f.id } }?.take(40)?:emptyList()
        val watermark=(raw?.get("watermark") as? String).orEmpty().trim().take(80).ifBlank { "VisitaLoja.com" }
        val currentMark=if(watermark=="VIVE LOJA • FIAVL 2026") "VISITA LOJA • FIAVL 2026" else watermark
        return PostcardSettings(currentMark,DiscoveryPolicy.media((raw?.get("sampleImg") as? String).orEmpty())?.takeUnless { it.endsWith(".svg",true) },(raw?.get("defaultMsg") as? String).orEmpty().trim().take(240).ifBlank { "Saludos desde Loja" },defaults+enabled+extra)
    }
    fun dimensions(format: String, frameWidth: Int=0, frameHeight: Int=0): Pair<Int,Int> {
        if(frameWidth>0&&frameHeight>0)return if(frameWidth>=frameHeight)1920 to max(640,(1920.0*frameHeight/frameWidth).roundToInt()) else max(640,(1920.0*frameWidth/frameHeight).roundToInt()) to 1920
        return 1080 to when(format){"square"->1080;"portrait"->1350;else->1920}
    }
    fun previewDimensions(width: Int, height: Int, maxEdge: Int = 720): Pair<Int, Int> {
        require(width > 0 && height > 0 && maxEdge > 0)
        val scale = minOf(1.0, maxEdge.toDouble() / maxOf(width, height))
        return max(1, (width * scale).roundToInt()) to max(1, (height * scale).roundToInt())
    }
    fun placement(photoWidth: Int,photoHeight: Int,width: Float,height: Float,draft: PostcardDraft): PostcardPlacement {
        require(photoWidth>0&&photoHeight>0&&width>0&&height>0)
        val scale=(if(draft.contain)min(width/photoWidth,height/photoHeight) else max(width/photoWidth,height/photoHeight))*draft.zoom.coerceIn(1f,3f)
        val w=photoWidth*scale;val h=photoHeight*scale
        return PostcardPlacement((width-w)/2+draft.x.coerceIn(-1f,1f)*kotlin.math.abs(w-width)/2,(height-h)/2+draft.y.coerceIn(-1f,1f)*kotlin.math.abs(h-height)/2,w,h)
    }
    fun draft(value: PostcardDraft)=value.copy(name=value.name.take(25),place=value.place.take(30),message=value.message.take(50),zoom=value.zoom.takeIf(Float::isFinite)?.coerceIn(1f,3f)?:1f,x=value.x.takeIf(Float::isFinite)?.coerceIn(-1f,1f)?:0f,y=value.y.takeIf(Float::isFinite)?.coerceIn(-1f,1f)?:0f,rotation=((value.rotation/90)%4+4)%4*90)
}
