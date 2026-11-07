package com.visitaloja.app

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class MissionPolicyTest {
    private val mission = mapOf<String,Any?>("title" to "Descubre Loja", "description" to "Visita nuevos lugares", "status" to "active", "type" to "unique_places", "targetCount" to 3, "badge" to mapOf("title" to "Explorador", "icon" to "🏅"))
    @Test fun publicationTargetsAndWindowBoundariesAreRespected() {
        assertNull(MissionPolicy.mission("id",mission+("status" to "draft")))
        assertNull(MissionPolicy.mission("id",mission+("status" to "paused")))
        assertNull(MissionPolicy.mission("id",mission+("targetCount" to 0)))
        assertNull(MissionPolicy.mission("id",mission+("targetCount" to 501)))
        assertNull(MissionPolicy.mission("id",mission+("targetCount" to 2.5)))
        assertNull(MissionPolicy.mission("id",mission+("startsAt" to "bad-date")))
        val m=MissionPolicy.mission("id",mission+mapOf("startsAt" to 100L,"endsAt" to 200L))!!
        assertEquals("upcoming",MissionPolicy.window(m,99));assertEquals("available",MissionPolicy.window(m,100));assertEquals("available",MissionPolicy.window(m,200));assertEquals("ended",MissionPolicy.window(m,201))
    }
    @Test fun scopesRequireTheConfigurationUsedByTheServer() {
        for(type in listOf("place_visits","category_visits","canton_visits")) assertNull(MissionPolicy.mission("id",mission+("type" to type)))
        assertNotNull(MissionPolicy.mission("id",mission+mapOf("type" to "place_visits","placeIds" to listOf("place"))))
    }
    @Test fun privateProgressAndBadgesRejectAnotherUserAndInvalidCounters() {
        val raw=mapOf("missionId" to "id","userId" to "alice","current" to 3,"target" to 3,"completed" to true)
        assertNull(MissionPolicy.progress(raw,"bob"));assertNull(MissionPolicy.progress(raw,""))
        assertTrue(MissionPolicy.progress(raw,"alice")!!.completed)
        assertFalse(MissionPolicy.progress(raw+mapOf("current" to 2),"alice")!!.completed)
        assertFalse(MissionPolicy.progress(raw+mapOf("completed" to false),"alice")!!.completed)
        assertNull(MissionPolicy.progress(raw+mapOf("current" to 4),"alice"))
        val badge=raw+mapOf("source" to "chabaquito_mission_v2","badge" to mapOf("title" to "Insignia"))
        assertNull(MissionPolicy.reward(badge,"bob"));assertNotNull(MissionPolicy.reward(badge,"alice"));assertNull(MissionPolicy.reward(badge+mapOf("revoked" to true),"alice"))
    }
    @Test fun latestServerRevocationWinsOverAnOlderCompletedProjection() {
        val old=MissionProgress("id",3,3,true,100)
        val revoked=MissionProgress("id",2,3,false,200)
        assertEquals(revoked,MissionPolicy.progressIndex(listOf(revoked,old))["id"])
        assertEquals(revoked.copy(updated=100),MissionPolicy.progressIndex(listOf(old,revoked.copy(updated=100)))["id"])
    }
    @Test fun xpLevelsMatchTheWebAndDoNotInventCompletionXp() {
        assertEquals(1,MissionPolicy.level(499).number);assertEquals(2,MissionPolicy.level(500).number)
        assertEquals(1000L,MissionPolicy.level(500).remaining)
        assertEquals(0.5f,MissionPolicy.level(1000).fraction,0.001f)
        assertEquals(8,MissionPolicy.level(20000).number);assertTrue(MissionPolicy.level(20000).maximum)
        val profile=MissionPolicy.profile(mapOf("validatedXp" to 500,"totalXp" to 999999,"email" to "private@test.invalid"))
        assertEquals(500L,profile.xp);assertFalse(profile.joined)
    }
    @Test fun rankingIsAliasOnlyAndRequiresValidPublishedNumbers() {
        val row=MissionPolicy.rank("public-id",mapOf("alias" to "Explorador","xp" to 500,"email" to "secret@test.invalid","userId" to "private"))!!
        assertEquals("Explorador",row.alias);assertEquals(2,row.level)
        assertFalse(row.toString().contains("secret"));assertFalse(row.toString().contains("userId"))
        assertNull(MissionPolicy.rank("id",mapOf("alias" to "<script>","xp" to 20)))
        assertFalse(MissionPolicy.validAlias("bad\nname"));assertFalse(MissionPolicy.validAlias(" "));assertFalse(MissionPolicy.validAlias("x".repeat(41)))
        assertTrue(MissionPolicy.validAlias("Explorador de Loja"))
    }
    @Test fun relatedPlacesExcludeDraftsAndUseDeclaredCategoryAndCanton() {
        val cafe=Place("p","Café",listOf("cafe"),"","",null,missionCategory="cafe",missionCanton="loja")
        val rows=listOf(cafe,cafe.copy(id="hidden",publicationStatus="draft"),cafe.copy(id="unknown",missionCanton=null),cafe.copy(id="other",missionCategory="hotel",missionCanton="catamayo"))
        val canton=MissionPolicy.mission("id",mission+mapOf("type" to "canton_visits","cantonIds" to listOf("loja")))!!
        assertEquals(listOf("p"),MissionPolicy.eligible(canton,rows).map{it.id})
        val category=MissionPolicy.mission("id",mission+mapOf("type" to "category_visits","categoryIds" to listOf("cafe")))!!
        assertEquals(listOf("p","unknown"),MissionPolicy.eligible(category,rows).map{it.id})
        val place=MissionPolicy.mission("id",mission+mapOf("type" to "place_visits","placeIds" to listOf("p")))!!
        assertEquals(listOf(cafe),MissionPolicy.eligible(place,rows))
    }
    @Test fun legacyCacheDoesNotTurnDefaultLojaIntoMissionEligibility() {
        val raw=JSONObject("""{"name":"projects/test/documents/locales/p","fields":{"title":{"stringValue":"Lugar"},"publicationStatus":{"stringValue":"published"},"category":{"stringValue":"cafe"}}}""")
        val place=PlaceJson.document(raw)!!
        assertEquals("loja",place.cantonId);assertNull(place.missionCanton);assertEquals("cafe",place.missionCategory)
        assertEquals(place,PlaceJson.cached(PlaceJson.cachePlace(place)))
        val old=PlaceJson.cachePlace(place).apply { remove("missionCanton");remove("missionCategory") }
        assertNull(PlaceJson.cached(old)!!.missionCanton);assertNull(PlaceJson.cached(old)!!.missionCategory)
    }
    @Test fun categoryArraysMatchTheBackendStringConversionInsteadOfFirstCategory() {
        val raw=JSONObject("""{"name":"projects/test/documents/locales/p","fields":{"title":{"stringValue":"Lugar"},"category":{"arrayValue":{"values":[{"stringValue":"cafe"},{"stringValue":"turismo"}]}},"cantonId":{"stringValue":"loja"}}}""")
        val place=PlaceJson.document(raw)!!
        assertEquals("cafe,turismo",place.missionCategory)
        val cafeMission=MissionPolicy.mission("id",mission+mapOf("type" to "category_visits","categoryIds" to listOf("cafe")))!!
        assertTrue(MissionPolicy.eligible(cafeMission,listOf(place)).isEmpty())
    }
}
