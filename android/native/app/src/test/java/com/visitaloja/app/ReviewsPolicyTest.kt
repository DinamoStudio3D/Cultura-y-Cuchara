package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test
import java.util.Date

class ReviewsPolicyTest {
    private val raw = mapOf<String, Any?>("placeId" to "place", "userId" to "user", "status" to "published", "userName" to "Juan", "rating" to 4L, "comment" to "Muy buena atención", "updatedAt" to Date(1000))
    @Test fun publicProjectionRequiresPublishedMatchingPlaceAndValidRating() {
        val review = ReviewsPolicy.read("user_place", raw, "place")!!
        assertEquals(4, review.rating);assertEquals(1000L, review.updated);assertTrue(review.published)
        for (patch in listOf(mapOf("placeId" to "other"), mapOf("status" to "hidden"), mapOf("rating" to 0), mapOf("rating" to 6), mapOf("rating" to 3.5), mapOf("comment" to "x"))) assertNull(ReviewsPolicy.read("id", raw + patch, "place"))
        assertFalse(ReviewsPolicy.read("id", raw + mapOf("status" to "hidden"), "place", false)!!.published)
    }
    @Test fun validationBoundsPublicAuthorStarsAndComment() {
        assertNull(ReviewsPolicy.error("Nombre", 5, "Experiencia"))
        for ((name, rating, comment) in listOf(Triple("", 5, "Bien"), Triple("x".repeat(101), 5, "Bien"), Triple("A\nB", 5, "Bien"), Triple("Juan", 0, "Bien"), Triple("Juan", 5, "x"), Triple("Juan", 5, "x".repeat(601)))) assertNotNull(ReviewsPolicy.error(name, rating, comment))
        assertNull(ReviewsPolicy.error("Juan", 1, "Comentario\ncon dos líneas"))
    }
    @Test fun visitProofMustBelongToThisUserAndPlaceWithTheCanonicalId() {
        assertTrue(ReviewsPolicy.eligible("user", "place", "user_place", raw))
        assertFalse(ReviewsPolicy.eligible("other", "place", "user_place", raw))
        assertFalse(ReviewsPolicy.eligible("user", "other", "user_place", raw))
        assertFalse(ReviewsPolicy.eligible("user", "place", "some_counter", raw))
    }
    @Test fun creatingUsesServerTimesAndCreateOnlyPrecondition() {
        val write = ReviewsPolicy.commit("user", "place", "Lugar", " Juan ", 4, " Atención excelente ", false).getJSONArray("writes").getJSONObject(0)
        assertFalse(write.getJSONObject("currentDocument").getBoolean("exists"))
        val fields = write.getJSONObject("update").getJSONObject("fields")
        assertEquals("published", fields.getJSONObject("status").getString("stringValue"))
        assertEquals("Juan", fields.getJSONObject("userName").getString("stringValue"))
        assertEquals("4", fields.getJSONObject("rating").getString("integerValue"))
        assertFalse(fields.has("createdAt"));assertEquals(2, write.getJSONArray("updateTransforms").length())
        assertFalse(write.has("updateMask"))
    }
    @Test fun updatesCannotChangeModerationOwnershipOrCreateTime() {
        val write = ReviewsPolicy.commit("user", "place", "Lugar", "Juan", 5, "Actualizada", true).getJSONArray("writes").getJSONObject(0)
        assertTrue(write.getJSONObject("currentDocument").getBoolean("exists"))
        val fields = write.getJSONObject("update").getJSONObject("fields")
        assertEquals(setOf("userName", "rating", "comment"), fields.keys().asSequence().toSet())
        assertFalse(fields.has("status"));assertFalse(fields.has("userId"));assertFalse(fields.has("createdAt"))
        val mask = write.getJSONObject("updateMask").getJSONArray("fieldPaths")
        assertEquals(3, mask.length());assertEquals(1, write.getJSONArray("updateTransforms").length())
    }
    @Test fun deterministicIdsPreventDuplicateOpinionsAndRejectPathInjection() {
        assertEquals("user_place", ReviewsPolicy.id("user", "place"))
        for (pair in listOf("" to "place", "user" to "", "user" to "../place", "other/user" to "place")) {
            try { ReviewsPolicy.id(pair.first, pair.second);fail("Invalid identity accepted") } catch (_: IllegalArgumentException) { }
        }
        assertEquals("explore", NativeLinkPolicy.parse("https://visitaloja.com/opiniones.html?place=place")?.route)
        assertEquals("place", NativeLinkPolicy.parse("https://visitaloja.com/opiniones.html?place=place")?.place)
    }
    @Test fun averagesAndSortingDescribeLoadedRecordsWithoutInventingAnEmptyRating() {
        assertNull(ReviewsPolicy.average(emptyList()))
        val a = ReviewsPolicy.read("a", raw, "place")!!
        val b = a.copy(id = "b", rating = 2, updated = 2000)
        assertEquals(3.0, ReviewsPolicy.average(listOf(a, b))!!, 0.001)
        assertEquals("b", ReviewsPolicy.sorted(listOf(a, b), false).first().id)
        assertEquals("a", ReviewsPolicy.sorted(listOf(a, b), true).first().id)
    }
    @Test fun withdrawnPlacesAreBlockedAndPublicTextIsNotExecuted() {
        assertTrue(ReviewsPolicy.placePublished(mapOf("title" to "Lugar")))
        for (patch in listOf(mapOf("active" to false), mapOf("hidden" to true), mapOf("publicationStatus" to "draft"), mapOf("status" to "archived"))) assertFalse(ReviewsPolicy.placePublished(mapOf("title" to "Lugar") + patch))
        assertEquals("<b>Excelente</b>", ReviewsPolicy.read("id", raw + mapOf("comment" to "<b>Excelente</b>"), "place")?.comment)
    }
}
