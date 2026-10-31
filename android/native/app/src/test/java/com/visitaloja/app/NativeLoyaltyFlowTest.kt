package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test
import java.time.LocalDate
import org.json.JSONObject

class NativeLoyaltyFlowTest {
    @Test fun visitCommitOnlyCreatesPendingCodeWithServerTimeAndNoStampOrCounterWrites() {
        val place = Place("loc_123", "Café", listOf("cafe"), "", "", null)
        val candidate = VisitPolicy.candidate(place.id, "2026-10-26", 1000)
        assertTrue(candidate.code.matches(Regex("[0-9]{6}")))
        assertEquals(541000L, candidate.expires)
        val commit = VisitPolicy.commit("u", "Cliente", "u@example.com", place, candidate)
        assertEquals(1, commit.getJSONArray("writes").length())
        val write = commit.getJSONArray("writes").getJSONObject(0)
        assertFalse(write.getJSONObject("currentDocument").getBoolean("exists"))
        assertEquals("REQUEST_TIME", write.getJSONArray("updateTransforms").getJSONObject(0).getString("setToServerValue"))
        val fields = write.getJSONObject("update").getJSONObject("fields")
        assertEquals("pending", fields.getJSONObject("status").getString("stringValue"))
        assertEquals("u", fields.getJSONObject("userId").getString("stringValue"))
        assertFalse(fields.has("visitCount")); assertFalse(fields.has("confirmedBy")); assertFalse(fields.has("createdAt"))
        assertTrue(write.getJSONObject("update").getString("name").endsWith("/visitCodes/${candidate.id}"))
    }
    @Test fun candidateCannotWriteOutsideTheSelectedPlaceOrUseInvalidIds() {
        assertThrows(IllegalArgumentException::class.java) { VisitPolicy.candidate("other/path", "2026-10-26", 0) }
        val place = Place("a", "A", listOf("cafe"), "", "", null)
        assertThrows(IllegalArgumentException::class.java) { VisitPolicy.commit("u", "", "", place, VisitCandidate("wrong_b_123456", "123456", 1)) }
    }
    @Test fun dailyBlockOnlyAppliesToTheSameEcuadorDay() {
        val counter = mapOf("lastVisitDay" to "2026-10-26", "dailyVisitCount" to 1)
        assertTrue(VisitPolicy.blocked(counter, "2026-10-26"))
        assertFalse(VisitPolicy.blocked(counter, "2026-10-27")); assertFalse(VisitPolicy.blocked(null, "2026-10-26"))
    }
    private val draft = ProfileDraft("Ana Cliente", "0991234567", "Loja", "lojano", "1996-05-20", "1100000000")
    private val today = LocalDate.of(2026,10,26)
    @Test fun profileMatchesTheExistingWebSchemaWithoutInventingConsentOrDates() {
        val fields = ProfilePolicy.fields(draft, "ana", "ana@example.com", "", today)
        assertEquals("+593991234567", fields["whatsapp"])
        assertEquals("cedula", fields["documentType"]); assertEquals("ana", fields["uid"])
        assertFalse(fields.containsKey("createdAt")); assertFalse(fields.containsKey("consentAt"))
        assertEquals("passport", ProfilePolicy.fields(draft.copy(mode="turista",document="AB-12345"), "ana", "ana@example.com", "", today)["documentType"])
    }
    @Test fun invalidProfileDataIsRejectedBeforeSending() {
        for (invalid in listOf(draft.copy(birth="2026-02-30"), draft.copy(birth="2026-10-27"), draft.copy(document="123"), draft.copy(phone="1234567890"), draft.copy(name="A"), draft.copy(city=""), draft.copy(mode="turista",document="bad/path"))) {
            assertThrows(IllegalArgumentException::class.java) { ProfilePolicy.fields(invalid,"ana","ana@example.com","",today) }
        }
    }
    @Test fun qrPayloadRoundTripsThroughTheSameCodeFormatUsedByMerchants() {
        val payload = "VISITALOJA:123456"
        val matrix = com.google.zxing.qrcode.QRCodeWriter().encode(payload, com.google.zxing.BarcodeFormat.QR_CODE, 256,256)
        val pixels = IntArray(256*256) { i -> if (matrix[i%256,i/256]) -0x1000000 else -1 }
        val bitmap = com.google.zxing.BinaryBitmap(com.google.zxing.common.HybridBinarizer(com.google.zxing.RGBLuminanceSource(256,256,pixels)))
        assertEquals(payload, com.google.zxing.MultiFormatReader().decode(bitmap).text)
    }
}
