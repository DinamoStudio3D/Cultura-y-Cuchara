package com.visitaloja.app

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.io.IOException
import java.nio.file.Files

class PlacesTest {
    private val cafe = Place("cafe-1", "Expreso al Sur", listOf("cafe"), "Sector Jipiro, Loja", "Café y sabores locales", "https://example.test/cafe.webp")
    private fun document(id: String, status: String = "published") = JSONObject("""{"name":"projects/cultura-y-cuchara/databases/(default)/documents/locales/$id","fields":{"title":{"stringValue":"Café de Loja"},"category":{"stringValue":"cafe"},"publicationStatus":{"stringValue":"$status"},"description":{"stringValue":"<b>Visítanos</b>"},"gallery":{"arrayValue":{"values":[{"mapValue":{"fields":{"img":{"stringValue":"javascript:alert(1)"}}}},{"mapValue":{"fields":{"img":{"stringValue":"https://example.test/photo.webp"}}}}]}}}}""")
    private fun cache() = File(Files.createTempDirectory("visitaloja-test").toFile().apply { deleteOnExit() }, "places.json")
    @Test fun hiddenAndInactivePlacesNeverAppear() {
        assertTrue(PlacePolicy.published(cafe))
        for (status in listOf("hidden", "draft", "archived", "inactive", "deleted")) assertFalse(PlacePolicy.published(cafe.copy(status = status)))
        assertFalse(PlacePolicy.published(cafe.copy(active = false)))
        assertFalse(PlacePolicy.published(cafe.copy(publicationStatus = "draft")))
        assertFalse(PlacePolicy.published(cafe.copy(title = "")))
    }
    @Test fun categoriesAliasesAndAccentsWorkTogether() {
        assertTrue(PlacePolicy.matches(cafe, "cafeterías en Loja", "cafe"))
        assertTrue(PlacePolicy.matches(cafe, "expreso al sur", "food"))
        assertFalse(PlacePolicy.matches(cafe, "hotel", "hotel"))
        assertFalse(PlacePolicy.matches(cafe, "inexistente", "all"))
        assertTrue(PlacePolicy.matches(cafe.copy(categories = listOf("hostal")), category = "hotel"))
    }
    @Test fun parsingUsesOnlyPublishedPublicFieldsAndSafeImages() {
        val source = document("real-id")
        source.getJSONObject("fields").put("customerEmail", JSONObject().put("stringValue", "private@example.test"))
        val result = PlaceJson.document(source)!!
        assertEquals("real-id", result.id)
        assertEquals("Visítanos", result.description)
        assertEquals("https://example.test/photo.webp", result.imageUrl)
        assertNull(PlaceJson.document(document("hidden-id", "draft")))
        assertFalse(PlaceJson.cachePlace(result).toString().contains("customerEmail"))
        assertFalse(PlaceJson.cachePlace(result).toString().contains("private@example.test"))
    }
    @Test fun unsafeImagesAndCoordinatesAreRejected() {
        for (url in listOf("http://example.test/a", "javascript:alert(1)", "file:///etc/passwd", "https://user:pass@example.test/a", "not a url")) assertNull(PlacePolicy.safeImage(url))
        assertEquals("https://example.test/photo.webp", PlacePolicy.safeImage("https://example.test/photo.webp"))
        assertNull(PlacePolicy.safeCoordinate(Double.NaN, true))
        assertNull(PlacePolicy.safeCoordinate(91.0, true))
        assertNull(PlacePolicy.safeCoordinate(-181.0, false))
        assertEquals(0.0, PlacePolicy.safeCoordinate(0.0, true)!!, 0.0)
    }
    @Test fun paginatedLoadDoesNotLoseRecordsAndCachesOnlyProjection() {
        val file = cache(); val requests = mutableListOf<String>()
        val repository = PlacesRepository(file, { url -> requests.add(url); if (requests.size == 1) JSONObject().put("documents", listOf(document("one"))).put("nextPageToken", "next/page").toString() else JSONObject().put("documents", listOf(document("two"), document("draft", "draft"))).toString() }, { 1800000000000 })
        val result = repository.load()
        assertEquals(listOf("one", "two"), result.places.map(Place::id))
        assertFalse(result.offline)
        assertEquals(2, requests.size)
        assertTrue(requests.last().contains("pageToken=next%2Fpage"))
        assertFalse(file.readText().contains("mapValue"))
    }
    @Test fun offlineFallsBackToRecentCopyWithItsOriginalDate() {
        val file = cache(); val time = 1800000000000L
        PlacesRepository(file, { JSONObject().put("documents", listOf(document("one"))).toString() }, { time }).load()
        val offline = PlacesRepository(file, { throw IOException("offline") }, { time + 1000 }).load()
        assertTrue(offline.offline)
        assertEquals(time, offline.savedAt)
        assertEquals("one", offline.places.single().id)
    }
    @Test fun oldOrInvalidCopiesAreNotSilentlyPresented() {
        val file = cache(); val time = 1800000000000L
        PlacesRepository(file, { JSONObject().put("documents", listOf(document("one"))).toString() }, { time }).load()
        try { PlacesRepository(file, { throw IOException("offline") }, { time + 604800001 }).load(); fail("Expired copy should fail") } catch (_: IOException) { }
        file.writeText("broken json")
        try { PlacesRepository(file, { throw IOException("offline") }, { time + 1000 }).load(); fail("Broken copy should fail") } catch (_: IOException) { }
    }
    @Test fun emptyFreshDataReplacesAnOlderDirectory() {
        val file = cache()
        PlacesRepository(file, { JSONObject().put("documents", listOf(document("one"))).toString() }, { 1800000000000 }).load()
        assertTrue(PlacesRepository(file, { "{}" }, { 1800000001000 }).load().places.isEmpty())
        assertTrue(PlacesRepository(file, { throw IOException("offline") }, { 1800000002000 }).load().places.isEmpty())
    }
    @Test fun paginationLoopFailsInsteadOfReturningAnIncompleteDirectory() {
        val repository = PlacesRepository(cache(), { JSONObject().put("documents", listOf(document("one"))).put("nextPageToken", "same").toString() })
        try { repository.load(); fail("Repeated token must fail") } catch (_: IOException) { }
    }
    @Test fun accessDenialDoesNotFallBackToCache() {
        val file = cache()
        PlacesRepository(file, { JSONObject().put("documents", listOf(document("one"))).toString() }, { 1800000000000 }).load()
        try { PlacesRepository(file, { throw SecurityException("denied") }, { 1800000001000 }).load(); fail("Denied access must fail") } catch (_: SecurityException) { }
    }
}
