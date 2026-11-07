package com.visitaloja.app

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.MetadataChanges
import com.google.firebase.firestore.Source
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import org.json.JSONArray
import org.json.JSONObject

data class ShopState(val products: List<ShopProduct> = emptyList(), val settings: ShopSettings = ShopSettings(null,""), val lines: List<ShopLine> = emptyList(), val ready: Boolean=false, val cached: Boolean=false, val error: Boolean=false, val busy: Boolean=false, val review: ShopReview?=null, val message: String?=null)
class ShopViewModel(application: Application): AndroidViewModel(application) {
    private val prefs=application.getSharedPreferences("visitaloja_shop_cart",Context.MODE_PRIVATE)
    private val db=FirebaseFirestore.getInstance()
    private val query=db.collection("storeProducts").whereEqualTo("active",true)
    private val config=db.collection("siteContent").document("store")
    private val mutable=MutableStateFlow(ShopState(lines=runCatching { JSONArray(prefs.getString("cart","[]")).let { a -> (0 until minOf(a.length(),50)).map { i -> val r=a.getJSONObject(i);ShopLine(r.getString("id"),r.optString("variant"),r.getInt("quantity")) }.filter { it.id.isNotBlank() && it.quantity in 1..99 } } }.getOrDefault(emptyList())))
    val state=mutable.asStateFlow()
    private var epoch=0
    private var bound=false
    private var productReady=false;private var settingsReady=false
    private var productCache=false;private var settingsCache=false
    private var productError=false;private var settingsError=false
    private val listeners=mutableListOf<ListenerRegistration>()
    private fun products(rows: List<Pair<String,Map<String,Any?>>>)=rows.mapNotNull { ShopPolicy.product(it.first,it.second) }.sortedWith(compareByDescending<ShopProduct> { it.featured }.thenBy { it.order }.thenBy { it.id })
    fun bind(active: Boolean, force: Boolean=false) {
        if(bound==active && !force) return
        bound=active;val version=++epoch;listeners.forEach { it.remove() };listeners.clear()
        productReady=false;settingsReady=false;productError=false;settingsError=false
        mutable.update { it.copy(ready=false,busy=false,review=null,error=false) }
        if(!active)return
        fun publish() { mutable.update { it.copy(ready=productReady&&settingsReady,cached=productCache||settingsCache,error=productError||settingsError) } }
        listeners+=query.addSnapshotListener(MetadataChanges.INCLUDE) { snap,error ->
            if(version!=epoch)return@addSnapshotListener
            productReady=snap!=null&&error==null;productError=!productReady;productCache=snap?.metadata?.isFromCache==true
            val next=if(productReady)products(snap!!.documents.map { it.id to (it.data ?: emptyMap()) }) else emptyList()
            mutable.update { it.copy(products=next,review=if(it.products==next&&productReady)it.review else null) };publish()
        }
        listeners+=config.addSnapshotListener(MetadataChanges.INCLUDE) { snap,error ->
            if(version!=epoch)return@addSnapshotListener
            settingsReady=snap!=null&&error==null;settingsError=!settingsReady;settingsCache=snap?.metadata?.isFromCache==true
            val next=ShopPolicy.settings(if(settingsReady)snap?.data else null)
            mutable.update { it.copy(settings=next,review=if(it.settings==next&&settingsReady)it.review else null) };publish()
        }
    }
    private fun persist(lines: List<ShopLine>) { prefs.edit().putString("cart",JSONArray(lines.map { JSONObject().put("id",it.id).put("variant",it.variant).put("quantity",it.quantity) }).toString()).apply();mutable.update { it.copy(lines=lines,review=null,message=null) } }
    fun change(product: ShopProduct, variant: String, delta: Int) {
        if(mutable.value.busy || !mutable.value.ready || mutable.value.error)return
        val current=mutable.value.products.find { it.id==product.id } ?: return
        persist(ShopPolicy.change(mutable.value.lines,current,variant,delta))
    }
    fun remove(line: ShopLine) { if(!mutable.value.busy)persist(mutable.value.lines.filter { !(it.id==line.id&&it.variant==line.variant) }) }
    fun clear() { if(!mutable.value.busy)persist(emptyList()) }
    fun closeReview() { mutable.update { it.copy(review=null) } }
    fun validateReview(): ShopReview? {
        val r=mutable.value.review ?: return null
        if(System.currentTimeMillis()-r.preparedAt !in 0..60_000) { mutable.update { it.copy(review=null,message="Vuelve a revisar el pedido para consultar el catálogo actualizado.") };return null }
        return r
    }
    fun prepare(name: String, notes: String, delivery: Boolean) {
        if(mutable.value.busy||mutable.value.lines.isEmpty())return
        val version=epoch;val cart=mutable.value.lines
        mutable.update { it.copy(busy=true,review=null,message=null) }
        viewModelScope.launch {
            try {
                val freshProducts=products(query.get(Source.SERVER).await().documents.map { it.id to (it.data ?: emptyMap()) })
                val freshSettings=ShopPolicy.settings(config.get(Source.SERVER).await().data)
                if(version!=epoch)return@launch
                val reconciled=ShopPolicy.reconcile(cart,freshProducts)
                if(cart!=reconciled) {
                    persist(reconciled)
                    mutable.update { it.copy(products=freshProducts,settings=freshSettings,message="El catálogo cambió: ajustamos productos, variantes o cantidades. Revisa tu pedido antes de continuar.") }
                } else {
                    val review=ShopPolicy.review(cart,freshProducts,freshSettings,name,notes,delivery,System.currentTimeMillis())
                    mutable.update { it.copy(products=freshProducts,settings=freshSettings,review=review) }
                }
            } catch(cancelled: CancellationException) { throw cancelled }
            catch(error: Exception) { if(version==epoch)mutable.update { it.copy(message=if(error is IllegalArgumentException||error is IllegalStateException)error.message else "No pudimos confirmar precios y existencias. Conéctate y vuelve a revisar el pedido.") } }
            finally { if(version==epoch)mutable.update { it.copy(busy=false) } }
        }
    }
    override fun onCleared(){epoch++;listeners.forEach { it.remove() };super.onCleared()}
}
