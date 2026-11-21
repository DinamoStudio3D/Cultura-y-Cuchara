package com.visitaloja.app

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel

@Composable
internal fun AdminLoyaltyEntry(uid: String, place: String) {
    var open by remember(uid, place) { mutableStateOf(false) }
    OutlinedButton(onClick = { open = true }) { Text("Programa y temporadas de fidelidad") }
    if (!open) return
    val model: AdminLoyaltyViewModel = viewModel(key = "admin-loyalty-" + place)
    val observed by model.state.collectAsStateWithLifecycle()
    val state = observed.takeIf { it.uid == uid && it.place == place } ?: AdminLoyaltyState()
    var seasonId by remember(uid, place) { mutableStateOf<String?>(null) }
    var review by remember(uid, place) { mutableStateOf(false) }
    DisposableEffect(uid, place) {
        model.bind(uid, place)
        onDispose { model.bind(null, "") }
    }
    Dialog(onDismissRequest = { if (!state.busy) open = false },
        properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxSize().systemBarsPadding()) {
            Column(Modifier.fillMaxSize().imePadding().verticalScroll(rememberScrollState()).padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Fidelidad · administración", style = MaterialTheme.typography.headlineSmall)
                Text(state.name)
                TextButton(onClick = { open = false }, enabled = !state.busy) { Text("Cerrar fidelidad") }
                if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                state.message?.let { Text(it) }
                OutlinedButton(onClick = { seasonId = null; model.bind(uid, place) }, enabled = !state.busy) { Text("Actualizar programa y permisos") }
                if (state.ready) {
                    val draft = state.draft
                    Text(if (state.exists) "Configurar programa existente" else "Crear programa para esta parada", style = MaterialTheme.typography.titleLarge)
                    Row {
                        Checkbox(draft.active, { model.edit(draft.copy(active = it)) }, enabled = !state.busy)
                        Text("Programa activo")
                    }
                    Text("Estos cambios se publican también en la web al guardar. No añaden ni eliminan sellos.")
                    Text("Tarjeta habitual", style = MaterialTheme.typography.titleMedium)
                    Text("Las tarjetas iniciadas conservan sus condiciones guardadas. La configuración nueva se aplica a las tarjetas que empiecen después.")
                    Text("Premios habituales emitidos: " + AdminLoyaltyPolicy.issued(state.base.orEmpty()))
                    AdminLoyaltyTermsEditor(draft.terms, !state.busy) { model.edit(draft.copy(terms = it)) }
                    HorizontalDivider()
                    Text("Tarjetas de temporada", style = MaterialTheme.typography.titleMedium)
                    Text("Durante una temporada, sus sellos se guardan aparte. Al finalizar vuelve la tarjeta habitual con su progreso anterior. El límite diario es compartido.")
                    if (!state.seasonalService) Text("Temporadas en consulta: actualiza para comprobar la disponibilidad del servicio.")
                    draft.seasons.forEach { season ->
                        val locked = AdminLoyaltyPolicy.locked(state.base.orEmpty(), season.id)
                        OutlinedCard(Modifier.fillMaxWidth()) {
                            Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(season.title.ifBlank { "Nueva temporada" }, style = MaterialTheme.typography.titleMedium)
                                Text(if (season.active) "Habilitada" else "Desactivada")
                                Text(season.start + " → " + season.end + " · Ecuador")
                                Text("Premios emitidos: " + AdminLoyaltyPolicy.issued(state.base.orEmpty(), season.id))
                                if (locked) Text("Ya tiene sellos: se conservan sus condiciones; solo puedes ajustar cupos.")
                                OutlinedButton(onClick = { seasonId = season.id },
                                    enabled = state.seasonalService && !state.busy) { Text("Configurar temporada") }
                            }
                        }
                    }
                    OutlinedButton(onClick = {
                        val season = AdminLoyaltySeason("temporada-" + java.util.UUID.randomUUID().toString())
                        model.edit(draft.copy(seasons = draft.seasons + season))
                        seasonId = season.id
                    }, enabled = state.seasonalService && !state.busy && draft.seasons.size < 24) { Text("Añadir temporada") }
                    Button(onClick = { review = true }, enabled = !state.busy, modifier = Modifier.fillMaxWidth()) {
                        Text(if (state.exists) "Revisar cambios del programa" else "Revisar y crear programa")
                    }
                }
            }
        }
    }
    val season = state.draft.seasons.firstOrNull { it.id == seasonId }
    if (state.ready && season != null && state.seasonalService) {
        val locked = AdminLoyaltyPolicy.locked(state.base.orEmpty(), season.id)
        fun edit(next: AdminLoyaltySeason) {
            model.edit(state.draft.copy(seasons = state.draft.seasons.map { if (it.id == next.id) next else it }))
        }
        AlertDialog(onDismissRequest = { if (!state.busy) seasonId = null }, title = { Text("Temporada") },
            text = {
                Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Fechas y horas de Ecuador. Ejemplo: 2026-12-01T09:00.")
                    if (locked) Text("Las condiciones de esta temporada ya se usaron. Para otras condiciones, crea una nueva.")
                    OutlinedTextField(season.title, { edit(season.copy(title = it.take(100))) }, label = { Text("Nombre de temporada") }, enabled = !locked && !state.busy)
                    Row {
                        Checkbox(season.active, { edit(season.copy(active = it)) }, enabled = !locked && !state.busy)
                        Text("Habilitar temporada")
                    }
                    OutlinedTextField(season.start, { edit(season.copy(start = it.take(19))) }, label = { Text("Inicio · AAAA-MM-DDTHH:mm") }, enabled = !locked && !state.busy)
                    OutlinedTextField(season.end, { edit(season.copy(end = it.take(19))) }, label = { Text("Fin · AAAA-MM-DDTHH:mm") }, enabled = !locked && !state.busy)
                    AdminLoyaltyTermsEditor(season.terms, !locked && !state.busy, !state.busy) { edit(season.copy(terms = it)) }
                    if (!locked) TextButton(onClick = {
                        model.edit(state.draft.copy(seasons = state.draft.seasons.filterNot { it.id == season.id }))
                        seasonId = null
                    }, enabled = !state.busy) { Text("Quitar del borrador") }
                    Text("Los cambios se publican únicamente al guardar el programa completo.")
                }
            }, confirmButton = { TextButton(onClick = { seasonId = null }) { Text("Listo") } })
    }
    if (review && state.ready) AlertDialog(onDismissRequest = { review = false }, title = { Text("Guardar fidelidad de " + state.name) },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(if (state.draft.active) "Programa activo" else "Programa desactivado")
                Text("Habitual: " + state.draft.terms.target + " sellos · " + state.draft.terms.reward)
                Text("Límite diario configurado: " + state.draft.terms.daily)
                state.draft.seasons.forEach { item ->
                    Text(item.title + ": " + item.start + " a " + item.end +
                        (if (item.active) " · habilitada" else " · desactivada"))
                }
                val oldIds = AdminLoyaltyPolicy.read(state.base.orEmpty()).seasons
                oldIds.filter { old -> state.draft.seasons.none { it.id == old.id } }.forEach { Text("Quitar temporada sin uso: " + it.title) }
                Text("Se comparte con la web. Las visitas, los sellos y los premios ya generados se conservan.")
            }
        }, confirmButton = { TextButton(onClick = { review = false; model.save() }, enabled = !state.busy) { Text("Guardar programa") } },
        dismissButton = { TextButton(onClick = { review = false }) { Text("Volver") } })
}

