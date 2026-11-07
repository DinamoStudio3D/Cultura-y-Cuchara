package com.visitaloja.app

import org.junit.Assert.*
import org.junit.Test

class HomePolicyTest {
    private val row=mapOf<String,Any?>("id" to "cover", "section" to "Portada principal", "url" to "assets/photos/jipiro-laguna.webp", "title" to "Jipiro", "credit" to "Autora")
    private fun raw(vararg rows:Map<String,Any?>)=mapOf<String,Any?>("photoManagerInitialized" to true,"photoManagerItems" to rows.toList())
    @Test fun homepageCopiesPublishedTitlesAndBilingualSearchAndActions(){
        val data=HomePolicy.read(mapOf("title" to "Mi Loja","titleEn" to "My Loja","subtitle" to "Mi descripción","homepageContent" to mapOf("blocks" to mapOf("welcomeSearch" to mapOf("title" to "Encuentra tu lugar","placeholder" to "Café","button" to "Ir"),"welcomeActions" to mapOf("heroBadge" to "Nuestra tierra","welcomeMap" to "Ver mapa","welcomeRoute" to "Mi paseo")))),emptyList())
        assertEquals("Mi Loja",data.spanish.title);assertEquals("My Loja",data.english.title);assertEquals("Mi descripción",data.english.description)
        assertEquals("Encuentra tu lugar",data.spanish.searchTitle);assertEquals("Café",data.spanish.placeholder);assertEquals("Ir",data.spanish.searchButton);assertEquals("Ver mapa",data.spanish.mapButton);assertEquals("Mi paseo",data.spanish.routeButton)
    }
    @Test fun initializedEmptyLibraryDoesNotResurrectDefaultPhotograph(){
        val default=LojaPhoto("old","Portada principal","Old","https://www.visitaloja.com/assets/photos/a.webp","Autor",null,"","")
        assertTrue(HomePolicy.read(raw(),listOf(default)).photos.isEmpty())
        assertEquals("old",HomePolicy.read(emptyMap(),listOf(default)).photos.single().photo.id)
    }
    @Test fun coverPreservesOrderAuthorAndOmitsOtherSectionsAndWithdrawnPhotos(){
        val data=HomePolicy.read(raw(row,row+mapOf("id" to "hidden","active" to false),row+mapOf("id" to "gallery","section" to "Loja en imágenes"),row+mapOf("id" to "second","credit" to "Otro autor")),emptyList())
        assertEquals(listOf("cover","second"),data.photos.map{it.photo.id});assertEquals("Autora",data.photos.first().photo.credit)
    }
    @Test fun focusUsesMobileThenDesktopThenGlobalAndClampsCoordinates(){
        assertEquals(.2f,HomePolicy.read(raw(row+mapOf("mobileFocus" to mapOf("x" to 20,"y" to 80),"desktopFocus" to mapOf("x" to 50,"y" to 50))),emptyList()).photos.single().x,0.001f)
        assertEquals(1f,HomePolicy.read(raw(row+mapOf("desktopFocus" to mapOf("x" to 200,"y" to -10))),emptyList()).photos.single().x,0f)
        assertEquals(.8f,HomePolicy.read(raw(row)+("heroMobilePosition" to "80% 50%"),emptyList()).photos.single().x,0.001f)
        assertEquals(.5f,HomePolicy.read(raw(row+mapOf("mobileFocus" to mapOf("x" to "NaN","y" to 20))),emptyList()).photos.single().x,0f)
    }
    @Test fun intervalBrightnessAndHeightRespectBoundedWebOptions(){
        val data=HomePolicy.read(raw(row)+mapOf("heroIntervalSeconds" to 999,"heroImageOpacity" to 999,"heroHeight" to "compact","cornerStyle" to "extra"),emptyList())
        assertEquals(60L,data.intervalSeconds);assertEquals(1.3f,data.brightness,0.001f);assertEquals(300,data.height);assertEquals(28,data.radius)
        assertEquals(6L,HomePolicy.read(mapOf("heroIntervalSeconds" to 0),emptyList()).intervalSeconds)
        assertEquals(2L,HomePolicy.read(mapOf("heroIntervalSeconds" to -1),emptyList()).intervalSeconds)
    }
    @Test fun selectionSurvivesReorderAndFallsBackAfterRemoval(){
        val photos=HomePolicy.read(raw(row,row+("id" to "second")),emptyList()).photos
        assertEquals("second",HomePolicy.select(photos.reversed(),"second"));assertEquals("second",HomePolicy.select(photos.drop(1),"cover"))
        assertEquals("second",HomePolicy.step(photos,"cover",-1));assertEquals("cover",HomePolicy.step(photos,"second",1));assertNull(HomePolicy.step(emptyList(),null,1))
    }
    @Test fun coverShareTargetsWebsiteCoverRatherThanUnrelatedGallery(){
        val photo=HomePolicy.read(raw(row),emptyList()).photos.single().photo
        assertEquals("https://www.visitaloja.com/?foto=cover#inicio",HomePolicy.share(photo))
        assertTrue(HomePolicy.share(photo.copy(section="Loja en imágenes")).endsWith("#loja-en-imagenes"))
    }
}
