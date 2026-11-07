package com.visitaloja.app

import android.content.Context
import okhttp3.Cache
import okhttp3.OkHttpClient
import org.maplibre.android.module.http.HttpRequestUtil
import java.io.File

object MapHttp {
    private var configured = false
    @Synchronized fun configure(context: Context) {
        if (configured) return
        // Honor Cache-Control, Expires and conditional requests; no tile prefetch/offline packs.
        val client = OkHttpClient.Builder().cache(Cache(File(context.cacheDir, "map-http-v1"), 100L * 1024 * 1024))
            .addInterceptor { chain -> chain.proceed(chain.request().newBuilder()
                .header("User-Agent", "VisitaLojaAndroid (+https://www.visitaloja.com/)").build()) }.build()
        HttpRequestUtil.setOkHttpClient(client)
        configured = true
    }
}
