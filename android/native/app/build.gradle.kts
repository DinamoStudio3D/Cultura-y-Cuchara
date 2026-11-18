import javax.xml.parsers.DocumentBuilderFactory
import java.security.KeyStore
import java.security.MessageDigest

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}
android {
    namespace = "com.visitaloja.app"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.visitaloja.app"
        minSdk = 26
        targetSdk = 36
        versionCode = 95
        versionName = "0.88.0"
    }
    val releaseSigning = listOf("VISITALOJA_RELEASE_STORE_FILE", "VISITALOJA_RELEASE_STORE_PASSWORD", "VISITALOJA_RELEASE_KEY_ALIAS", "VISITALOJA_RELEASE_KEY_PASSWORD")
        .associateWith { System.getenv(it)?.takeIf(String::isNotBlank) }
    if (releaseSigning.values.all { it != null }) signingConfigs.create("production") {
        storeFile = file(releaseSigning.getValue("VISITALOJA_RELEASE_STORE_FILE")!!)
        storePassword = releaseSigning.getValue("VISITALOJA_RELEASE_STORE_PASSWORD")
        keyAlias = releaseSigning.getValue("VISITALOJA_RELEASE_KEY_ALIAS")
        keyPassword = releaseSigning.getValue("VISITALOJA_RELEASE_KEY_PASSWORD")
    }
    buildTypes {
        debug { applicationIdSuffix = ".preview"; versionNameSuffix = "-preview"; resValue("string", "app_name", "VisitaLoja Prueba") }
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.findByName("production")
        }
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true }
    sourceSets["main"].assets.srcDir(layout.buildDirectory.dir("generated/platform-assets"))
    sourceSets["main"].res.srcDir(layout.buildDirectory.dir("generated/res/brand"))
    packaging { resources.excludes += "/META-INF/{AL2.0,LGPL2.1}" }
}
val syncBrandAssets by tasks.registering(Copy::class) {
    into(layout.buildDirectory.dir("generated/res/brand/drawable"))
    from(rootProject.file("../../mascota-vive-loja.png")) { rename { "chabaquito.png" } }
    from(rootProject.file("../../assets/brand/visitaloja-splash.webp")) { rename { "visitaloja_logo.webp" } }
    from(rootProject.file("../../assets/brand/codeproim.png")) { rename { "codeproim_logo.png" } }
    from(rootProject.file("../../assets/photos/responsive/jipiro-pagoda-laguna-640.webp")) { rename { "jipiro_cover.webp" } }
}
val syncLegalDocuments by tasks.registering(Copy::class) {
    into(layout.buildDirectory.dir("generated/platform-assets/legal"))
    from(rootProject.file("../../privacidad.html"))
    from(rootProject.file("../../terminos.html"))
}
tasks.named("preBuild") { dependsOn(syncBrandAssets, syncLegalDocuments) }
dependencies {
    implementation("com.google.android.gms:play-services-code-scanner:16.1.0")
    implementation("com.google.firebase:firebase-messaging")
    implementation("androidx.work:work-runtime-ktx:2.10.0")
    implementation("androidx.media3:media3-exoplayer:1.6.1")
    implementation("androidx.media3:media3-ui:1.6.1")
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
    implementation("io.coil-kt:coil-svg:2.7.0")
    debugImplementation("androidx.compose.ui:ui-tooling")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303")
}

// A release must never silently reuse Firebase or the signing key of the preview app.
val validateProductionConfiguration by tasks.registering {
    doLast {
        val config = file("src/release/res/values/firebase.xml")
        check(config.isFile) { "Falta Firebase de producción. Ejecuta android/prepare-release.py con el google-services.json de com.visitaloja.app." }
        val factory = DocumentBuilderFactory.newInstance().apply {
            setFeature("http://apache.org/xml/features/disallow-doctype-decl", true)
        }
        val rows = factory.newDocumentBuilder().parse(config).getElementsByTagName("string")
        val values = (0 until rows.length).associate { index ->
            val row = rows.item(index)
            row.attributes.getNamedItem("name").nodeValue to row.textContent.trim()
        }
        check(values["project_id"] == "cultura-y-cuchara" && values["visitaloja_firebase_package"] == "com.visitaloja.app") { "Firebase no corresponde al paquete definitivo de VisitaLoja." }
        listOf("google_app_id", "google_api_key", "gcm_defaultSenderId", "default_web_client_id").forEach {
            check(!values[it].isNullOrBlank()) { "Falta el recurso de producción: $it" }
        }
        listOf("VISITALOJA_RELEASE_STORE_FILE", "VISITALOJA_RELEASE_STORE_PASSWORD", "VISITALOJA_RELEASE_KEY_ALIAS", "VISITALOJA_RELEASE_KEY_PASSWORD").forEach {
            check(!System.getenv(it).isNullOrBlank()) { "Falta la variable de firma de producción: $it" }
        }
        val store = file(System.getenv("VISITALOJA_RELEASE_STORE_FILE"))
        check(store.isFile) { "No se encontró el almacén de firma definitivo." }
        val keys = KeyStore.getInstance(store, System.getenv("VISITALOJA_RELEASE_STORE_PASSWORD").toCharArray())
        val certificate = keys.getCertificate(System.getenv("VISITALOJA_RELEASE_KEY_ALIAS"))
        check(certificate != null) { "No se encontró el alias de la firma definitiva." }
        val fingerprint = MessageDigest.getInstance("SHA-256").digest(certificate.encoded).joinToString("") { "%02x".format(it) }
        check(fingerprint != "2c68e9a131584ba2f38f2155603cabd906b1bb740426e4e976eb7210fd03e171") { "La firma de pruebas no se puede usar como firma definitiva." }
    }
}
tasks.configureEach { if (name == "preReleaseBuild") dependsOn(validateProductionConfiguration) }
