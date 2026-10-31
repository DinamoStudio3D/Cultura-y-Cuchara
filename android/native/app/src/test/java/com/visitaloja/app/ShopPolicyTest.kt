package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test

class ShopPolicyTest {
    private val raw=mapOf<String,Any?>("active" to true,"name" to "Recuerdo de Loja","price" to 12.35,"stock" to 3,"variants" to listOf("Azul","Blanco"))
    private val product=ShopPolicy.product("product",raw)!!
    @Test fun onlyActiveValidPublishedProductsAreProjected() {
        assertNotNull(ShopPolicy.product("id",raw))
        for(patch in listOf(mapOf("active" to false),mapOf("name" to ""),mapOf("price" to -1),mapOf("price" to Double.NaN),mapOf("price" to 1.234),mapOf("stock" to -1),mapOf("stock" to 1.5)))assertNull(ShopPolicy.product("id",raw+patch))
    }
    @Test fun stockVisibilityMatchesTheWebsite() {
        assertNull(ShopPolicy.product("id",raw+mapOf("stock" to 0)))
        assertEquals(0,ShopPolicy.product("id",raw+mapOf("stock" to 0,"showWhenOutOfStock" to true))!!.stock)
    }
    @Test fun stockIsSharedAcrossVariants() {
        var cart=emptyList<ShopLine>()
        repeat(2){cart=ShopPolicy.change(cart,product,"Azul",1)}
        cart=ShopPolicy.change(cart,product,"Blanco",1)
        assertEquals(3,cart.sumOf { it.quantity })
        assertEquals(cart,ShopPolicy.change(cart,product,"Blanco",1))
    }
    @Test fun reconciliationRemovesWithdrawnProductsAndInvalidVariants() {
        val cart=listOf(ShopLine("gone"),ShopLine("product","Invalid"),ShopLine("product","Azul",2))
        assertEquals(listOf(ShopLine("product","Azul",2)),ShopPolicy.reconcile(cart,listOf(product)))
    }
    @Test fun reconciliationClampsAggregateStockAndNeverEmitsZeroLines() {
        val cart=listOf(ShopLine("product","Azul",3),ShopLine("product","Blanco",3))
        assertEquals(listOf(ShopLine("product","Azul",3)),ShopPolicy.reconcile(cart,listOf(product)))
        assertTrue(ShopPolicy.reconcile(cart,listOf(product.copy(stock=0))).isEmpty())
    }
    @Test fun totalsUseExactCentsAndCurrentPrices() {
        val review=ShopPolicy.review(listOf(ShopLine("product","Azul",3)),listOf(product),ShopSettings("593999999999","Loja"),"Cliente","",false,42)
        assertTrue(review.message.contains("$37.05"));assertEquals(42L,review.preparedAt)
        assertEquals("$0.10",ShopPolicy.money(10))
    }
    @Test fun changedCartCannotBeConfirmedSilently() {
        assertThrows(IllegalArgumentException::class.java){ShopPolicy.review(listOf(ShopLine("product","Azul",4)),listOf(product),ShopSettings("593999999999",""),"Cliente","",false,1)}
    }
    @Test fun unavailableContactOrMissingCustomerCannotPrepareMessage() {
        assertThrows(IllegalStateException::class.java){ShopPolicy.review(listOf(ShopLine("product","Azul")),listOf(product),ShopSettings(null,""),"Cliente","",false,1)}
        assertThrows(IllegalArgumentException::class.java){ShopPolicy.review(listOf(ShopLine("product","Azul")),listOf(product),ShopSettings("593999999999",""),"","",false,1)}
    }
    @Test fun removeLastUnitAndRejectUnknownVariant() {
        assertTrue(ShopPolicy.change(listOf(ShopLine("product","Azul")),product,"Azul",-1).isEmpty())
        assertTrue(ShopPolicy.change(emptyList(),product,"Invalid",1).isEmpty())
    }
    @Test fun settingsNormalizeLocalEcuadorPhoneAndRejectUnsafeNumber() {
        assertEquals("593999999999",ShopPolicy.settings(mapOf("whatsapp" to "0999999999")).whatsapp)
        assertNull(ShopPolicy.settings(mapOf("whatsapp" to "javascript:alert(1)")).whatsapp)
    }
}
