package com.visitaloja.app

import java.math.BigDecimal
import java.math.RoundingMode

data class ShopProduct(val id: String, val name: String, val description: String, val category: String, val cents: Long, val stock: Int, val image: String?, val variants: List<String>, val featured: Boolean, val order: Double)
data class ShopSettings(val whatsapp: String?, val pickup: String)
data class ShopLine(val id: String, val variant: String = "", val quantity: Int = 1)
data class ShopReview(val message: String, val phone: String, val preparedAt: Long)
object ShopPolicy {
    fun product(id: String, raw: Map<String, Any?>): ShopProduct? {
        if (raw["active"] != true || id.isBlank() || '/' in id) return null
        val name = (raw["name"] as? String)?.trim()?.take(120)?.takeIf(String::isNotBlank) ?: return null
        val cents = runCatching { BigDecimal((raw["price"] as? Number)?.toString() ?: return null).setScale(2, RoundingMode.UNNECESSARY).movePointRight(2).longValueExact() }.getOrNull()?.takeIf { it in 0..10_000_000 } ?: return null
        val stock = (raw["stock"] as? Number)?.toDouble()?.takeIf { it.isFinite() && it in 0.0..100_000.0 && it % 1 == 0.0 }?.toInt() ?: return null
        if (stock == 0 && raw["showWhenOutOfStock"] != true) return null
        return ShopProduct(id, name, (raw["description"] as? String).orEmpty().take(4000), (raw["category"] as? String).orEmpty().take(80), cents, stock,
            PlacePolicy.safeImage(raw["image"] as? String), (raw["variants"] as? List<*>)?.filterIsInstance<String>()?.map { it.trim().take(100) }?.filter(String::isNotBlank)?.distinct()?.take(20) ?: emptyList(), raw["featured"] == true, (raw["order"] as? Number)?.toDouble()?.takeIf(Double::isFinite) ?: 0.0)
    }
    fun settings(raw: Map<String, Any?>?): ShopSettings = ShopSettings((raw?.get("whatsapp") as? String)?.let(PlacePolicy::whatsapp), (raw?.get("pickupAddress") as? String).orEmpty().take(500))
    fun money(cents: Long): String = "$" + BigDecimal.valueOf(cents,2).toPlainString()
    fun valid(line: ShopLine, product: ShopProduct): Boolean = line.id == product.id && line.quantity in 1..99 && (if (product.variants.isEmpty()) line.variant.isEmpty() else line.variant in product.variants)
    fun reconcile(lines: List<ShopLine>, products: List<ShopProduct>): List<ShopLine> {
        val used = mutableMapOf<String,Int>()
        return lines.distinctBy { it.id to it.variant }.take(50).mapNotNull { line ->
            val product = products.find { it.id == line.id } ?: return@mapNotNull null
            if (!valid(line,product)) return@mapNotNull null
            val quantity = minOf(line.quantity, (product.stock - (used[line.id] ?: 0)).coerceAtLeast(0))
            if (quantity == 0) return@mapNotNull null
            used[line.id] = (used[line.id] ?: 0) + quantity
            line.copy(quantity=quantity)
        }
    }
    fun change(lines: List<ShopLine>, product: ShopProduct, variant: String, delta: Int): List<ShopLine> {
        if (delta !in setOf(-1,1) || (if(product.variants.isEmpty()) variant.isNotEmpty() else variant !in product.variants)) return lines
        val index=lines.indexOfFirst { it.id==product.id && it.variant==variant }
        val quantity=(lines.getOrNull(index)?.quantity ?: 0)+delta
        if (quantity <= 0) return lines.filterIndexed { i,_ -> i!=index }
        if (quantity > 99 || (delta > 0 && lines.filter { it.id==product.id }.sumOf { it.quantity } >= product.stock) || (index < 0 && lines.size >= 50)) return lines
        return lines.toMutableList().apply { if(index<0) add(ShopLine(product.id,variant,quantity)) else this[index]=ShopLine(product.id,variant,quantity) }
    }
    fun review(lines: List<ShopLine>, products: List<ShopProduct>, settings: ShopSettings, name: String, notes: String, delivery: Boolean, now: Long): ShopReview {
        require(lines.isNotEmpty() && lines==reconcile(lines,products)) { "El catálogo cambió. Revisa las cantidades y variantes de tu pedido." }
        require(name.trim().isNotBlank() && name.length<=80 && notes.length<=300) { "Escribe un nombre de hasta 80 caracteres y observaciones de hasta 300." }
        val phone=settings.whatsapp ?: error("Todavía no se ha configurado el WhatsApp de la tienda.")
        val total=lines.sumOf { line -> products.first { it.id==line.id }.cents*line.quantity }
        val text="¡Hola! Deseo consultar este pedido en VisitaLoja:\n\n"+lines.joinToString("\n") { line ->
            val p=products.first { it.id==line.id }; "• ${line.quantity} × ${p.name}${if(line.variant.isNotBlank()) " (${line.variant})" else ""} — ${money(p.cents*line.quantity)}"
        }+"\n\nTotal estimado: ${money(total)}\nNombre: ${name.trim()}\nEntrega: ${if(delivery) "Consultar entrega local" else "Retiro en el punto indicado"}"+(if(notes.isNotBlank()) "\nObservaciones: ${notes.trim()}" else "")+"\nSujeto a confirmación de disponibilidad y entrega."
        require(text.length<=9000) { "El pedido es demasiado largo. Reduce los productos antes de continuar." }
        return ShopReview(text,phone,now)
    }
}
