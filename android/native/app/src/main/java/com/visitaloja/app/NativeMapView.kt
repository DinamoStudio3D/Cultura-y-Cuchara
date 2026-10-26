package com.visitaloja.app

import android.content.ComponentCallbacks
import android.content.Context
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.RectF
import androidx.core.graphics.drawable.toBitmap
import coil.imageLoader
import coil.request.ImageRequest
import coil.request.SuccessResult
import kotlinx.coroutines.*
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
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
import android.os.SystemClock
import org.maplibre.android.style.layers.FillLayer
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
private const val ACCURACY = "vl-accuracy"

class NativeMapController(private val context: Context, private val initialCamera: MapCamera = MapCamera()) {
    private val renderer = MapMarkerRenderer(context)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val downloads = Semaphore(4)
    private val requestedLogos = mutableSetOf<String>()
    private val logoAttempts = mutableMapOf<String, Int>()
    private val logoRetryAt = mutableMapOf<String, Long>()
    private val logoImages = mutableMapOf<String, Bitmap>()
    private val installedIcons = mutableSetOf<String>()
    private var places = emptyList<Place>()
    val view: MapView
    var map: MapLibreMap? = null
        private set
    private var style: Style? = null
    private var alive = true
    private var data = MapPolicy.geoJson(emptyList())
    private var selected: String? = null
    private var location: MapFix? = null
    var onGesture: () -> Unit = {}
    var onCamera: (MapCamera) -> Unit = {}
    var onReady: () -> Unit = {}
    var onError: () -> Unit = {}
    var onSelect: (List<String>) -> Unit = {}
    private val density = context.resources.displayMetrics.density
    private var started = false
    private var resumed = false
    init {
        MapLibre.getInstance(context.applicationContext)
        MapHttp.configure(context.applicationContext)
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
                readyMap.setPrefetchZoomDelta(0)
                readyMap.setMinZoomPreference(3.0)
                readyMap.setMaxZoomPreference(19.0)
                readyMap.cameraPosition = CameraPosition.Builder().target(LatLng(initialCamera.latitude, initialCamera.longitude)).zoom(initialCamera.zoom).bearing(initialCamera.bearing).tilt(initialCamera.tilt).build()
                readyMap.addOnCameraMoveStartedListener { reason -> if (alive && reason == MapLibreMap.OnCameraMoveStartedListener.REASON_API_GESTURE) onGesture() }
                readyMap.addOnMapClickListener { point ->
                    val current = style
                    if (!alive || current == null) false else {
                        val screen = readyMap.projection.toScreenLocation(point)
                        val radius = 22f * density
                        val box = RectF(screen.x - radius, screen.y - radius, screen.x + radius, screen.y + radius)
                        val hits = readyMap.queryRenderedFeatures(box, PINS)
                        val ids = hits.mapNotNull { feature ->
                            val item = JSONObject(feature.toJson())
                            val id = item.optJSONObject("properties")?.optString("id")?.takeIf { it.isNotBlank() } ?: return@mapNotNull null
                            val coords = item.getJSONObject("geometry").getJSONArray("coordinates")
                            val position = readyMap.projection.toScreenLocation(LatLng(coords.getDouble(1), coords.getDouble(0)))
                            id to kotlin.math.hypot((position.x - screen.x).toDouble(), (position.y - screen.y).toDouble())
                        }.sortedBy { it.second }.map { it.first }.distinct()
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
                readyMap.addOnCameraIdleListener { if (alive) {
                    loadVisibleLogos()
                    readyMap.cameraPosition.let { camera -> camera.target?.let { onCamera(MapCamera(it.latitude, it.longitude, camera.zoom, camera.bearing, camera.tilt)) } }
                } }
                reload()
            }
        }
    }
    fun reload() {
        if (!alive) return
        style = null
        requestedLogos.clear(); logoAttempts.clear(); logoRetryAt.clear()
        map?.setStyle(Style.Builder().fromJson(MapPolicy.styleJson())) { loaded ->
            if (alive) {
                installedIcons.clear()
                installMarkers(loaded)
                loaded.addSource(GeoJsonSource(PLACES, data, GeoJsonOptions().withCluster(true).withClusterMaxZoom(12).withClusterRadius(32)))
                loaded.addLayer(CircleLayer(GROUPS, PLACES).withFilter(has("point_count")).withProperties(
                    circleColor("#0f233a"), circleRadius(24f), circleStrokeWidth(3f), circleStrokeColor("#FFFFFF")))
                loaded.addLayer(SymbolLayer("vl-counts", PLACES).withFilter(has("point_count")).withProperties(
                    textField("{point_count_abbreviated}"), textSize(13f), textColor("#FFFFFF"),
                    textFont(arrayOf("Noto Sans Regular")), textAllowOverlap(true)))
                loaded.addLayer(CircleLayer(SELECTED, PLACES).withFilter(eq(get("id"), literal(selected.orEmpty()))).withProperties(
                    circleRadius(33f), circleColor("#FFD46B"), circleOpacity(0.75f), circleStrokeColor("#FFFFFF"), circleStrokeWidth(2f)))
                loaded.addLayer(SymbolLayer(PINS, PLACES).withFilter(not(has("point_count"))).withProperties(
                    iconImage(get("pin")), iconSize(1f), iconAnchor("center"), iconAllowOverlap(true), iconIgnorePlacement(true)))
                loaded.addLayer(SymbolLayer("vl-names", PLACES).withFilter(not(has("point_count"))).apply { minZoom = 14.0f }.withProperties(
                    textField(get("title")), textSize(12f), textColor("#0f233a"), textHaloColor("#FFFFFF"), textHaloWidth(2.5f),
                    textFont(arrayOf("Noto Sans Regular")), textAnchor("top"), textOffset(arrayOf(0f, 2.6f)), textMaxWidth(12f), textAllowOverlap(false)))
                val fix = location?.takeIf { MapLocationPolicy.valid(it, SystemClock.elapsedRealtime()) }
                loaded.addSource(GeoJsonSource(POSITION, fix?.let { MapPolicy.locationJson(it.latitude, it.longitude) } ?: MapPolicy.geoJson(emptyList())))
                loaded.addSource(GeoJsonSource(ACCURACY, fix?.let(MapPolicy::accuracyJson) ?: MapPolicy.geoJson(emptyList())))
                loaded.addLayerBelow(FillLayer("vl-position-accuracy", ACCURACY).withProperties(fillColor("#168BE8"), fillOpacity(0.16f), fillOutlineColor("#168BE8")), GROUPS)
                loaded.addLayer(CircleLayer("vl-position-dot", POSITION).withProperties(circleRadius(7f), circleColor("#168BE8"), circleStrokeWidth(3f), circleStrokeColor("#FFFFFF")))
                style = loaded
                onReady()
                loadVisibleLogos()
            }
        }
    }
    fun update(places: List<Place>, id: String?) {
        this.places = places
        val next = MapPolicy.geoJson(places)
        selected = id
        style?.let { installMarkers(it) }
        if (next != data) { data = next; style?.getSourceAs<GeoJsonSource>(PLACES)?.setGeoJson(data) }
        (style?.getLayer(SELECTED) as? CircleLayer)?.setFilter(eq(get("id"), literal(id.orEmpty())))
        loadVisibleLogos()
    }
    private fun installMarkers(target: Style) {
        places.filter(MapPolicy::located).distinctBy(MapPolicy::markerKey).forEach { place ->
            val key = MapPolicy.markerKey(place)
            if (installedIcons.add(key)) target.addImage(key, renderer.render(place, logoImages[key]))
        }
    }
    private fun loadVisibleLogos() {
        val current = map ?: return
        if (!alive || style == null) return
        val bounds = current.projection.visibleRegion.latLngBounds
        places.filter { MapPolicy.located(it) && bounds.contains(LatLng(it.latitude!!, it.longitude!!)) }.forEach { place ->
            val url = MapPolicy.logoUrl(place) ?: return@forEach
            val key = MapPolicy.markerKey(place)
            if (logoImages.containsKey(key)) return@forEach
            val requestId = key + url
            if ((logoAttempts[requestId] ?: 0) >= 3 || SystemClock.elapsedRealtime() < (logoRetryAt[requestId] ?: 0)) return@forEach
            if (!requestedLogos.add(requestId)) return@forEach
            logoAttempts[requestId] = (logoAttempts[requestId] ?: 0) + 1
            scope.launch {
                val image = downloads.withPermit {
                    runCatching {
                        val result = context.imageLoader.execute(ImageRequest.Builder(context).data(url).size(160).allowHardware(false).build())
                        (result as? SuccessResult)?.drawable?.toBitmap()
                    }.getOrNull()
                }
                if (image != null && alive && places.any { it.id == place.id && MapPolicy.logoUrl(it) == url }) {
                    logoImages[key] = image
                    style?.addImage(key, renderer.render(place, image))
                } else if (alive) {
                    requestedLogos.remove(requestId)
                    logoRetryAt[requestId] = SystemClock.elapsedRealtime() + 15000
                    if ((logoAttempts[requestId] ?: 0) < 3) { delay(15000); if (alive && resumed) loadVisibleLogos() }
                }
            }
        }
    }
    fun focus(places: List<Place>) {
        if (!alive) return
        val points = places.filter(MapPolicy::located).map { LatLng(it.latitude!!, it.longitude!!) }
        val current = map ?: return
        if (points.isEmpty()) current.animateCamera(CameraUpdateFactory.newLatLngZoom(LatLng(MapPolicy.LOJA_LAT, MapPolicy.LOJA_LNG), MapPolicy.DEFAULT_ZOOM))
        else if (points.size == 1 || points.distinct().size == 1) current.animateCamera(CameraUpdateFactory.newLatLngZoom(points.first(), 15.5))
        else if (view.width > 0 && view.height > 0) {
            current.animateCamera(CameraUpdateFactory.newLatLngBounds(LatLngBounds.Builder().includes(points).build(), MapLocationPolicy.fitPadding(view.width, view.height, density)))
        }
    }
    fun focusPlace(place: Place) {
        if (alive && MapPolicy.located(place)) map?.animateCamera(CameraUpdateFactory.newLatLng(LatLng(place.latitude!!, place.longitude!!)))
    }
    fun city() { if (alive) map?.animateCamera(CameraUpdateFactory.newLatLngZoom(LatLng(MapPolicy.LOJA_LAT, MapPolicy.LOJA_LNG), MapPolicy.DEFAULT_ZOOM)) }
    fun position(fix: MapFix, follow: Boolean, recenter: Boolean = false) {
        if (!alive || !MapLocationPolicy.valid(fix, SystemClock.elapsedRealtime())) return
        location = fix
        style?.getSourceAs<GeoJsonSource>(POSITION)?.setGeoJson(MapPolicy.locationJson(fix.latitude, fix.longitude))
        style?.getSourceAs<GeoJsonSource>(ACCURACY)?.setGeoJson(MapPolicy.accuracyJson(fix))
        if (follow) map?.let { current ->
            val zoom = if (recenter) MapLocationPolicy.zoom(fix.accuracy) else current.cameraPosition.zoom
            current.animateCamera(CameraUpdateFactory.newLatLngZoom(LatLng(fix.latitude, fix.longitude), zoom), 700)
        }
    }
    fun clearPosition() {
        location = null
        if (alive) {
            style?.getSourceAs<GeoJsonSource>(POSITION)?.setGeoJson(MapPolicy.geoJson(emptyList()))
            style?.getSourceAs<GeoJsonSource>(ACCURACY)?.setGeoJson(MapPolicy.geoJson(emptyList()))
        }
    }
    fun zoom(amount: Double) {
        if (alive) map?.let { it.animateCamera(CameraUpdateFactory.zoomTo((it.cameraPosition.zoom + amount).coerceIn(3.0, 19.0))) }
    }
    fun lowMemory() { if (alive) view.onLowMemory() }
    fun start() { if (alive && !started) { view.onStart(); started = true } }
    fun resume() { start(); if (alive && !resumed) { view.onResume(); resumed = true } }
    fun pause() { if (alive && resumed) { view.onPause(); resumed = false } }
    fun stop() { pause(); if (alive && started) { view.onStop(); started = false } }
    fun destroy() { if (alive) { stop(); alive = false; scope.cancel(); logoImages.clear(); requestedLogos.clear(); logoAttempts.clear(); logoRetryAt.clear(); onSelect = {}; onGesture = {}; onCamera = {}; onReady = {}; onError = {}; style = null; map = null; view.onDestroy() } }

}

@Composable
fun rememberNativeMapController(initialCamera: MapCamera = MapCamera()): NativeMapController {
    val context = LocalContext.current
    val owner = LocalLifecycleOwner.current
    val controller = remember(context) { NativeMapController(context, initialCamera) }
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
