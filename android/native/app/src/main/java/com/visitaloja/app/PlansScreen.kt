package com.visitaloja.app

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Source
import kotlinx.coroutines.tasks.await

@Composable
internal fun PlansScreen(english:Boolean,contact:()->Unit){
    var plans by remember{mutableStateOf<List<Map<String,Any?>>>(emptyList())}
    var loading by remember{mutableStateOf(true)}
    var failed by remember{mutableStateOf(false)}
    var retry by remember{mutableIntStateOf(0)}
    LaunchedEffect(retry){loading=true;failed=false;try{
        val raw=FirebaseFirestore.getInstance().collection("settings").document("subscriptions").get(Source.SERVER).await()
        plans=(raw.get("plans") as? List<*>).orEmpty().filterIsInstance<Map<String,Any?>>().filter{it["active"]!=false}
    }catch(e:kotlinx.coroutines.CancellationException){throw e}catch(_:Exception){plans=emptyList();failed=true}finally{loading=false}}
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),verticalArrangement=Arrangement.spacedBy(14.dp)){
        Text(if(english)"Plans for your business" else "Planes para tu negocio",style=MaterialTheme.typography.headlineMedium)
        Text(if(english)"Choose how to promote your business in VisitaLoja." else "Elige cómo dar a conocer tu negocio en VisitaLoja.")
        if(loading)LinearProgressIndicator(Modifier.fillMaxWidth())
        if(failed||!loading&&plans.isEmpty())Text(if(english)"Contact us to confirm current plans and conditions." else "Contáctanos para confirmar los planes y condiciones vigentes.")
        plans.forEach{raw->
            val id=raw["id"] as? String ?: ""
            val canonical=when(id){"gratis"->"free";"impulso","emprendo"->"impulse";"destacado","pro","activo"->"featured";else->id}
            val legacy=((raw["offerVersion"] as? Number)?.toInt()?:0)<1
            val defaults=when(canonical){"free"->Triple("Plan Gratis",0,3);"impulse"->Triple("Plan Emprendo",10,10);"featured"->Triple("Plan Activo",30,15);"premium"->Triple("Plan Premium",60,20);else->null}
            val name=defaults?.first?:raw["name"]?.toString().orEmpty()
            val monthly=if(legacy&&defaults!=null)defaults.second.toDouble() else (raw["monthly"] as? Number)?.toDouble()?.takeIf{it.isFinite()&&it>=0}
            val features=raw["features"] as? Map<*,*> ?: emptyMap<Any,Any>()
            val photos=if(legacy&&defaults!=null)defaults.third else (features["maxGalleryImages"] as? Number)?.toInt()
            Card(Modifier.fillMaxWidth()){Column(Modifier.padding(18.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){
                Text(name,style=MaterialTheme.typography.titleLarge)
                monthly?.let{Text(java.text.NumberFormat.getCurrencyInstance(java.util.Locale.US).format(it)+if(english)" / month" else " / mes")}
                photos?.let{Text(if(english)"Up to $it gallery photos" else "Hasta $it fotos en galería")}
                val benefits=if(defaults!=null){
                    val paid=canonical!="free"
                    val products=if(legacy)when(canonical){"featured"->10;"premium"->20;else->0}else (features["maxFeaturedProducts"] as? Number)?.toInt()?:0
                    val months=if(legacy)when(canonical){"impulse"->1;"featured"->3;"premium"->12;else->0}else (features["analyticsPeriodMonths"] as? Number)?.toInt()?:0
                    buildList<String>{add("Ficha en la guía y mapa");add("Tarjeta de fidelidad incluida");add("Horarios y contacto");if(paid){add("QR con carta completa en imagen");add("Logo en el mapa");if(products>0)add("Hasta $products productos destacados");add("Estadísticas: historial de $months meses");when(canonical){"impulse"->add("Video aportado por el cliente, sujeto a revisión");"featured"->add("Producción audiovisual con alcance acordado");"premium"->add("Una jornada mensual de grabación y fotografía coordinada")}}else add("Sin estadísticas")}
                }else(raw["benefits"] as? List<*>)?.filterIsInstance<String>().orEmpty()
                benefits.forEach{Text("• "+it.take(700))}
                Button(onClick=contact){Text(if(english)"Ask about this plan" else "Consultar este plan")}
            }}
        }
        TextButton(onClick={retry++},enabled=!loading){Text(if(english)"Refresh plans" else "Actualizar planes")}
        OutlinedButton(onClick=contact,modifier=Modifier.fillMaxWidth()){Text(if(english)"Contact VisitaLoja" else "Contactar a VisitaLoja")}
    }
}
