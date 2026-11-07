package com.visitaloja.app

internal object RegistrationPolicy {
    fun validate(email: String, password: String, confirmation: String): String {
        val address = email.trim()
        require(address.length <= 254 && Regex("^[^\\s@<>]+@[^\\s@<>]+\\.[^\\s@<>]+$").matches(address)) { "Escribe un correo electrónico válido." }
        require(password.length in 8..128) { "Usa una contraseña de entre 8 y 128 caracteres." }
        require(password == confirmation) { "Las contraseñas no coinciden." }
        return address
    }
}
