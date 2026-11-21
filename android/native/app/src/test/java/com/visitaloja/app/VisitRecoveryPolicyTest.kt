package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class VisitRecoveryPolicyTest {
    private fun at(text: String) = Instant.parse(text).toEpochMilli()
    @Test fun expiredQrCanStillHaveAConfirmedVisitToday() {
        val code = VisitCandidate("2026-11-15_local_123456", "123456", at("2026-11-15T17:09:00Z"))
        val now = at("2026-11-15T18:00:00Z")
        assertTrue(VisitPolicy.validCandidate("local", code))
        assertFalse(VisitPolicy.reusableCandidate("local", code, now))
        assertTrue(VisitPolicy.confirmedToday("confirmed", at("2026-11-15T17:05:00Z"), now))
    }
    @Test fun anOldConfirmationDoesNotPreventTheNextLojaDay() {
        val confirmed = at("2026-11-16T04:59:00Z")
        assertTrue(VisitPolicy.confirmedToday("confirmed", confirmed, at("2026-11-16T04:59:59Z")))
        assertFalse(VisitPolicy.confirmedToday("confirmed", confirmed, at("2026-11-16T05:00:00Z")))
        assertFalse(VisitPolicy.confirmedToday("reversed", confirmed, confirmed))
        assertFalse(VisitPolicy.confirmedToday("confirmed", null, confirmed))
    }
    @Test fun aQrFromYesterdayIsNotReusedToCreateAnotherRequestToday() {
        val code = VisitCandidate("2026-11-15_local_123456", "123456", at("2026-11-16T05:08:00Z"))
        assertTrue(VisitPolicy.reusableCandidate("local", code, at("2026-11-16T04:59:59Z")))
        assertFalse(VisitPolicy.reusableCandidate("local", code, at("2026-11-16T05:00:00Z")))
        // The confirmation day, rather than the ID's creation day, is authoritative.
        assertTrue(VisitPolicy.confirmedToday("confirmed", at("2026-11-16T05:01:00Z"), at("2026-11-16T05:10:00Z")))
    }
    @Test fun storedReferencesMustMatchTheirPlaceAndSixDigitCode() {
        val code = VisitCandidate("2026-11-15_local_123456", "123456", 100)
        assertFalse(VisitPolicy.validCandidate("other", code))
        assertFalse(VisitPolicy.validCandidate("local", code.copy(code = "654321")))
        assertFalse(VisitPolicy.validCandidate("local", code.copy(id = "../" + code.id)))
        assertFalse(VisitPolicy.validCandidate("local", code.copy(expires = 0)))
    }
}
