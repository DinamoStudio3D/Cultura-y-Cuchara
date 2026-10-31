package com.visitaloja.app

import java.time.LocalDate

data class ProfileDraft(val name: String = "", val phone: String = "", val city: String = "", val mode: String = "turista", val birth: String = "", val document: String = "")
object ProfilePolicy {
    fun draft(data: Map<String, Any?>?, name: String): ProfileDraft = ProfileDraft(data?.text("fullName")?.ifBlank { name } ?: name,
        data?.text("whatsappDisplay").orEmpty(), data?.text("city").orEmpty(), if (data?.text("visitorType") == "lojano") "lojano" else "turista",
        data?.text("birthDate").orEmpty(), data?.text("documentNumber").orEmpty())
    fun fields(draft: ProfileDraft, uid: String, email: String, photo: String, today: LocalDate): Map<String, Any> {
        val name = draft.name.trim(); val city = draft.city.trim(); val document = draft.document.trim().uppercase(java.util.Locale.ROOT)
        require(name.length in 2..100) { "Escribe tu nombre completo (entre 2 y 100 caracteres)." }
        require(city.length in 2..80) { "Escribe tu ciudad (entre 2 y 80 caracteres)." }
        val phone = draft.phone.filter(Char::isDigit)
        require(phone.matches(Regex("09[0-9]{8}"))) { "Escribe un celular ecuatoriano de 10 números que comience con 09." }
        require(draft.mode in setOf("lojano", "turista"))
        require(draft.birth.matches(Regex("\\d{4}-\\d{2}-\\d{2}"))) { "Escribe una fecha válida: AAAA-MM-DD." }
        val birth = try { LocalDate.parse(draft.birth) } catch (_: Exception) { throw IllegalArgumentException("Escribe una fecha válida: AAAA-MM-DD.") }
        require(!birth.isAfter(today)) { "Revisa tu fecha de nacimiento." }
        require(if (draft.mode == "lojano") document.matches(Regex("[0-9]{10}")) else document.matches(Regex("[A-Z0-9-]{5,20}"))) { if (draft.mode == "lojano") "La cédula debe tener 10 números." else "El pasaporte debe tener entre 5 y 20 letras, números o guiones." }
        require(uid.isNotBlank() && email.isNotBlank()) { "Vuelve a iniciar sesión con tu cuenta." }
        return mapOf("uid" to uid, "fullName" to name, "email" to email, "whatsapp" to "+593${phone.drop(1)}", "whatsappDisplay" to phone,
            "city" to city, "visitorType" to draft.mode, "birthDate" to birth.toString(), "documentType" to if (draft.mode == "lojano") "cedula" else "passport", "documentNumber" to document,
            "photoURL" to photo.take(1000), "profileComplete" to true)
    }
}
