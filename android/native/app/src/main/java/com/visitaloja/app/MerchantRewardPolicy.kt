package com.visitaloja.app

import java.util.Locale

object MerchantRewardPolicy {
    fun withinStop(type: String, claim: Map<String, Any?>, stopId: String?): Boolean =
        type != "loyalty" || stopId == null || claim["placeId"] == stopId


    fun code(raw: String?): String? = raw?.takeIf { it.length<=64 }?.trim()?.uppercase(Locale.ROOT)?.replace(Regex("\\s"),"")?.takeIf { it.matches(Regex("[A-Z0-9-]{6,20}")) }
    fun id(raw: String) = raw.matches(Regex("[A-Za-z0-9_-]{1,512}"))
    fun authorized(access: Map<String,Any?>, claim: Map<String,Any?>, type: String, uid: String): Boolean {
        if(access["active"]==false || uid.isBlank())return false
        fun contains(key:String,value:String)=value.isNotBlank() && (access[key] as? List<*>)?.contains(value)==true
        return when(type){
            "loyalty"->contains("placeIds",claim.text("placeId"))
            "mission"->contains("campaignIds",claim.text("campaignId"))
            "passport"->if(claim.text("optionId").isNotBlank())claim.text("merchantUid")==uid else contains("passportGrants",claim.text("campaignId")+":"+claim.text("mode"))
            else->false
        }
    }
    fun status(claim:Map<String,Any?>,type:String,now:Long):String=when {
        claim.text("status")=="delivered"->"Ya entregado"
        claim.text("status") in setOf("cancelled","reversed","void")->"Anulado"
        claim.text("status")=="expired" || type=="loyalty" && timeMillis(claim["expiresAt"])?.let { it<=now }==true->"Vencido"
        claim.text("status")!="pending"->"No disponible"
        type=="loyalty" && timeMillis(claim["expiresAt"])==null->"Vigencia por confirmar"
        else->"Pendiente por entregar"
    }
    fun canDeliver(claim:Map<String,Any?>,type:String,now:Long)=status(claim,type,now)=="Pendiente por entregar"
    fun collection(type:String):String=when(type){"loyalty"->"loyaltyRewardClaims";"passport"->"passportCompletions";"mission"->"missionRewardClaims";else->throw IllegalArgumentException("Tipo de premio inválido")}
}
