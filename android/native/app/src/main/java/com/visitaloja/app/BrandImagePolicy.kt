package com.visitaloja.app

import java.net.URI
import java.util.Locale

/** One approved replacement across markers, cards and galleries; custom logos retain their URL. */
internal object BrandImagePolicy {
    fun localLogo(value:String?):Int? {
        val raw=value?.trim()?:return null
        if(raw in setOf("assets/brand/codeproim.png","/assets/brand/codeproim.png"))return R.drawable.codeproim_logo
        val uri=runCatching{URI(raw)}.getOrNull()?:return null
        if(uri.scheme!="https"||uri.userInfo!=null||uri.port !in setOf(-1,443))return null
        val host=uri.host?.lowercase(Locale.ROOT)?:return null
        return if(host=="i.imgur.com"&&uri.rawPath=="/CpCnMpw.png" || host in setOf("www.visitaloja.com","visitaloja.com")&&uri.rawPath=="/assets/brand/codeproim.png")R.drawable.codeproim_logo else null
    }
    fun model(value:String?):Any? = localLogo(value)?:PlacePolicy.safeImage(value)
}
