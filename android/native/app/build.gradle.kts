plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}
android {
    namespace = "com.visitaloja.app"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.visitaloja.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 12
        versionName = "0.9.0"
    }
    buildTypes {
        debug { applicationIdSuffix = ".preview"; versionNameSuffix = "-preview"; resValue("string", "app_name", "VisitaLoja Prueba") }
        release { isMinifyEnabled = false }
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true }
    sourceSets["main"].res.srcDir(layout.buildDirectory.dir("generated/res/brand"))
    packaging { resources.excludes += "/META-INF/{AL2.0,LGPL2.1}" }
}
val syncBrandAssets by tasks.registering(Copy::class) {
    into(layout.buildDirectory.dir("generated/res/brand/drawable"))
    from(rootProject.file("../../assets/brand/visitaloja-splash.webp")) { rename { "visitaloja_logo.webp" } }
    from(rootProject.file("../../assets/brand/codeproim.png")) { rename { "codeproim_logo.png" } }
    from(rootProject.file("../../assets/photos/responsive/jipiro-pagoda-laguna-640.webp")) { rename { "jipiro_cover.webp" } }
}
tasks.named("preBuild") { dependsOn(syncBrandAssets) }
dependencies {
    implementation("androidx.media3:media3-exoplayer:1.6.1")
    implementation("com.google.android.gms:play-services-location:21.3.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.maplibre.gl:android-sdk:12.0.1")
    implementation("com.google.zxing:core:3.5.3")
    implementation(platform("com.google.firebase:firebase-bom:34.4.0"))
    implementation("com.google.firebase:firebase-auth")
    implementation("com.google.firebase:firebase-firestore")
    implementation("androidx.credentials:credentials:1.3.0")
    implementation("androidx.credentials:credentials-play-services-auth:1.3.0")
    implementation("com.google.android.libraries.identity.googleid:googleid:1.1.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.10.2")
    implementation(platform("androidx.compose:compose-bom:2025.04.01"))
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.core:core-ktx:1.16.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.9.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.9.0")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("io.coil-kt:coil-compose:2.7.0")
    debugImplementation("androidx.compose.ui:ui-tooling")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303")
}
