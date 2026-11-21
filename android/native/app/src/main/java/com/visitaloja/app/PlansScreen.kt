package com.visitaloja.app

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Source
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import org.json.JSONObject

@Composable
internal fun PlansScreen(english: Boolean, contact: () -> Unit) {
    val context = LocalContext.current
    var plans by remember { mutableStateOf<List<Map<String, Any?>>>(emptyList()) }; var content by remember { mutableStateOf<Map<String, Any?>>(emptyMap()) }
    var faqs by remember { mutableStateOf<List<Map<String, Any?>>>(emptyList()) }; var phone by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(true) }; var failed by remember { mutableStateOf(false) }; var retry by remember { mutableIntStateOf(0) }
    LaunchedEffect(retry) { loading = true; failed = false; try {
        val catalog = withContext(Dispatchers.IO) { context.assets.open("admin-plans-catalog.json").bufferedReader().use { JSONObject(it.readText()) } }
        val db = FirebaseFirestore.getInstance(); val raw = db.collection("settings").document("subscriptions").get(Source.SERVER).await(); val main = db.collection("settings").document("main").get(Source.SERVER).await()
        content = AdminPlatformPolicy.map(AdminLocalDrafts.value(catalog.getJSONObject("defaults"))) + raw.data.orEmpty()
        plans = AdminPlanPolicy.rows(raw.data.orEmpty(), catalog).filter { it["active"] != false }.map { it + ("benefits" to AdminPlanPolicy.benefits(it, catalog)) }
        faqs = (content["faqs"] as? List<*>)?.mapNotNull { (it as? Map<*, *>)?.entries?.associate { e -> e.key.toString() to e.value } }?.filter { it.text("question").isNotBlank() && it.text("answer").isNotBlank() }?.take(100).orEmpty()
        phone = main.data.orEmpty().text("subscriptionWhatsapp").filter(Char::isDigit).takeIf { it.length in 10..15 && !it.startsWith("0") }.orEmpty()
    } catch (e: kotlinx.coroutines.CancellationException) { throw e } catch (_: Exception) { plans = emptyList(); content = emptyMap(); faqs = emptyList(); phone = ""; failed = true } finally { loading = false } }
    fun contactPlan(name: String) {
        if (phone.isBlank()) contact() else runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/$phone?text=" + Uri.encode("Hola, deseo información sobre el plan $name de VisitaLoja.")))) }.onFailure { contact() }
    }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text(if (english) "Plans for your business" else content.text("title").take(200).ifBlank { "Planes para tu negocio" }, style = MaterialTheme.typography.headlineMedium)
        Text(if (english) "Choose how to promote your business in VisitaLoja." else content.text("subtitle").take(700).ifBlank { "Elige cómo dar a conocer tu negocio en VisitaLoja." })
        if (!english && content.text("promo").isNotBlank()) Text(content.text("promo").take(400))
        if (loading) LinearProgressIndicator(Modifier.fillMaxWidth())
        if (failed || !loading && plans.isEmpty()) Text(if (english) "Contact us to confirm current plans and conditions." else "Contáctanos para confirmar los planes y condiciones vigentes.")
        plans.forEach { row ->
            val name = row.text("name"); Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(name, style = MaterialTheme.typography.titleLarge)
                if (row["recommended"] == true) Text(if (english) "Recommended" else "Más recomendado")
                listOf("monthly" to if (english) " / month" else " / mes", "annual" to if (english) " / year" else " / año").forEach { (key, label) ->
                    (row[key] as? Number)?.toDouble()?.takeIf { it.isFinite() && it >= 0 }?.let { Text(java.text.NumberFormat.getCurrencyInstance(java.util.Locale.US).format(it) + label) }
                }
                Text(row.text("description").take(240)); (row["benefits"] as? List<*>)?.filterIsInstance<String>()?.take(100)?.forEach { Text("• " + it.take(700)) }
                Button(onClick = { contactPlan(name) }) { Text(if (english) "Ask about this plan" else row.text("cta").take(60).ifBlank { "Consultar este plan" }) }
            } }
        }
        if (faqs.isNotEmpty()) { Text(if (english) "Frequently asked questions" else "Preguntas frecuentes", style = MaterialTheme.typography.titleLarge); faqs.forEach { row -> Text(row.text("question").take(180), style = MaterialTheme.typography.titleMedium); Text(row.text("answer").take(500)) } }
        TextButton(onClick = { retry++ }, enabled = !loading) { Text(if (english) "Refresh plans" else "Actualizar planes") }
        OutlinedButton(onClick = contact, modifier = Modifier.fillMaxWidth()) { Text(if (english) "Contact VisitaLoja" else "Contactar a VisitaLoja") }
    }
}
