package com.visitaloja.app

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.Timestamp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

private fun businessClean(value: Any?): Any? = when(value) {
    is Timestamp -> value.toDate().time
    is Map<*,*> -> value.entries.associate { it.key.toString() to businessClean(it.value) }
    is List<*> -> value.map(::businessClean)
    else -> value
}
private fun DocumentSnapshot.businessData(): Map<String,Any?> = (data ?: emptyMap()).mapValues { businessClean(it.value) } + ("id" to id)
data class MerchantBusinessState(val uid: String? = null, val busy: Boolean = false, val ready: Boolean = false,
    val places: List<Pair<String,String>> = emptyList(), val selected: String = "", val months: Int = 0,
    val tab: String = "clients", val rows: List<Map<String,Any?>> = emptyList(), val scanned: Int = 0,
    val more: Boolean = false, val error: String? = null, val program: Map<String,Any?> = emptyMap())
class MerchantBusinessViewModel : ViewModel() {
    private val db = FirebaseFirestore.getInstance()
    private val auth = FirebaseAuth.getInstance()
    private val mutable = MutableStateFlow(MerchantBusinessState())
    val state = mutable.asStateFlow()
    private var generation = 0
    private var catalog = emptyMap<String,Map<String,Any?>>()
    private var settings = emptyMap<String,Any?>()
    private var cursor: DocumentSnapshot? = null
    private fun current(uid: String, epoch: Int) = generation == epoch && auth.currentUser?.uid == uid
    fun bind(uid: String?) {
        val epoch = ++generation;catalog = emptyMap();settings = emptyMap();cursor = null;mutable.value = MerchantBusinessState(uid = uid, busy = uid != null)
        if (uid == null) return
        viewModelScope.launch {
            try {
                val access = db.collection("missionRewardMerchants").document(uid).get(Source.SERVER).await()
                check(access.exists() && access.getBoolean("active") != false) { "Administración debe activar tu cuenta de negocio." }
                val ids = (access.get("placeIds") as? List<*>)?.filterIsInstance<String>()?.filter(MerchantScanPolicy::placeId)?.distinct()?.take(20).orEmpty()
                check(ids.isNotEmpty()) { "No tienes paradas asignadas." }
                val config = db.collection("settings").document("subscriptions").get(Source.SERVER).await().businessData()
                val places = ids.mapNotNull { id -> db.collection("locales").document(id).get(Source.SERVER).await().takeIf { it.exists() }?.let { id to it.businessData() } }.toMap()
                if (!current(uid,epoch)) return@launch
                check(places.isNotEmpty()) { "No encontramos tus paradas." }
                catalog = places;settings = config
                mutable.value = MerchantBusinessState(uid = uid, ready = true, places = places.map { (id,p) -> id to p.text("title").ifBlank { id } })
                select(places.keys.first())
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (e: Exception) { if(current(uid,epoch)) mutable.update { it.copy(busy=false,error=if(e is IllegalStateException)e.message else "No pudimos comprobar tu acceso y plan. Revisa la conexión y vuelve a intentar.") } }
        }
    }
    fun select(id: String) {
        val p = catalog[id] ?: return
        if(mutable.value.busy)return
        generation++;cursor=null
        mutable.update { it.copy(selected=id,months=MerchantBusinessPolicy.months(p,settings,System.currentTimeMillis()),rows=emptyList(),scanned=0,more=false,error=null,program=emptyMap()) }
        load(false)
    }
    fun tab(value: String) {
        if(value !in setOf("clients","visits","rewards") || mutable.value.busy)return
        generation++;cursor=null;mutable.update { it.copy(tab=value,rows=emptyList(),scanned=0,more=false,error=null) };load(false)
    }
    fun load(more: Boolean) {
        val s=mutable.value;val uid=s.uid ?: return
        if(s.busy || !s.ready || s.months<=0)return
        val epoch=generation;mutable.update { it.copy(busy=true,error=null) }
        viewModelScope.launch {
            try {
                val access=db.collection("missionRewardMerchants").document(uid).get(Source.SERVER).await()
                check(access.exists() && access.getBoolean("active")!=false && (access.get("placeIds") as? List<*>)?.contains(s.selected)==true) { "Ya no tienes acceso a esta parada." }
                val place=db.collection("locales").document(s.selected).get(Source.SERVER).await().businessData()
                val config=db.collection("settings").document("subscriptions").get(Source.SERVER).await().businessData()
                val months=MerchantBusinessPolicy.months(place,config,System.currentTimeMillis())
                if(!current(uid,epoch))return@launch
                if(months<=0){cursor=null;mutable.update { it.copy(months=0,rows=emptyList(),scanned=0,more=false) };return@launch}
                val program=db.collection("loyaltyPrograms").document(s.selected).get(Source.SERVER).await().businessData()
                val collection=when(s.tab){"clients"->"loyaltyCounters";"visits"->"loyaltyVisits";else->"loyaltyRewardClaims"}
                var query:Query=db.collection(collection).whereEqualTo("placeId",s.selected).orderBy(FieldPath.documentId()).limit(50)
                if(more && cursor!=null)query=query.startAfter(cursor!!)
                val page=query.get(Source.SERVER).await()
                if(!current(uid,epoch))return@launch
                cursor=page.documents.lastOrNull()
                val cutoff=MerchantBusinessPolicy.cutoff(System.currentTimeMillis(),months)
                val rows=page.documents.map { it.businessData() }.filter { it.text("placeId")==s.selected && MerchantBusinessPolicy.inPeriod(it,s.tab,cutoff) }
                mutable.update { it.copy(months=months,program=program,rows=((if(more)it.rows else emptyList())+rows).distinctBy { r->r.text("id") },scanned=(if(more)it.scanned else 0)+page.size(),more=page.size()==50,error=null) }
            } catch(cancelled:CancellationException){throw cancelled}
            catch(e:Exception){if(current(uid,epoch)){cursor=null;mutable.update { it.copy(rows=emptyList(),scanned=0,more=false,error=if(e is IllegalStateException)e.message else "No se pudo consultar este apartado. Comprueba conexión y permisos; no se muestra información antigua.") }}}
            finally{if(current(uid,epoch))mutable.update { it.copy(busy=false) }}
        }
    }
}
