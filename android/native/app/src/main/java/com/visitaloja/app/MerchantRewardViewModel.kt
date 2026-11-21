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

private fun rewardData(doc:DocumentSnapshot):Map<String,Any?> {
    fun clean(v:Any?):Any?=when(v){is Timestamp->v.toDate().time;else->v}
    return (doc.data?:emptyMap()).mapValues { clean(it.value) }
}
data class MerchantRewardState(val uid:String?=null,val busy:Boolean=false,val type:String="",val claimId:String="",val claim:Map<String,Any?> = emptyMap(),val message:String?=null,val stopId:String?=null)
class MerchantRewardViewModel:ViewModel(){
    private val auth=FirebaseAuth.getInstance()
    private val db=FirebaseFirestore.getInstance()
    private val mutable=MutableStateFlow(MerchantRewardState())
    val state=mutable.asStateFlow()
    @Volatile private var generation=0
    private fun current(uid:String,epoch:Int)=generation==epoch && auth.currentUser?.uid==uid
    fun bind(uid:String?, stopId:String?=null){generation++;mutable.value=MerchantRewardState(uid=uid,stopId=stopId)}
    fun clear(){if(!mutable.value.busy)mutable.update { it.copy(type="",claimId="",claim=emptyMap(),message=null) }}
    fun message(text:String){mutable.update { it.copy(message=text) }}
    fun lookup(raw:String){
        val s=mutable.value;val uid=s.uid?:return;if(s.busy)return
        val code=MerchantRewardPolicy.code(raw)?:run{clear();message("Este QR no es un código de premio. Escribe o escanea el código de canje del visitante.");return}
        val epoch=++generation;mutable.value=MerchantRewardState(uid=uid,busy=true,stopId=s.stopId)
        viewModelScope.launch{
            try{
                val accessDoc=db.collection("missionRewardMerchants").document(uid).get(Source.SERVER).await()
                check(accessDoc.exists() && accessDoc.getBoolean("active")!=false){"Tu cuenta no está activa como encargada de entregas."}
                val access=rewardData(accessDoc)
                suspend fun index(collection:String):DocumentSnapshot?=try{db.collection(collection).document(code).get(Source.SERVER).await().takeIf { it.exists() }}catch(e:FirebaseFirestoreException){if(e.code==FirebaseFirestoreException.Code.PERMISSION_DENIED)null else throw e}
                val mission=index("missionRewardClaimCodes")
                val passport=if(mission==null)index("passportRewardClaimCodes") else null
                val type:String;val doc:DocumentSnapshot
                if(mission!=null){
                    type="mission";val id=mission.getString("claimId").orEmpty();check(MerchantRewardPolicy.id(id));check(MerchantRewardPolicy.authorized(access,rewardData(mission),type,uid)){"Código no autorizado para tu cuenta."};doc=db.collection("missionRewardClaims").document(id).get(Source.SERVER).await()
                }else if(passport!=null){
                    type="passport";val id=passport.getString("completionId").orEmpty();check(MerchantRewardPolicy.id(id));check(MerchantRewardPolicy.authorized(access,rewardData(passport),type,uid)){"Código no autorizado para tu cuenta."};doc=db.collection("passportCompletions").document(id).get(Source.SERVER).await()
                }else{
                    check(code.startsWith("FID-")){"No encontramos un premio autorizado con este código."};type="loyalty"
                    val ids=(access["placeIds"] as? List<*>)?.filterIsInstance<String>()?.filter(MerchantScanPolicy::placeId)?.distinct().orEmpty()
                    val scopedIds = if (s.stopId == null) ids else ids.filter { it == s.stopId }
                    check(scopedIds.isNotEmpty()) { "Ya no tienes acceso a esta parada. Vuelve a Mi negocio." }
                    val matches=scopedIds.flatMap { id->db.collection("loyaltyRewardClaims").whereEqualTo("claimCode",code).whereEqualTo("placeId",id).limit(2).get(Source.SERVER).await().documents }.distinctBy { it.id }
                    check(matches.size==1){if(s.stopId==null)"No encontramos un único premio para tus paradas." else "No encontramos ese premio en la parada seleccionada. Revisa el código o cambia de parada en Mi negocio."};doc=matches.single()
                }
                val claim=rewardData(doc)
                check(doc.exists() && claim.text("claimCode")==code && MerchantRewardPolicy.authorized(access,claim,type,uid)){"Premio inexistente o no autorizado para tu cuenta."}
                check(MerchantRewardPolicy.withinStop(type,claim,s.stopId)) { "Este premio pertenece a otra parada." }
                if(current(uid,epoch))mutable.update { it.copy(type=type,claimId=doc.id,claim=claim,message=null) }
            }catch(cancelled:CancellationException){throw cancelled}
            catch(e:Exception){if(current(uid,epoch))mutable.update { it.copy(claim=emptyMap(),claimId="",message=if(e is IllegalStateException)e.message else "No pudimos consultar el premio. Comprueba conexión, código y permisos.") }}
            finally{if(current(uid,epoch))mutable.update { it.copy(busy=false) }}
        }
    }
    fun deliver(){
        val s=mutable.value;val uid=s.uid?:return
        if(s.busy || !MerchantRewardPolicy.id(s.claimId) || !MerchantRewardPolicy.canDeliver(s.claim,s.type,System.currentTimeMillis()))return
        val user=auth.currentUser?.takeIf { it.uid==uid }?:return;val email=user.email.orEmpty();if(s.type!="loyalty" && email.isBlank()){message("Tu cuenta necesita un correo verificado por el sistema.");return}
        val epoch=generation;mutable.update { it.copy(busy=true,message=null) }
        viewModelScope.launch{
            try{
                db.runTransaction{tx->
                    val access=tx.get(db.collection("missionRewardMerchants").document(uid));val ref=db.collection(MerchantRewardPolicy.collection(s.type)).document(s.claimId);val live=tx.get(ref);val claim=rewardData(live)
                    check(current(uid,epoch) && access.exists() && live.exists()){"La sesión o el premio cambiaron."}
                    check(claim.text("claimCode")==s.claim.text("claimCode") && MerchantRewardPolicy.authorized(rewardData(access),claim,s.type,uid)){"La cuenta ya no está autorizada para entregar este premio."}
                    check(MerchantRewardPolicy.withinStop(s.type,claim,s.stopId)) { "Este premio pertenece a otra parada." }
                    check(MerchantRewardPolicy.canDeliver(claim,s.type,System.currentTimeMillis())){"El premio venció, fue anulado o ya se entregó. Consulta nuevamente el código."}
                    val fields=mutableMapOf<String,Any>("status" to "delivered")
                    if(s.type=="mission"){fields["processedAt"]=FieldValue.serverTimestamp();fields["processedBy"]=email}
                    else {fields["deliveredAt"]=FieldValue.serverTimestamp();fields["deliveredBy"]=if(s.type=="loyalty")uid else email;if(s.type=="loyalty")fields["updatedAt"]=FieldValue.serverTimestamp()}
                    tx.update(ref,fields)
                }.await()
                if(current(uid,epoch))mutable.update { it.copy(claim=s.claim+("status" to "delivered"),message="Entrega registrada correctamente. Este premio no puede volver a entregarse.") }
            }catch(cancelled:CancellationException){throw cancelled}
            catch(_:Exception){if(current(uid,epoch))mutable.update { it.copy(claim=emptyMap(),claimId="",message="No se pudo confirmar el resultado. Consulta de nuevo el mismo código para comprobar si la entrega quedó registrada antes de reintentar.") }}
            finally{if(current(uid,epoch))mutable.update { it.copy(busy=false) }}
        }
    }
}
