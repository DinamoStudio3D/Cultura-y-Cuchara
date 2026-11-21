package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test

class AdminPhotoPolicyTest {
    private val photo = mapOf<String, Any?>("id" to "a", "section" to "Portada principal", "title" to "Loja", "credit" to "Autora", "url" to "assets/photos/jipiro-laguna.webp", "active" to true)
    @Test fun initializedEmptyLibraryDoesNotRestoreDefaultPhotos() {
        assertTrue(AdminPhotoPolicy.read(mapOf("photoManagerInitialized" to true), listOf(photo)).photos.isEmpty())
        assertEquals(listOf(photo), AdminPhotoPolicy.read(emptyMap(), listOf(photo)).photos)
    }
    @Test fun reorderingCannotMoveOtherSectionsOrLoseUnknownMetadata() {
        val a = photo + ("extra" to mapOf("preserve" to 42))
        val b = photo + mapOf("id" to "b", "section" to "Loja en imágenes")
        val c = photo + ("id" to "c")
        val moved = AdminPhotoPolicy.move(listOf(a, b, c), "c", -1)
        assertEquals(listOf("c", "b", "a"), moved.map { it["id"] })
        assertEquals(a, moved.last()); assertEquals(b, moved[1])
        assertEquals(moved, AdminPhotoPolicy.move(moved, "c", -1))
    }
    @Test fun conflictComparisonIncludesHiddenRowsAndCreditsButIgnoresUnrelatedSettings() {
        val base = mapOf("photoManagerItems" to listOf(photo), "title" to "Loja")
        assertEquals(AdminPhotoPolicy.version(base), AdminPhotoPolicy.version(base + ("title" to "Otra portada")))
        assertNotEquals(AdminPhotoPolicy.version(base), AdminPhotoPolicy.version(base + ("photoManagerItems" to listOf(photo + ("active" to false)))))
        assertNotEquals(AdminPhotoPolicy.version(base), AdminPhotoPolicy.version(base + ("photoManagerAuthors" to listOf(mapOf("name" to "Otra autora")))))
    }
    @Test fun unknownLegacyRowsSurviveUnchangedButNewInvalidUrlsCannotPublish() {
        val legacy = photo + mapOf("url" to "https://legacy.example/photo.jpg", "custom" to "preserve")
        val initial = PhotoLibraryDraft(listOf(legacy))
        AdminPhotoPolicy.validate(initial, initial)
        assertThrows(IllegalArgumentException::class.java) { AdminPhotoPolicy.validate(PhotoLibraryDraft(listOf(legacy + ("title" to "Cambio"))), initial) }
        AdminPhotoPolicy.validatePhoto(photo)
        listOf("javascript:alert(1)", "https://www.visitaloja.com@evil.example/a.jpg", "https://example.com/a.jpg").forEach { url ->
            assertThrows(IllegalArgumentException::class.java) { AdminPhotoPolicy.validatePhoto(photo + ("url" to url)) }
        }
    }
    @Test fun duplicatePhotoIdsAreRejectedAndDraftsOnlyStoreKnownEditableMetadata() {
        assertThrows(IllegalArgumentException::class.java) { AdminPhotoPolicy.read(mapOf("photoManagerItems" to listOf(photo, photo)), emptyList()) }
        assertEquals(photo, AdminPhotoPolicy.storable(photo + ("serverMetadata" to mapOf("anything" to true))))
        assertEquals(20f to 80f, AdminPhotoPolicy.focus(photo + ("mobileFocus" to mapOf("x" to 20, "y" to 80)), "mobileFocus"))
        assertNull(AdminPhotoPolicy.focus(photo + ("mobileFocus" to mapOf("x" to "NaN", "y" to 80)), "mobileFocus"))
    }
}
