package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test

class RegistrationPolicyTest {
    @Test fun normalizesOnlyEmailAndKeepsPasswordWhitespaceSignificant() {
        assertEquals("persona@example.com", RegistrationPolicy.validate("  persona@example.com  ", " password ", " password "))
        assertEquals("a@b.ec", RegistrationPolicy.validate("a@b.ec", "12345678", "12345678"))
    }
    @Test fun rejectsInvalidEmailWeakLengthAndMismatchBeforeCallingFirebase() {
        listOf(Triple("sin-correo", "12345678", "12345678"), Triple("a @b.ec", "12345678", "12345678"),
            Triple("a@b.ec", "1234567", "1234567"), Triple("a@b.ec", "x".repeat(129), "x".repeat(129)),
            Triple("a@b.ec", "12345678", "87654321"), Triple("a@b.ec", " password ", "password")).forEach { (email, password, confirmation) ->
            try { RegistrationPolicy.validate(email, password, confirmation); fail("Expected invalid registration") } catch (_: IllegalArgumentException) { }
        }
    }
}
