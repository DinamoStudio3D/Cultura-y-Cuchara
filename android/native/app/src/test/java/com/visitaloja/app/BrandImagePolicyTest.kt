package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test

class BrandImagePolicyTest {
    @Test fun retiredCodeproimLogoUsesTheBundledApprovedAssetIncludingTracking() {
        for(url in listOf("https://i.imgur.com/CpCnMpw.png","https://i.imgur.com/CpCnMpw.png?v=2#logo","https://I.IMGUR.COM/CpCnMpw.png"))assertEquals(R.drawable.codeproim_logo,BrandImagePolicy.model(url))
    }
    @Test fun canonicalAndRelativeBundledReferencesDoNotNeedTheNetwork() {
        for(url in listOf("assets/brand/codeproim.png","/assets/brand/codeproim.png","https://www.visitaloja.com/assets/brand/codeproim.png","https://visitaloja.com/assets/brand/codeproim.png?version=2"))assertEquals(R.drawable.codeproim_logo,BrandImagePolicy.model(url))
    }
    @Test fun updatedAndOtherBusinessLogosKeepTheirConfiguredImage() {
        for(url in listOf("https://i.imgur.com/qt6cyZR.png","https://example.org/other.png","https://res.cloudinary.com/visitaloja/image/upload/logo.webp")){assertNull(BrandImagePolicy.localLogo(url));assertEquals(url,BrandImagePolicy.model(url))}
    }
    @Test fun similarlyNamedExternalFilesNeverBecomeCodeproim() {
        for(url in listOf("https://i.imgur.com.evil.test/CpCnMpw.png","https://evil.test/CpCnMpw.png","https://i.imgur.com/CpCnMpw.png/other","https://www.visitaloja.com/%61ssets/brand/codeproim.png"))assertNull(BrandImagePolicy.localLogo(url))
        for(url in listOf("http://i.imgur.com/CpCnMpw.png","https://evil@i.imgur.com/CpCnMpw.png","https://i.imgur.com:8443/CpCnMpw.png"))assertNull(BrandImagePolicy.localLogo(url))
        assertNull(BrandImagePolicy.model("javascript:alert(1)"));assertNull(BrandImagePolicy.model(null))
    }
    @Test fun selectingLocalImageDoesNotBypassPaidMarkerEntitlement() {
        val p=Place("code","Codeproim",listOf("aliado"),"","",null,mapBrand=MapBrand("https://i.imgur.com/CpCnMpw.png",style="icon",paidLogo=false))
        assertNull(MapPolicy.logoUrl(p,100))
        assertEquals(R.drawable.codeproim_logo,BrandImagePolicy.model(MapPolicy.logoUrl(p.copy(mapBrand=p.mapBrand.copy(style="auto")),100)))
    }
}