@Composable
private fun AdminLoyaltyTermsEditor(terms: AdminLoyaltyTerms, enabled: Boolean,
    stockEnabled: Boolean = enabled, change: (AdminLoyaltyTerms) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedTextField(terms.target, { change(terms.copy(target = it.take(2))) }, label = { Text("Meta de sellos (10–30)") }, enabled = enabled)
        OutlinedTextField(terms.daily, { change(terms.copy(daily = it.take(1))) }, label = { Text("Máximo por día (1–3)") }, enabled = enabled)
        OutlinedTextField(terms.reward, { change(terms.copy(reward = it.take(100))) }, label = { Text("Beneficio") }, enabled = enabled)
        OutlinedTextField(terms.description, { change(terms.copy(description = it.take(400))) }, label = { Text("Condiciones") }, enabled = enabled)
        listOf("product" to "Producto", "discount" to "Descuento", "surprise" to "Sorpresa").forEach { (id, label) ->
            FilterChip(terms.type == id, { change(terms.copy(type = id)) }, label = { Text(label) }, enabled = enabled)
        }
        OutlinedTextField(terms.days, { change(terms.copy(days = it.take(3))) }, label = { Text("Días para canjear (1–365)") }, enabled = enabled)
        OutlinedTextField(terms.stock, { change(terms.copy(stock = it.take(16))) }, label = { Text("Cupos totales · vacío = sin límite") }, enabled = stockEnabled)
    }
}
