package com.visitaloja.app

internal data class AdminPlacePhoto(val key: String, val url: String, val caption: String = "",
    val credit: String = "", val original: Any? = null)
internal data class AdminPlaceDraft(
    val text: Map<String, String> = emptyMap(), val category: String = "", val canton: String = "loja",
    val publication: String = "draft", val active: Boolean = true, val pin: String = "",
    val amenities: Set<String> = emptySet(), val payments: Set<String> = emptySet(),
    val photos: List<AdminPlacePhoto> = emptyList()
)
internal object AdminPlaceEditorPolicy {
    val categories = linkedMapOf("hotel" to "Hotel / Hospedaje", "hueca" to "Hueca tradicional",
        "urbana" to "Restaurante", "cafe" to "Cafetería", "heladeria" to "Heladería",
        "panaderia" to "Panadería / Repostería", "bar" to "Bar", "entretenimiento" to "Entretenimiento",
        "turismo" to "Atractivo turístico", "artesania" to "Artesanía / Comercio local", "aliado" to "Marca aliada")
    val icons = mapOf("hotel" to "fa-hotel", "hueca" to "fa-mortar-pestle", "urbana" to "fa-utensils",
        "cafe" to "fa-mug-hot", "heladeria" to "fa-ice-cream", "panaderia" to "fa-bread-slice",
        "bar" to "fa-martini-glass-citrus", "entretenimiento" to "fa-ticket", "turismo" to "fa-landmark",
        "artesania" to "fa-basket-shopping", "aliado" to "fa-handshake")
    val labels = linkedMapOf(
        "title" to ("Nombre" to 160), "titleEn" to ("Nombre en inglés" to 160),
        "description" to ("Descripción" to 1200), "descEn" to ("Descripción en inglés" to 1200),
        "tag" to ("Etiqueta visible" to 100), "dish" to ("Especialidad" to 160), "dishEn" to ("Especialidad en inglés" to 160),
        "address" to ("Dirección" to 400), "lat" to ("Latitud" to 30), "lng" to ("Longitud" to 30),
        "hours" to ("Horarios publicados" to 600), "hoursEn" to ("Horarios en inglés" to 600),
        "phone" to ("Teléfono" to 30), "whatsapp" to ("WhatsApp" to 30),
        "website" to ("Sitio web · HTTPS" to 2048), "instagram" to ("Instagram · HTTPS" to 2048),
        "facebook" to ("Facebook · HTTPS" to 2048), "tiktok" to ("TikTok · HTTPS" to 2048),
        "priceRange" to ("Presupuesto · de $ a $$$$" to 4),
        "customLogoUrl" to ("Enlace del logo" to 2000), "heroImage" to ("Enlace de portada" to 2000),
        "youtubeUrl" to ("Video · YouTube, MP4 o WebM" to 2000),
        "audioUrl" to ("Narración en español · enlace" to 2000), "audioUrlEn" to ("Narración en inglés · enlace" to 2000)
    )
    private val profileKeys = setOf("phone", "whatsapp", "website", "instagram", "facebook", "tiktok", "priceRange")
    private val pinCategories = setOf("hotel", "hueca", "cafe", "urbana", "heladeria", "panaderia", "bar")
    private val inactive = setOf("inactive", "archived", "deleted")
    fun usesPin(category: String) = category in pinCategories
    fun recoveredCreation(raw: Map<String, Any?>, uid: String, id: String) =
        raw["createdBy"] == uid && raw["creationRequestId"] == id
    fun primary(raw: Map<String, Any?>): String =
        (raw["category"] as? String) ?: (raw["category"] as? List<*>)?.filterIsInstance<String>()?.firstOrNull().orEmpty()
    private fun active(raw: Map<String, Any?>) = raw["active"] != false && raw.text("status") !in inactive
    private fun photo(row: Any?, index: Int): AdminPlacePhoto {
        val map = (row as? Map<*, *>)?.entries?.associate { it.key.toString() to it.value }
        require(row is String || map != null) { "Hay una fotografía con formato no compatible. Revísala en la web." }
        return AdminPlacePhoto("photo-" + index, (row as? String) ?: map?.text("img").orEmpty().ifBlank { map?.text("url").orEmpty() },
            map?.text("caption").orEmpty(), map?.text("credit").orEmpty().ifBlank { map?.text("author").orEmpty() }, row)
    }
    fun read(raw: Map<String, Any?>, creating: Boolean): AdminPlaceDraft {
        val profile = raw.map("businessProfile")
        val fields = labels.keys.associateWith { key ->
            when {
                key == "description" -> raw.text("description").ifBlank { raw.text("desc") }
                key in profileKeys -> profile.text(key).ifBlank { raw.text(key) }
                key in setOf("lat", "lng") -> raw[key]?.toString().orEmpty()
                key == "heroImage" && raw[key] is Map<*, *> -> raw.map(key).text("url").ifBlank { raw.map(key).text("img") }
                else -> raw.text(key)
            }
        }
        val gallery = raw["gallery"] ?: emptyList<Any>()
        require(gallery is List<*> && gallery.size <= 100) { "Revisa el formato y tamaño de la galería en la web." }
        val publication = raw.text("publicationStatus").ifBlank {
            raw.text("status").takeIf { it in setOf("draft", "hidden") }
                ?: if (raw["hidden"] == true) "hidden" else if (raw["published"] == false) "draft" else "published"
        }
        return AdminPlaceDraft(fields, primary(raw), raw.text("cantonId").ifBlank { "loja" },
            if (creating) "draft" else publication, active(raw),
            amenities = PlaceInfoPolicy.amenities.keys.filter { profile.map("amenities")[it] == true }.toSet(),
            payments = (profile["paymentMethods"] as? List<*>)?.filterIsInstance<String>()?.toSet().orEmpty(),
            photos = gallery.mapIndexed { index, row -> photo(row, index) })
    }
    fun image(value: String): String? = PlacePolicy.safeImage(value) ?: value.takeIf {
        it.startsWith("assets/") && !it.contains("..") && it.matches(Regex("[A-Za-z0-9_./-]+"))
    }?.let { "https://www.visitaloja.com/" + it }
    fun galleryLimit(raw: Map<String, Any?>, settings: Map<String, Any?>): Int {
        val planId = raw.map("subscription").text("plan").ifBlank { "free" }
        val plans = settings["plans"] as? List<*> ?: return 3
        val plan = plans.filterIsInstance<Map<*, *>>().firstOrNull { it["id"] == planId } ?: return 3
        val features = plan["features"] as? Map<*, *> ?: return 3
        val limit = features["maxGalleryImages"] as? Number ?: return 3
        require(limit.toDouble().isFinite() && limit.toDouble() == limit.toInt().toDouble() && limit.toInt() in 0..100) { "El límite del plan necesita revisión." }
        return limit.toInt()
    }
    fun publicFields(id: String, raw: Map<String, Any?>, draft: AdminPlaceDraft, creating: Boolean,
        galleryLimit: Int, hasPrivatePin: Boolean): Map<String, Any?> {
        require(MerchantScanPolicy.placeId(id)) { "Identificador de parada inválido." }
        val text = draft.text.mapValues { it.value.trim() }
        labels.forEach { (key, meta) -> require(text[key].orEmpty().length <= meta.second) { "Revisa el campo " + meta.first + "." } }
        require(text["title"].orEmpty().length in 2..160 && text["description"].orEmpty().isNotBlank() &&
            text["address"].orEmpty().isNotBlank()) { "Completa nombre, descripción y dirección." }
        require(draft.category in categories || (!creating && draft.category == primary(raw) && draft.category.isNotBlank())) { "Selecciona una categoría." }
        require(CantonPolicy.catalogue.any { it.id == draft.canton }) { "Selecciona un cantón de Loja." }
        require(draft.publication in setOf("published", "draft", "hidden")) { "Selecciona un estado de publicación." }
        val lat = PlacePolicy.safeCoordinate(text["lat"]?.toDoubleOrNull(), true)
        val lng = PlacePolicy.safeCoordinate(text["lng"]?.toDoubleOrNull(), false)
        require(lat != null && lng != null) { "Revisa las coordenadas de la parada." }
        for (key in listOf("phone", "whatsapp"))
            require(text[key].isNullOrBlank() || PlacePolicy.safePhone(text[key]) != null) { "Revisa " + labels.getValue(key).first + "." }
        PlaceInfoPolicy.links.keys.forEach { key ->
            require(text[key].isNullOrBlank() || PlaceInfoPolicy.url(key, text[key].orEmpty()) != null) { "Usa un enlace HTTPS válido para " + labels.getValue(key).first + "." }
        }
        require(text["priceRange"].isNullOrBlank() || text.getValue("priceRange").all { it == '$' }) { "El presupuesto se indica con uno a cuatro signos de dólar." }
        for (key in listOf("customLogoUrl", "heroImage"))
            require(text[key].isNullOrBlank() || image(text[key].orEmpty()) != null) { "Revisa el enlace de " + labels.getValue(key).first + "." }
        require(text["youtubeUrl"].isNullOrBlank() || VideoPolicy.source(text["youtubeUrl"].orEmpty()) != null) { "Usa un enlace válido de YouTube, MP4 o WebM." }
        for (key in listOf("audioUrl", "audioUrlEn"))
            require(text[key].isNullOrBlank() || PlaceMediaPolicy.audio(text[key].orEmpty()) != null) { "Revisa el enlace de la narración." }
        if (usesPin(draft.category)) require(draft.pin.matches(Regex("[0-9]{4,6}")) || (!creating && draft.pin.isBlank() && hasPrivatePin)) { "Define un PIN privado de 4 a 6 números." }
        require(galleryLimit in 0..100 && draft.photos.size <= 100) { "Revisa el límite de fotografías." }
        val before = read(raw, creating)
        require(draft.photos.size <= galleryLimit || draft.photos.size <= before.photos.size) { "El plan admite " + galleryLimit + " fotos. Puedes conservar o reducir la galería existente." }
        require(draft.photos.map { it.key }.distinct().size == draft.photos.size) { "Hay fotografías repetidas en el formulario." }
        val gallery = draft.photos.map { item ->
            val old = item.original?.let { photo(it, 0) }
            if (old != null && item.url == old.url && item.caption == old.caption && item.credit == old.credit) item.original
            else {
                require(item.url.length <= 2000 && image(item.url.trim()) != null && item.caption.length <= 300 && item.credit.length <= 200) { "Revisa el enlace, texto y crédito de la fotografía." }
                val oldMap = (item.original as? Map<*, *>)?.entries?.associate { it.key.toString() to it.value }.orEmpty()
                val title = if (old == null || old.caption != item.caption || !oldMap.containsKey("title"))
                    mapOf("title" to item.caption.trim().ifBlank { oldMap.text("title").ifBlank { text["title"].orEmpty() } }) else emptyMap()
                oldMap + mapOf("img" to item.url.trim(), "caption" to item.caption.trim(), "credit" to item.credit.trim()) + title
            }
        }
        val profile = raw.map("businessProfile") + profileKeys.associateWith { text[it].orEmpty() } +
            mapOf("amenities" to (raw.map("businessProfile").map("amenities") +
                PlaceInfoPolicy.amenities.keys.associateWith { it in draft.amenities }),
                "paymentMethods" to draft.payments.toList())
        val result = mutableMapOf<String, Any?>(
            "title" to text["title"], "titleEn" to text["titleEn"].orEmpty().ifBlank { text["title"].orEmpty() },
            "desc" to text["description"], "description" to text["description"],
            "descEn" to text["descEn"].orEmpty().ifBlank { text["description"].orEmpty() },
            "tag" to text["tag"].orEmpty().ifBlank { draft.category },
            "dish" to text["dish"].orEmpty(), "dishEn" to text["dishEn"].orEmpty(),
            "hours" to text["hours"].orEmpty(), "hoursEn" to text["hoursEn"].orEmpty(),
            "address" to text["address"], "lat" to lat, "lng" to lng,
            "gps" to ("https://www.google.com/maps/search/?api=1&query=" + lat + "," + lng),
            "cantonId" to draft.canton, "publicationStatus" to draft.publication,
            "businessProfile" to profile, "phone" to text["phone"].orEmpty(), "whatsapp" to text["whatsapp"].orEmpty(),
            "customLogoUrl" to text["customLogoUrl"].orEmpty(), "youtubeUrl" to text["youtubeUrl"].orEmpty(),
            "audioUrl" to text["audioUrl"].orEmpty(), "audioUrlEn" to text["audioUrlEn"].orEmpty(), "gallery" to gallery)
        if (creating || text["heroImage"].orEmpty() != before.text["heroImage"].orEmpty()) result["heroImage"] = text["heroImage"].orEmpty()
        val oldCategories = raw["category"] as? List<*>
        result["category"] = if (oldCategories != null) (listOf(draft.category) + oldCategories.filterIsInstance<String>().drop(1)).distinct() else draft.category
        if (creating || draft.category != primary(raw) || raw.text("iconClass").isBlank()) result["iconClass"] = icons[draft.category] ?: "fa-location-dot"
        if (creating || draft.active != before.active) {
            result["active"] = draft.active
            if (!creating && raw.containsKey("status")) result["status"] = if (draft.active) "active" else "inactive"
        }
        if (draft.publication != before.publication || draft.active != before.active) {
            if (raw.text("status") in setOf("draft", "hidden")) result["status"] = if (draft.publication == "published") "active" else draft.publication
            if (raw.containsKey("hidden")) result["hidden"] = draft.publication == "hidden"
            if (raw.containsKey("published")) result["published"] = draft.publication == "published"
        }
        if (creating) {
            result["slug"] = PlacePolicy.normalize(text["title"].orEmpty()).replace(' ', '-').ifBlank { "parada" } + "-" + id.takeLast(8)
            result["validationMode"] = "merchant_confirmation"
            result["discovery"] = mapOf("enabled" to false, "method" to "manager", "version" to 1)
        }
        return result
    }
}
