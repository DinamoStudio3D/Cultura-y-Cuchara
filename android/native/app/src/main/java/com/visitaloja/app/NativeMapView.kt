package com.visitaloja.app

import android.content.ComponentCallbacks
import android.content.Context
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import org.json.JSONObject
import org.maplibre.android.MapLibre
import org.maplibre.android.camera.CameraPosition
import org.maplibre.android.camera.CameraUpdateFactory
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.geometry.LatLngBounds
import org.maplibre.android.maps.MapLibreMap
import org.maplibre.android.maps.MapView
import org.maplibre.android.maps.Style
import org.maplibre.android.style.expressions.Expression.*
import org.maplibre.android.style.layers.CircleLayer
import org.maplibre.android.style.layers.SymbolLayer
import org.maplibre.android.style.layers.PropertyFactory.*
import org.maplibre.android.style.sources.GeoJsonOptions
import org.maplibre.android.style.sources.GeoJsonSource

private const val PLACES = "vl-places"
private const val PINS = "vl-pins"
private const val GROUPS = "vl-groups"
private const val SELECTED = "vl-selected"
private const val POSITION = "vl-position"

class NativeMapController(context: Context) {
    val view: MapView
    var map: MapLibreMap? = null
        private set
    private var style: Style? = null
    private var alive = true
    private var data = MapPolicy.geoJson(emptyList())
    private var selected: String? = null
    private var location: Pair<Double, Double>? = null
    var onReady: () -> Unit = {}
    var onError: () -> Unit = {}
    var onSelect: (List<String>) -> Unit = {}
    private val density = context.resources.displayMetrics.density
    private var started = false
    private var resumed = false
    init {
        MapLibre.getInstance(context.applicationContext)
        view = MapView(context)
        view.onCreate(null)
        view.addOnDidFailLoadingMapListener { if (alive) onError() }
        view.getMapAsync { readyMap ->
            if (alive) {
                map = readyMap
                readyMap.uiSettings.isCompassEnabled = true
                readyMap.uiSettings.isLogoEnabled = false
                // Keep the SDK attribution visible and usable.
                readyMap.uiSettings.isAttributionEnabled = true
                readyMap.setMinZoomPreference(3.0)
                readyMap.setMaxZoomPreference(19.0)
                readyMap.cameraPosition = CameraPosition.Builder().target(LatLng(MapPolicy.LOJA_LAT, MapPolicy.LOJA_LNG)).zoom(13.5).build()
                readyMap.addOnMapClickListener { point ->
                    val current = style
                    if (!alive || current == null) false else {
                        val screen = readyMap.projection.toScreenLocation(point)
                        val radius = 22f * density
                        val box = RectF(screen.x - radius, screen.y - radius, screen.x + radius, screen.y + radius)
                        val hits = readyMap.queryRenderedFeatures(box, PINS)
                        val ids = hits.mapNotNull { feature ->
                            JSONObject(feature.toJson()).optJSONObject("properties")?.optString("id")?.takeIf { it.isNotBlank() }
                        }.distinct()
                        if (ids.isNotEmpty()) { onSelect(ids); true }
                        else {
                            val cluster = readyMap.queryRenderedFeatures(box, GROUPS).firstOrNull()
                            if (cluster != null) {
                                val coordinates = JSONObject(cluster.toJson()).getJSONObject("geometry").getJSONArray("coordinates")
                                val source = current.getSourceAs<GeoJsonSource>(PLACES)
                                val zoom = source?.getClusterExpansionZoom(cluster)?.toDouble() ?: (readyMap.cameraPosition.zoom + 2)
                                readyMap.animateCamera(CameraUpdateFactory.newLatLngZoom(LatLng(coordinates.getDouble(1), coordinates.getDouble(0)), zoom.coerceAtMost(19.0)))
                                true
                            } else { onSelect(emptyList()); false }
                        }
                    }
                }
                reload()
            }
        }
    }
    fun reload() {
        if (!alive) return
        style = null
        map?.setStyle(Style.Builder().fromUri(MapPolicy.STYLE)) { loaded ->
            if (alive) {
                listOf("cafe", "hotel", "food", "turismo", "other").forEach { loaded.addImage(it, pin(it)) }
                loaded.addSource(GeoJsonSource(PLACES, data, GeoJsonOptions().withCluster(true).withClusterMaxZoom(15).withClusterRadius(48)))
                loaded.addLayer(CircleLayer(GROUPS, PLACES).withFilter(has("point_count")).withProperties(
                    circleColor("#075BB2"), circleRadius(21f), circleStrokeWidth(3f), circleStrokeColor("#FFFFFF")))
                loaded.addLayer(SymbolLayer("vl-counts", PLACES).withFilter(has("point_count")).withProperties(
                    textField("{point_count_abbreviated}"), textSize(13f), textColor("#FFFFFF"),
                    textFont(arrayOf("Noto Sans Regular")), textAllowOverlap(true)))
                loaded.addLayer(CircleLayer(SELECTED, PLACES).withFilter(eq(get("id"), literal(selected.orEmpty()))).withProperties(
                    circleRadius(22f), circleColor("#FFD46B"), circleOpacity(0.6f), circleStrokeColor("#FFFFFF"), circleStrokeWidth(2f)))
                loaded.addLayer(SymbolLayer(PINS, PLACES).withFilter(not(has("point_count"))).withProperties(
                    iconImage(get("pin")), iconSize(0.65f), iconAnchor("bottom"), iconAllowOverlap(true), iconIgnorePlacement(true)))
                loaded.addSource(GeoJsonSource(POSITION, location?.let { MapPolicy.locationJson(it.first, it.second) } ?: MapPolicy.geoJson(emptyList())))
                loaded.addLayer(CircleLayer("vl-position-halo", POSITION).withProperties(circleRadius(20f), circleColor("#168BE8"), circleOpacity(0.15f)))
                loaded.addLayer(CircleLayer("vl-position-dot", POSITION).withProperties(circleRadius(7f), circleColor("#168BE8"), circleStrokeWidth(3f), circleStrokeColor("#FFFFFF")))
                style = loaded
                onReady()
            }
        }
    }
    fun update(places: List<Place>, id: String?) {
        data = MapPolicy.geoJson(places)
        selected = id
        style?.getSourceAs<GeoJsonSource>(PLACES)?.setGeoJson(data)
        (style?.getLayer(SELECTED) as? CircleLayer)?.setFilter(eq(get("id"), literal(id.orEmpty())))
    }
    fun focus(places: List<Place>) {
        if (!alive) return
        val points = places.filter(MapPolicy::located).map { LatLng(it.latitude!!, it.longitude!!) }
        val current = map ?: return
        if (points.isEmpty()) current.animateCamera(CameraUpdateFactory.newLatLngZoom(LatLng(MapPolicy.LOJA_LAT, MapPolicy.LOJA_LNG), 13.5))
        else if (points.size == 1 || points.distinct().size == 1) current.animateCamera(CameraUpdateFactory.newLatLngZoom(points.first(), 15.5))
        else if (view.width > 0 && view.height > 0) {
            current.animateCamera(CameraUpdateFactory.newLatLngBounds(LatLngBounds.Builder().includes(points).build(), (48 * density).toInt()))
        }
    }
    fun position(latitude: Double, longitude: Double) {
        if (!alive) return
        location = latitude to longitude
        style?.getSourceAs<GeoJsonSource>(POSITION)?.setGeoJson(MapPolicy.locationJson(latitude, longitude))
        map?.animateCamera(CameraUpdateFactory.newLatLngZoom(LatLng(latitude, longitude), 14.5))
    }
    fun zoom(amount: Double) {
        if (alive) map?.let { it.animateCamera(CameraUpdateFactory.zoomTo((it.cameraPosition.zoom + amount).coerceIn(3.0, 19.0))) }
    }
    fun lowMemory() { if (alive) view.onLowMemory() }
    fun start() { if (alive && !started) { view.onStart(); started = true } }
    fun resume() { start(); if (alive && !resumed) { view.onResume(); resumed = true } }
    fun pause() { if (alive && resumed) { view.onPause(); resumed = false } }
    fun stop() { pause(); if (alive && started) { view.onStop(); started = false } }
    fun destroy() { if (alive) { stop(); alive = false; onSelect = {}; onReady = {}; onError = {}; style = null; map = null; view.onDestroy() } }
    private fun pin(kind: String): Bitmap {
        val image = Bitmap.createBitmap(80, 100, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(image)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        val outline = Path().apply { moveTo(40f, 96f); cubicTo(31f, 80f, 7f, 59f, 7f, 37f); cubicTo(7f, -5f, 73f, -5f, 73f, 37f); cubicTo(73f, 59f, 49f, 80f, 40f, 96f); close() }
        paint.color = android.graphics.Color.WHITE; paint.style = Paint.Style.STROKE; paint.strokeWidth = 7f; canvas.drawPath(outline, paint)
        paint.color = android.graphics.Color.parseColor(MapPolicy.color(kind)); paint.style = Paint.Style.FILL; canvas.drawPath(outline, paint)
        paint.color = android.graphics.Color.WHITE; paint.textSize = 32f; paint.typeface = android.graphics.Typeface.DEFAULT_BOLD; paint.textAlign = Paint.Align.CENTER
        canvas.drawText(when (kind) { "cafe" -> "C"; "hotel" -> "H"; "food" -> "G"; "turismo" -> "T"; else -> "V" }, 40f, 48f, paint)
        return image
    }
}

@Composable
fun rememberNativeMapController(): NativeMapController {
    val context = LocalContext.current
    val owner = LocalLifecycleOwner.current
    val controller = remember(context) { NativeMapController(context) }
    DisposableEffect(controller, owner) {
        val observer = LifecycleEventObserver { _, event -> when (event) {
            Lifecycle.Event.ON_START -> controller.start()
            Lifecycle.Event.ON_RESUME -> controller.resume()
            Lifecycle.Event.ON_PAUSE -> controller.pause()
            Lifecycle.Event.ON_STOP -> controller.stop()
            Lifecycle.Event.ON_DESTROY -> controller.destroy()
            else -> Unit
        } }
        owner.lifecycle.addObserver(observer)
        if (owner.lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)) controller.start()
        if (owner.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) controller.resume()
        val memory = object : ComponentCallbacks {
            override fun onConfigurationChanged(newConfig: Configuration) = Unit
            override fun onLowMemory() { controller.lowMemory() }
        }
        context.applicationContext.registerComponentCallbacks(memory)
        onDispose {
            owner.lifecycle.removeObserver(observer)
            context.applicationContext.unregisterComponentCallbacks(memory)
            controller.destroy()
        }
    }
    return controller
}

@Composable
fun NativeMapView(controller: NativeMapController, modifier: Modifier = Modifier) {
    AndroidView(factory = { controller.view }, modifier = modifier)
}
