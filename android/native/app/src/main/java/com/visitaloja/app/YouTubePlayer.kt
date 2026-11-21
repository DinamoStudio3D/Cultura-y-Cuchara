package com.visitaloja.app

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.view.View
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import org.json.JSONObject

/** Only the official embed is web content. No native JavaScript interfaces or app credentials. */
class YouTubePlayer(
    context: Context,
    id: String,
    startSeconds: Int,
    private val event: (ready: Boolean, playing: Boolean, seconds: Int, error: String?) -> Unit,
    private val fullscreen: (View?, WebChromeClient.CustomViewCallback?) -> Unit,
    private val external: (String) -> Unit
) {
    val container = FrameLayout(context)
    private val handler = Handler(Looper.getMainLooper())
    private var web: WebView? = null
    private var closed = false
    private var foreground = true
    private var ready = false
    private var seconds = startSeconds
    private var failure: String? = null
    private var customCallback: WebChromeClient.CustomViewCallback? = null
    private val origin = VideoPolicy.appOrigin(context.packageName)
    private val started = android.os.SystemClock.elapsedRealtime()
    @SuppressLint("SetJavaScriptEnabled") // Required by the official YouTube IFrame API; no native bridge is exposed.
    private fun create(context: Context, id: String, startSeconds: Int) {
        val view = WebView(context)
        web = view
        view.setBackgroundColor(android.graphics.Color.BLACK)
        view.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            mediaPlaybackRequiresUserGesture = true
            javaScriptCanOpenWindowsAutomatically = false
            setSupportMultipleWindows(false)
            safeBrowsingEnabled = true
        }
        CookieManager.getInstance().setAcceptThirdPartyCookies(view, false)
        view.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url.toString()
                // Let the provider load its own HTTPS subframes (including its normal ads).
                // The enclosing document has a fixed CSP; no frame receives a native bridge.
                if (!request.isForMainFrame) return url != "about:blank" && DiscoveryPolicy.media(url) == null
                if (url == "$origin/" || url == "about:blank") return false
                if (request.hasGesture() && DiscoveryPolicy.media(url) != null) external(url)
                return true
            }
            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (!closed && request.isForMainFrame) { failure = VideoPolicy.playerMessage(0); event(ready, false, seconds, failure) }
            }
            override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) { if (!closed) ready = false }
            override fun onRenderProcessGone(view: WebView, detail: android.webkit.RenderProcessGoneDetail): Boolean {
                if (!closed) { failure = "El reproductor se cerró. Pulsa reintentar para abrirlo de nuevo."; event(false, false, seconds, failure) }
                (view.parent as? android.view.ViewGroup)?.removeView(view)
                view.destroy(); web = null
                return true
            }
        }
        view.webChromeClient = object : WebChromeClient() {
            override fun onShowCustomView(view: View, callback: CustomViewCallback) {
                if (closed || customCallback != null) { callback.onCustomViewHidden(); return }
                customCallback = callback; fullscreen(view, callback)
            }
            override fun onHideCustomView() { exitFullscreen() }
        }
        container.addView(view, FrameLayout.LayoutParams(-1, -1))
        // YouTube requires the installed app ID as HTTPS Referer for sideloaded Android apps.
        // The base URL supplies that identity without loading a website or impersonating its origin.
        view.loadDataWithBaseURL("$origin/", html(id, origin, startSeconds), "text/html", "UTF-8", null)
        handler.postDelayed(poll, 1000)
    }
    private val poll: Runnable = object : Runnable {
        override fun run() {
            val view = web ?: return
            if (closed || !foreground) return
            view.evaluateJavascript("JSON.stringify({ready:window.vlReady===true,playing:window.vlPlaying===true,seconds:window.vlSeconds||0,error:window.vlError||0})") { raw ->
                if (!closed && foreground) {
                    runCatching {
                        val json = JSONObject(org.json.JSONTokener(raw).nextValue().toString())
                        ready = json.optBoolean("ready")
                        seconds = json.optInt("seconds", seconds).coerceAtLeast(0)
                        val code = json.optInt("error")
                        if (code != 0) failure = VideoPolicy.playerMessage(code)
                        if (ready && code == 0) failure = null
                        if (!ready && android.os.SystemClock.elapsedRealtime() - started > 30000) failure = "YouTube está tardando en responder. Comprueba tu conexión y pulsa reintentar."
                        event(ready, json.optBoolean("playing") && failure == null, seconds, failure)
                    }.onFailure {
                        if (android.os.SystemClock.elapsedRealtime() - started > 30000) {
                            failure = "YouTube está tardando en responder. Comprueba tu conexión y pulsa reintentar."
                            event(false, false, seconds, failure)
                        }
                    }
                }
            }
            handler.postDelayed(this, 1000)
        }
    }
    init {
        require(Regex("[A-Za-z0-9_-]{11}").matches(id))
        runCatching { create(context, id, startSeconds) }.onFailure {
            failure = "El reproductor no está disponible en este dispositivo. Puedes abrir el video en YouTube."
            handler.post { if (!closed) event(false, false, seconds, failure) }
        }
    }
    fun pause() { web?.evaluateJavascript("if(window.vlPlayer&&window.vlPlayer.pauseVideo){window.vlPlayer.pauseVideo();}", null) }
    fun resume() { if (!closed) { foreground = true; web?.onResume(); handler.removeCallbacks(poll); handler.post(poll) } }
    fun background() { foreground = false; pause(); web?.onPause(); handler.removeCallbacks(poll) }
    fun exitFullscreen() { val callback = customCallback; customCallback = null; fullscreen(null, null); callback?.onCustomViewHidden() }
    fun close() {
        if (closed) return
        closed = true; handler.removeCallbacksAndMessages(null); exitFullscreen()
        web?.let { view -> view.stopLoading(); view.loadUrl("about:blank"); (view.parent as? android.view.ViewGroup)?.removeView(view); view.destroy() }
        web = null
    }
    companion object {
        fun html(id: String, origin: String, startSeconds: Int): String {
            require(Regex("[A-Za-z0-9_-]{11}").matches(id))
            require(Regex("https://[a-zA-Z0-9_.]+(?:/)?").matches(origin))
            return """<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="strict-origin-when-cross-origin"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' https://www.youtube.com; style-src 'unsafe-inline'; frame-src https://www.youtube-nocookie.com https://www.youtube.com https://*.youtube.com; connect-src https://www.youtube.com; base-uri 'none'; form-action 'none'"><style>html,body,#player{margin:0;width:100%;height:100%;background:#000;overflow:hidden}</style></head><body><div id="player"></div><script>window.vlReady=false;window.vlPlaying=false;window.vlSeconds=${startSeconds.coerceAtLeast(0)};window.vlError=0;window.vlPlayer=null;function onYouTubeIframeAPIReady(){window.vlPlayer=new YT.Player('player',{host:'https://www.youtube-nocookie.com',videoId:'$id',width:'100%',height:'100%',playerVars:{playsinline:1,autoplay:0,controls:1,rel:0,fs:1,hl:'es',start:${startSeconds.coerceAtLeast(0)},origin:'$origin'},events:{onReady:function(){window.vlReady=true},onStateChange:function(e){window.vlPlaying=e.data===1},onError:function(e){window.vlError=e.data;window.vlPlaying=false}}});}setInterval(function(){if(window.vlPlayer&&window.vlPlayer.getCurrentTime){window.vlSeconds=Math.floor(window.vlPlayer.getCurrentTime()||0)}},1000);</script><script src="https://www.youtube.com/iframe_api"></script></body></html>"""
        }
    }
}
