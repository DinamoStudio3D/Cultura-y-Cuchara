package com.visitaloja.app

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShopScreen(state: ShopState, model: ShopViewModel) {
    val context=LocalContext.current
    var cart by rememberSaveable { mutableStateOf(false) }
    var query by rememberSaveable { mutableStateOf("") }
    var category by rememberSaveable { mutableStateOf("all") }
    var selectedId by rememberSaveable { mutableStateOf<String?>(null) }
    var name by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var delivery by rememberSaveable { mutableStateOf(false) }
    var clear by remember { mutableStateOf(false) }
    val selected=state.products.find { it.id==selectedId }
    val available=ShopPolicy.reconcile(state.lines,state.products)
    val total=available.sumOf { line -> state.products.first { it.id==line.id }.cents*line.quantity }
    val categories=state.products.map { it.category }.filter(String::isNotBlank).distinct()
    val labels=mapOf("merch" to "Merch", "souvenirs" to "Recuerdos", "crafts" to "Artesanías", "food" to "Sabores", "other" to "Otros")
    val filtered=state.products.filter { (category=="all"||it.category==category) && PlacePolicy.normalize(query) in PlacePolicy.normalize("${it.name} ${it.description} ${it.category}") }
    LazyColumn(Modifier.fillMaxSize().testTag("shop-screen"),contentPadding=PaddingValues(20.dp),verticalArrangement=Arrangement.spacedBy(14.dp)) {
        item {
            Text("RECUERDOS DE LOJA",style=MaterialTheme.typography.labelLarge,color=MaterialTheme.colorScheme.primary)
            Text("Un pedacito de Loja contigo",style=MaterialTheme.typography.headlineMedium,fontWeight=FontWeight.Bold)
            Text("Productos y talento local. Prepara tu pedido y confirma disponibilidad y entrega por WhatsApp.")
            Row(horizontalArrangement=Arrangement.spacedBy(10.dp)) {
                FilterChip(selected=!cart,onClick={cart=false},label={Text("Catálogo")})
                FilterChip(selected=cart,onClick={cart=true},modifier=Modifier.testTag("shop-cart"),label={Text("Mi pedido (${state.lines.sumOf { it.quantity }})")})
            }
        }
        state.message?.let { message -> item { Text(message,color=MaterialTheme.colorScheme.primary) } }
        if(state.busy||!state.ready&&!state.error) item { LinearProgressIndicator(Modifier.fillMaxWidth());Text(if(state.busy) "Consultando precios y existencias…" else "Consultando la tienda…") }
        if(state.error) item { Text("No pudimos consultar la tienda.");OutlinedButton(onClick={model.bind(true,true)}){Text("Reintentar") } }
        if(state.cached) item { Text("Sin confirmación del servidor. Conéctate antes de confirmar tu pedido.",style=MaterialTheme.typography.bodySmall) }
        if(!cart) {
            item {
                OutlinedTextField(query,{query=it},modifier=Modifier.fillMaxWidth(),label={Text("Buscar productos")},singleLine=true,leadingIcon={Icon(Icons.Default.Search,null)})
                Row(Modifier.horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                    FilterChip(selected=category=="all",onClick={category="all"},label={Text("Todos")})
                    categories.forEach { id -> FilterChip(selected=category==id,onClick={category=id},label={Text(labels[id]?:id)}) }
                }
            }
            if(state.ready&&filtered.isEmpty()) item { Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(22.dp)) {
                Icon(Icons.Default.ShoppingBag,null,tint=MaterialTheme.colorScheme.primary)
                Text(if(state.products.isEmpty()) "Pronto encontrarás productos aquí" else "No encontramos productos con esa búsqueda",style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold)
                Text("Los productos publicados en la tienda de VisitaLoja aparecerán en este catálogo.")
            } } }
            items(filtered,key={it.id}) { p ->
                OutlinedCard(onClick={selectedId=p.id},modifier=Modifier.fillMaxWidth().testTag("shop-product-${p.id}")) { Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
                    p.image?.let { AsyncImage(it,p.name,Modifier.fillMaxWidth().height(180.dp),contentScale=ContentScale.Fit) }
                    if(p.featured)Text("DESTACADO",style=MaterialTheme.typography.labelSmall,color=MaterialTheme.colorScheme.primary)
                    Text(p.name,fontWeight=FontWeight.Bold,style=MaterialTheme.typography.titleLarge)
                    Text(p.description,maxLines=3,overflow=TextOverflow.Ellipsis)
                    Text(ShopPolicy.money(p.cents),style=MaterialTheme.typography.titleLarge,color=MaterialTheme.colorScheme.primary,fontWeight=FontWeight.Bold)
                    Text(if(p.stock>0)"${p.stock} disponibles · Ver opciones" else "Agotado",style=MaterialTheme.typography.bodySmall)
                } }
            }
        } else {
            if(state.lines.isEmpty()) item { Text("Tu pedido está vacío.");OutlinedButton(onClick={cart=false}){Text("Explorar productos")} }
            items(state.lines,key={it.id to it.variant}) { line ->
                val p=state.products.find { it.id==line.id }
                Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
                    Text(p?.name?:"Producto no disponible",fontWeight=FontWeight.Bold)
                    if(line.variant.isNotBlank())Text(line.variant)
                    if(p!=null)Text(ShopPolicy.money(p.cents*line.quantity))
                    Row(horizontalArrangement=Arrangement.spacedBy(10.dp)) {
                        IconButton(onClick={if(p!=null)model.change(p,line.variant,-1)},enabled=p!=null&&!state.busy){Icon(Icons.Default.Remove,"Restar una unidad")}
                        Text("${line.quantity}",Modifier.padding(top=12.dp))
                        IconButton(onClick={if(p!=null)model.change(p,line.variant,1)},enabled=p!=null&&!state.busy&&state.lines.filter { it.id==line.id }.sumOf { it.quantity }<p.stock){Icon(Icons.Default.Add,"Sumar una unidad")}
                        TextButton(onClick={model.remove(line)},enabled=!state.busy){Text("Quitar")}
                    }
                } }
            }
            if(state.lines.isNotEmpty()) item {
                Text("Total estimado disponible: ${ShopPolicy.money(total)}",style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold)
                if(available!=state.lines)Text("Hay cantidades o productos que necesitan revisión. Se actualizarán antes de preparar el mensaje.",color=MaterialTheme.colorScheme.error)
                Text("Tu pedido se guarda en este móvil. No reserva existencias ni confirma una compra.",style=MaterialTheme.typography.bodySmall)
                OutlinedTextField(name,{name=it.take(80)},label={Text("Tu nombre")},modifier=Modifier.fillMaxWidth(),singleLine=true)
                FilterChip(selected=delivery,onClick={delivery=!delivery},label={Text(if(delivery)"Consultar entrega local" else "Retiro en el punto indicado")})
                if(state.settings.pickup.isNotBlank())Text(state.settings.pickup,style=MaterialTheme.typography.bodySmall)
                OutlinedTextField(notes,{notes=it.take(300)},label={Text("Observaciones (opcional)")},modifier=Modifier.fillMaxWidth(),minLines=2,maxLines=4)
                Button(onClick={model.prepare(name,notes,delivery)},enabled=!state.busy&&name.isNotBlank()&&state.ready&&!state.error,modifier=Modifier.fillMaxWidth()){Text("Revisar pedido actualizado")}
                TextButton(onClick={clear=true},enabled=!state.busy){Text("Vaciar pedido")}
            }
        }
    }
    if(selected!=null) {
        var variant by remember(selected.id,selected.variants) { mutableStateOf(selected.variants.firstOrNull().orEmpty()) }
        ModalBottomSheet(onDismissRequest={selectedId=null}) {
            Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(22.dp).navigationBarsPadding(),verticalArrangement=Arrangement.spacedBy(12.dp)) {
                Text(selected.name,style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold)
                selected.image?.let { AsyncImage(it,selected.name,Modifier.fillMaxWidth().height(240.dp),contentScale=ContentScale.Fit) }
                Text(selected.description)
                Text(ShopPolicy.money(selected.cents),style=MaterialTheme.typography.titleLarge)
                if(selected.variants.isNotEmpty()) { Text("Elige una variante");Row(Modifier.horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(8.dp)){selected.variants.forEach { v -> FilterChip(selected=variant==v,onClick={variant=v},label={Text(v)}) }} }
                Text(if(selected.stock>0)"${selected.stock} disponibles" else "Agotado")
                Button(onClick={model.change(selected,variant,1);selectedId=null;cart=true},enabled=!state.busy&&state.ready&&!state.error&&selected.stock>state.lines.filter { it.id==selected.id }.sumOf { it.quantity },modifier=Modifier.fillMaxWidth()){Text("Añadir a mi pedido")}
                TextButton(onClick={selectedId=null}){Text("Cerrar producto")}
            }
        }
    }
    state.review?.let { review ->
        AlertDialog(onDismissRequest=model::closeReview,title={Text("Revisa el mensaje")},text={Column(Modifier.heightIn(max=400.dp).verticalScroll(rememberScrollState())){Text(review.message);Text("WhatsApp se abrirá con este texto. El mensaje se envía cuando tú lo confirmes allí.",fontWeight=FontWeight.Bold)}},
            confirmButton={TextButton(onClick={model.validateReview()?.let { r ->
                try { context.startActivity(Intent(Intent.ACTION_VIEW,Uri.parse("https://wa.me/${r.phone}?text=${Uri.encode(r.message)}")));model.closeReview() }
                catch(_:ActivityNotFoundException){Toast.makeText(context,"No hay una aplicación compatible para abrir WhatsApp.",Toast.LENGTH_LONG).show()}
            }}){Text("Continuar en WhatsApp")}},dismissButton={TextButton(onClick=model::closeReview){Text("Seguir editando")}})
    }
    if(clear)AlertDialog(onDismissRequest={clear=false},title={Text("¿Vaciar este pedido?")},confirmButton={TextButton(onClick={clear=false;model.clear()}){Text("Vaciar")}},dismissButton={TextButton(onClick={clear=false}){Text("Cancelar")}})
}
