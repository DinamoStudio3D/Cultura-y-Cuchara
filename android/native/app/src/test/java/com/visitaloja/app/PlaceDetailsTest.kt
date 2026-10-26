package com.visitaloja.app

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class PlaceDetailsTest {
    @Test fun publicContactOnlyAcceptsDialableNumbersAndNormalizesEcuadorWhatsApp() {
        assertEquals("+593987654321", PlacePolicy.safePhone("+593 98 765 4321"))
        assertEquals("593987654321", PlacePolicy.whatsapp("0987654321"))
        assertEquals("593987654321", PlacePolicy.whatsapp("987654321"))
        assertNull(PlacePolicy.safePhone("tel:0987654321;ext=5"))
        assertNull(PlacePolicy.safePhone("*123#"))
        assertNull(PlacePolicy.safePhone("09+87654321"))
        assertNull(PlacePolicy.whatsapp("1234567"))
    }
    @Test fun sharesTheSameSlugRouteAsTheWebsite() {
        val place = Place("p1", "Expreso al Sur Cafetería", listOf("cafe"), "", "", null)
        assertEquals("https://www.visitaloja.com/parada/expreso-al-sur-cafeteria", PlacePolicy.publicUrl(place))
        assertEquals("https://www.visitaloja.com/parada/mi-parada", PlacePolicy.publicUrl(place.copy(slug = "Mi parada")))
    }
    @Test fun galleryAndContactsSurvivePublicCacheWithoutCopyingOtherFields() {
        val source = JSONObject("""{"name":"projects/p/databases/(default)/documents/locales/p1","fields":{
          "title":{"stringValue":"Café"},"category":{"stringValue":"cafe"},"slug":{"stringValue":"cafe-loja"},
          "gallery":{"arrayValue":{"values":[
            {"mapValue":{"fields":{"img":{"stringValue":"https://images.example/a.webp"},"credit":{"stringValue":"Autora"}}}},
            {"mapValue":{"fields":{"img":{"stringValue":"javascript:bad"}}}},
            {"mapValue":{"fields":{"img":{"stringValue":"https://images.example/a.webp"}}}},
            {"stringValue":"https://images.example/b.webp"}]}},
          "businessProfile":{"mapValue":{"fields":{"phone":{"stringValue":"0987654321"},"whatsapp":{"stringValue":"0987654321"},"privateNote":{"stringValue":"secret"}}}}
        }}""")
        val place = PlaceJson.document(source)!!
        assertEquals(2, place.photos.size); assertEquals("Autora", place.photos.first().credit)
        val cache = PlaceJson.cachePlace(place)
        assertFalse(cache.toString().contains("secret"))
        assertEquals(place, PlaceJson.cached(cache))
    }
    @Test fun oldCacheRemainsReadableWithoutInventedPhotosOrContacts() {
        val old = JSONObject("""{"id":"a","title":"Café","categories":["cafe"],"address":"","description":"","cantonId":"loja"}""")
        val place = PlaceJson.cached(old)!!
        assertTrue(place.photos.isEmpty()); assertNull(place.phone); assertNull(place.whatsapp)
    }
}
