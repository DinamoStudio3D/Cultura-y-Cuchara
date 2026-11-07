package com.visitaloja.app

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class SupportersPolicyTest {
    private fun text(value: String)=JSONObject().put("stringValue",value)
    private fun map(value: JSONObject)=JSONObject().put("mapValue",JSONObject().put("fields",value))
    private fun fields(plan: String="premium",status: String="active")=JSONObject().put("title",text("Café de Loja")).put("customLogoUrl",text("assets/brand/codeproim.png")).put("subscription",map(JSONObject().put("plan",text(plan)).put("status",text(status))))
    private fun sub(f: JSONObject)=f.getJSONObject("subscription").getJSONObject("mapValue").getJSONObject("fields")
    private fun place(f: JSONObject=fields())=PlaceJson.document(JSONObject().put("name","projects/p/databases/(default)/documents/locales/p1").put("fields",f))!!
    private val now=Instant.parse("2026-10-29T16:00:00Z").toEpochMilli()
    @Test fun onlyCurrentPaidPublishedBusinessesAppearWithoutNeedingTheMapLogoBenefit() {
        assertTrue(SupportersPolicy.eligible(place(),now))
        for(plan in listOf("","free"," FREE ","gratis","Gratuito"))assertFalse(plan,SupportersPolicy.eligible(place(fields(plan=plan)),now))
        for(status in listOf("paused","pending","expired","suspended","unknown"))assertFalse(status,SupportersPolicy.eligible(place(fields(status=status)),now))
        assertTrue(SupportersPolicy.eligible(place(fields(status=" PAID ")),now))
        val f=fields();sub(f).remove("status");assertTrue(SupportersPolicy.eligible(place(f),now))
        assertFalse(SupportersPolicy.eligible(place().copy(publicationStatus="draft"),now))
        f.put("hidden",JSONObject().put("booleanValue",true));assertFalse(SupportersPolicy.eligible(place(f),now))
        f.remove("hidden");f.put("published",JSONObject().put("booleanValue",false));assertFalse(SupportersPolicy.eligible(place(f),now))
    }
    @Test fun inclusiveEcuadorDayWindowsAndTimestampExpirationAreRespected() {
        val f=fields();sub(f).put("startDate",text("2026-10-29")).put("endDate",text("2026-10-29"));val p=place(f)
        fun eligible(at:String)=SupportersPolicy.eligible(p,Instant.parse(at).toEpochMilli())
        assertFalse(eligible("2026-10-29T04:59:59Z"));assertTrue(eligible("2026-10-29T05:00:00Z"))
        assertTrue(eligible("2026-10-30T04:59:59.999Z"));assertFalse(eligible("2026-10-30T05:00:00Z"))
        sub(f).put("endAt",JSONObject().put("timestampValue","2026-10-29T16:00:00Z"));assertTrue(SupportersPolicy.eligible(place(f),now));assertFalse(SupportersPolicy.eligible(place(f),now+1))
    }
    @Test fun malformedUnsupportedAndInvertedWindowsFailClosed() {
        for(raw in listOf(text("broken"),text("   "),JSONObject().put("mapValue",JSONObject()))) {val f=fields();sub(f).put("startAt",raw);assertFalse(SupportersPolicy.eligible(place(f),now))}
        val f=fields();sub(f).put("startDate",text("2027-01-01")).put("endDate",text("2026-01-01"));assertFalse(SupportersPolicy.eligible(place(f),now))
    }
    @Test fun configuredSelectionExclusionsAndOrderingMatchTheWeb() {
        val a=place();val b=a.copy(id="b",title="B");val c=a.copy(id="c",title="C")
        val config=SupportConfig(includeMesa=false,excludedIds=listOf("b"),orderIds=listOf("c","p1"))
        assertEquals(listOf("c","p1"),SupportersPolicy.entries(listOf(a,b,c,a),config,now,true).map{it.id})
        val selected=config.copy(selected=true,selectedIds=listOf("b","p1"),orderIds=listOf("b"))
        assertEquals(listOf("b","p1"),SupportersPolicy.entries(listOf(a,b,c),selected,now,true).map{it.id})
        assertTrue(SupportersPolicy.entries(listOf(a),config.copy(selected=true),now,true).isEmpty())
    }
    @Test fun mesaIsOptionalIndependentAndNeverDuplicatedWithTheReservedKey() {
        val config=SupportConfig()
        val rows=SupportersPolicy.entries(listOf(place(),place().copy(id=SupportersPolicy.mesaId)),config,now,true)
        assertEquals(2,rows.size);assertTrue(rows.last().institution);assertEquals("Mesa Turística de Loja",rows.last().name)
        assertEquals(1,SupportersPolicy.entries(emptyList(),config,now,true).size)
        assertTrue(SupportersPolicy.entries(emptyList(),config.copy(includeMesa=false),now,true).isEmpty())
    }
    @Test fun offlineAndHiddenSectionsDoNotAdvertiseOldParticipationAndCacheDoesNotPersistIt() {
        val p=place();assertTrue(SupportersPolicy.entries(listOf(p),SupportConfig(),now,false).isEmpty())
        assertTrue(SupportersPolicy.entries(listOf(p),SupportConfig(active=false),now,true).isEmpty())
        val cached=PlaceJson.cached(PlaceJson.cachePlace(p))!!;assertEquals(SupportPlan(),cached.support);assertFalse(SupportersPolicy.eligible(cached,now))
    }
    @Test fun configurationPreservesPanelControlsWithBoundedStableDefaults() {
        assertEquals(SupportConfig(),SupportersPolicy.config(emptyMap()))
        assertEquals("Our supporters",SupportersPolicy.config(mapOf("title" to "", "titleEn" to "Our supporters")).title)
        assertEquals("Thank you",SupportersPolicy.config(mapOf("subtitle" to "", "subtitleEn" to "Thank you")).subtitle)
        val c=SupportersPolicy.config(mapOf("title" to "Marcas que ya trabajan con nosotros","includeMesa" to false,"motion" to false,"clickable" to false,"showNames" to true,"mode" to "selected","selectedIds" to listOf("b","b",1),"orderIds" to listOf("b","a"),"size" to "large","duration" to 500,"direction" to "right","pauseOnHover" to false))
        assertEquals(SupportersPolicy.title,c.title);assertFalse(c.includeMesa);assertFalse(c.motion);assertFalse(c.clickable);assertTrue(c.showNames);assertTrue(c.selected);assertEquals(listOf("b"),c.selectedIds);assertEquals(listOf("b","a"),c.orderIds);assertEquals(120,c.duration);assertTrue(c.right);assertFalse(c.pauseOnHover)
    }
    @Test fun logoUsesOnlySafeConfiguredSourcesAndNeverInventsABusinessLogo() {
        assertEquals("https://www.visitaloja.com/assets/brand/codeproim.png",place().support.logo)
        val f=fields();f.put("customLogoUrl",text("logo mesa turistica.webp"));assertEquals("https://www.visitaloja.com/logo%20mesa%20turistica.webp",place(f).support.logo)
        for(url in listOf("javascript:bad","file:///secret","https://user:password@evil.example/logo.png")){f.put("customLogoUrl",text(url));assertNull(place(f).support.logo)}
    }
}
