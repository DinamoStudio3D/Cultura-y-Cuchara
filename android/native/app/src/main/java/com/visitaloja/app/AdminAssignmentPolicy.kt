package com.visitaloja.app

internal object AdminAssignmentPolicy {
    val sources = mapOf("merchants" to "missionRewardMerchants", "users" to "userProfiles", "requests" to "missionRewardMerchantRequests")
    val roles = linkedMapOf("owner" to "Propietario", "staff" to "Encargado", "profile" to "Solo edición de ficha")
    fun uid(value: String) = value.isNotBlank() && value.length <= 128 && '/' !in value && value.none(Char::isISOControl)
    fun email(value: String): String = value.trim().lowercase(java.util.Locale.ROOT).also {
        require(it.length <= 254 && it.matches(Regex("[^\\s@]+@[^\\s@]+\\.[^\\s@]+"))) { "La cuenta necesita un correo válido." }
    }
    fun ids(merchant: Map<String, Any?>?): List<String> {
        val raw = merchant?.get("placeIds") ?: return emptyList()
        require(raw is List<*> && raw.size <= 200 && raw.all { it is String && MerchantScanPolicy.placeId(it) }) { "Las asignaciones anteriores necesitan revisión en la web." }
        return raw.filterIsInstance<String>().distinct()
    }
    fun modern(target: String, records: Map<String, Map<String, Any?>>): Map<String, Map<String, Any?>> {
        require(uid(target) && records.size <= 200) { "Demasiados accesos para esta pantalla. Revisa la cuenta en la web." }
        records.forEach { (id, row) ->
            val place = row.text("placeId")
            require(row["uid"] == target && MerchantScanPolicy.placeId(place) && id == target + "_" + place &&
                row["role"] in setOf("owner", "staff", "manager")) { "Hay un acceso anterior con formato especial. Revísalo en la web antes de continuar." }
        }
        return records
    }
    fun configured(merchant: Map<String, Any?>?, modern: Map<String, Map<String, Any?>>): Map<String, String> {
        val operational = ids(merchant)
        val result = linkedMapOf<String, String>()
        val active = merchant?.get("active") != false
        val byPlace = modern.values.associateBy { it.text("placeId") }
        operational.forEach { id ->
            val record = byPlace[id]
            // Legacy-only grants allow owner editing; an explicit non-owner/inactive record blocks that fallback.
            result[id] = if (record == null || record["role"] == "owner" && (record["active"] == true ||
                    !active && record["assignmentScope"] == "owner")) "owner" else "staff"
        }
        byPlace.forEach { (id, row) ->
            if (id !in result && row["role"] == "owner" && (row["active"] == true ||
                    !active && row["assignmentScope"] == "profile")) result[id] = "profile"
        }
        return result
    }
    fun validate(before: Map<String, String>, after: Map<String, String>, available: Set<String>,
        merchantExists: Boolean, touched: Set<String>) {
        require(after.size <= 200 && touched.size <= 200) { "Esta cuenta necesita una revisión de asignaciones en la web." }
        require(after.all { (id, role) -> MerchantScanPolicy.placeId(id) && role in roles }) { "Selecciona roles y paradas válidos." }
        require(after.all { (id, role) -> role != "profile" || before[id] == "profile" }) { "Para una asignación nueva, selecciona propietario o encargado." }
        require(merchantExists || before.isNotEmpty() || after.isNotEmpty()) { "Selecciona al menos una parada para habilitar esta cuenta de negocio." }
        require(after.all { (id, role) -> id in available || before[id] == role }) { "Una parada dejó de estar disponible. Actualiza antes de asignarla." }
        val oldOperational = before.count { it.value != "profile" }
        require(after.count { it.value != "profile" } <= maxOf(20, oldOperational)) { "La app admite hasta 20 paradas operativas por cuenta; conserva o reduce una asignación anterior mayor." }
    }
    fun merchantPatch(target: String, address: String, name: String, current: Map<String, Any?>?,
        assignments: Map<String, String>, active: Boolean): Map<String, Any?> {
        require(uid(target)); val normalized = email(address)
        val core = mapOf("placeIds" to assignments.filterValues { it != "profile" }.keys.toList(), "active" to active)
        return if (current == null) core + mapOf("uid" to target, "email" to normalized, "businessName" to name.take(120))
            else core
    }
    fun accessPatch(target: String, address: String, place: String, scope: String?, active: Boolean,
        previous: Map<String, Any?>?): Map<String, Any?> {
        require(uid(target) && MerchantScanPolicy.placeId(place) && (scope == null || scope in roles))
        val role = when (scope) { "owner", "profile" -> "owner"; "staff" -> "staff"; else -> previous?.text("role") ?: "staff" }
        return mapOf("uid" to target, "email" to email(address), "placeId" to place, "role" to role,
            "active" to (active && scope != null), "assignmentScope" to (scope ?: "none"))
    }
}
