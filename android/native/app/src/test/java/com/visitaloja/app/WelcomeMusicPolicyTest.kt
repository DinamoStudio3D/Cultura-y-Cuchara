package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test

class WelcomeMusicPolicyTest {
    @Test fun defaultMatchesWebsiteRecordingAndLowVolume() {
        val c=WelcomeMusicPolicy.read(emptyMap());assertTrue(c.enabled);assertEquals(WelcomeMusicPolicy.DEFAULT_URL,c.url);assertEquals(.2f,c.volume,0f)
    }
    @Test fun respectsDisabledSettingAndCanonicalRelativeRecording() {
        val c=WelcomeMusicPolicy.read(mapOf("welcomeMusicEnabled" to false,"welcomeMusicUrl" to "audios/other.mp3"));assertFalse(c.enabled);assertEquals("https://www.visitaloja.com/audios/other.mp3",c.url)
    }
    @Test fun unsafeOrBlankRecordingsDoNotEnablePlayback() {
        listOf("javascript:alert(1)","http://example.com/a.mp3","//example.com/a.mp3","https://user:secret@example.com/a.mp3","   ","https://example.com/a b.mp3").forEach { assertFalse(it,WelcomeMusicPolicy.read(mapOf("welcomeMusicUrl" to it)).enabled) }
        assertFalse(WelcomeMusicPolicy.read(mapOf("welcomeMusicUrl" to 12)).enabled)
    }
    @Test fun volumeIsFiniteAndClampedIncludingNumericStrings() {
        assertEquals(1f,WelcomeMusicPolicy.read(mapOf("welcomeMusicVolume" to 3)).volume,0f);assertEquals(0f,WelcomeMusicPolicy.read(mapOf("welcomeMusicVolume" to -1)).volume,0f)
        assertEquals(.35f,WelcomeMusicPolicy.read(mapOf("welcomeMusicVolume" to "0.35")).volume,0f)
        listOf("NaN",Float.POSITIVE_INFINITY,"bad").forEach {assertEquals(.2f,WelcomeMusicPolicy.read(mapOf("welcomeMusicVolume" to it)).volume,0f)}
    }
    @Test fun playbackRequiresConfirmedEnabledConfiguration() {
        val c=PublicContent(WelcomeMusicPolicy.read(emptyMap()),loading=false);assertTrue(WelcomeMusicPolicy.confirmed(c))
        assertFalse(WelcomeMusicPolicy.confirmed(c.copy(cached=true)));assertFalse(WelcomeMusicPolicy.confirmed(c.copy(error=true)));assertFalse(WelcomeMusicPolicy.confirmed(c.copy(loading=true)));assertFalse(WelcomeMusicPolicy.confirmed(PublicContent(WelcomeMusicConfig(),loading=false)))
    }
    @Test fun mediaAndMapAndOverlaysSuppressWelcomeMusic() {
        listOf("map","videos","time","podcast","stories").forEach {assertTrue(WelcomeMusicPolicy.blocked(it,false))}
        assertTrue(WelcomeMusicPolicy.blocked("home",true));assertFalse(WelcomeMusicPolicy.blocked("home",false));assertFalse(WelcomeMusicPolicy.blocked("photos",false))
    }
}
