package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test

class PostcardPolicyTest {
    @Test fun formatsExportAtKnownPixelSizes(){
        assertEquals(1080 to 1920,PostcardPolicy.dimensions("story"));assertEquals(1080 to 1350,PostcardPolicy.dimensions("portrait"));assertEquals(1080 to 1080,PostcardPolicy.dimensions("square"))
    }
    @Test fun customFramesUseTheirOwnAspectRatioWithBoundedDimensions(){
        assertEquals(1920 to 960,PostcardPolicy.dimensions("story",2000,1000));assertEquals(960 to 1920,PostcardPolicy.dimensions("square",1000,2000))
        assertEquals(1920 to 640,PostcardPolicy.dimensions("story",100000,1))
    }
    @Test fun coverFillsThePhotoArea(){
        val p=PostcardPolicy.placement(1000,500,500f,500f,PostcardDraft())
        assertEquals(1000f,p.width,.001f);assertEquals(500f,p.height,.001f);assertEquals(-250f,p.x,.001f)
    }
    @Test fun containPreservesTheWholeImage(){
        val p=PostcardPolicy.placement(1000,500,500f,500f,PostcardDraft(contain=true))
        assertEquals(500f,p.width,.001f);assertEquals(250f,p.height,.001f);assertEquals(125f,p.y,.001f)
    }
    @Test fun panAndZoomAreBounded(){
        val p=PostcardPolicy.placement(1000,1000,500f,500f,PostcardDraft(zoom=9f,x=9f,y=-9f))
        assertEquals(1500f,p.width,.001f);assertEquals(0f,p.x,.001f);assertEquals(-1000f,p.y,.001f)
    }
    @Test fun invalidDraftValuesAreNormalized(){
        val d=PostcardPolicy.draft(PostcardDraft(name="a".repeat(40),place="b".repeat(40),message="c".repeat(80),zoom=Float.NaN,x=Float.POSITIVE_INFINITY,rotation=-90))
        assertEquals(25,d.name.length);assertEquals(30,d.place.length);assertEquals(50,d.message.length);assertEquals(1f,d.zoom,.001f);assertEquals(0f,d.x,.001f);assertEquals(270,d.rotation)
    }
    @Test fun adminCanDisableAndRenameBrandedFrames(){
        val settings=PostcardPolicy.settings(mapOf("brandFrames" to mapOf("brand-nature" to mapOf("enabled" to false),"brand-memory" to mapOf("name" to "Mi Loja","color" to "#ABCDEF"))),null)
        assertFalse(settings.frames.any {it.id=="brand-nature"});assertEquals("Mi Loja",settings.frames.first {it.id=="brand-memory"}.name);assertEquals("#ABCDEF",settings.frames.first {it.id=="brand-memory"}.color)
    }
    @Test fun customFramesRejectUnsafeImagesAndDuplicateBuiltins(){
        val settings=PostcardPolicy.settings(null,mapOf("frames" to listOf(mapOf("id" to "custom","name" to "Festival","img" to "https://i.imgur.com/frame.png"),mapOf("id" to "bad","img" to "javascript:alert(1)"),mapOf("id" to "fiavl","img" to "https://i.imgur.com/frame.png"))))
        assertEquals(1,settings.frames.count {it.id=="custom"});assertFalse(settings.frames.any {it.id=="bad"});assertEquals(1,settings.frames.count {it.id=="fiavl"})
    }
    @Test fun legacyDefaultMarkIsUpdatedWithoutChangingCustomBranding(){
        assertEquals("VISITA LOJA • FIAVL 2026",PostcardPolicy.settings(mapOf("watermark" to "VIVE LOJA • FIAVL 2026"),null).watermark)
        assertEquals("Mi recuerdo de Loja",PostcardPolicy.settings(mapOf("watermark" to "Mi recuerdo de Loja"),null).watermark)
    }
    @Test fun adminSampleAndGreetingUseSafeBoundedValues(){
        val s=PostcardPolicy.settings(mapOf("sampleImg" to "file:///private/photo.png","defaultMsg" to "x".repeat(80)),null)
        assertNull(s.sample);assertEquals(80,s.message.length)
        assertEquals(240,PostcardPolicy.settings(mapOf("defaultMsg" to "x".repeat(500)),null).message.length)
    }
}
