package com.visitaloja.app

internal object PlacePresentationPolicy {
    fun category(place: Place, english: Boolean): String = if (!english) place.categoryLabel else when (place.categoryLabel) {
        "Cafetería" -> "Coffee shop"
        "Hospedaje" -> "Lodging"
        "Gastronomía" -> "Food and dining"
        "Turismo" -> "Tourism"
        "Marca aliada" -> "Partner brand"
        "Panadería" -> "Bakery"
        "Heladería" -> "Ice cream shop"
        "Bar" -> "Bar"
        "Comercio local" -> "Local shop"
        else -> "VisitaLoja stop"
    }
    fun filterCategory(id: String, spanish: String, english: Boolean): String = if (!english) spanish else when(id) {
        "all" -> "All"; "cafe" -> "Coffee"; "hotel" -> "Lodging"; "food" -> "Food"; "turismo" -> "Tourism"; else -> spanish
    }
    private val englishAmenities = mapOf("wifi" to "Wi-Fi", "parking" to "Parking", "accessible" to "Accessibility", "familyFriendly" to "Family friendly", "petFriendly" to "Pet friendly", "takeaway" to "Takeaway", "delivery" to "Delivery", "outdoorSeating" to "Outdoor seating")
    private val englishPayments = mapOf("cash" to "Cash", "card" to "Card", "transfer" to "Bank transfer", "qr" to "QR payment")
    fun amenity(key: String, english: Boolean): String? = if (english) englishAmenities[key] ?: PlaceInfoPolicy.amenities[key] else PlaceInfoPolicy.amenities[key]
    fun payment(key: String, english: Boolean): String? = if (english) englishPayments[key] ?: PlaceInfoPolicy.payments[key] else PlaceInfoPolicy.payments[key]
    fun hours(info: PlaceInfo, english: Boolean): String = if (english) info.hoursEn.ifBlank { info.hours } else info.hours.ifBlank { info.hoursEn }
    fun savedSearchEmpty(onlySaved: Boolean, query: String, hasSaved: Boolean): Boolean = onlySaved && query.isNotBlank() && hasSaved
}
