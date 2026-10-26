plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
    kotlin("plugin.serialization")
    id("com.google.devtools.ksp")
    id("androidx.room3")
}
android {
    namespace = "ru.dndshare.client"
    compileSdk = 37
    defaultConfig {
        applicationId = "ru.dndshare.client"
        minSdk = 26
        targetSdk = 37
        versionCode = 1
        versionName = "0.1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        val baseUrl = providers.gradleProperty("apiBaseUrl").getOrElse("https://dndshare.ru")
        require(baseUrl == "https://dndshare.ru" || baseUrl.matches(Regex("http://(10\\.0\\.2\\.2|127\\.0\\.0\\.1|localhost):[0-9]+")))
        if (baseUrl != "https://dndshare.ru") applicationIdSuffix = ".smoke"
        buildConfigField("String", "API_BASE_URL", "\"" + baseUrl + "\"")
    }
    buildFeatures { compose = true; buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    sourceSets {
        getByName("test").kotlin.directories += "src/testSupport/kotlin"
        getByName("androidTest").kotlin.directories += "src/testSupport/kotlin"
    }
}
dependencies {
    implementation(project(":designSystem"))
    implementation(platform("androidx.compose:compose-bom:2026.09.00"))
    implementation("androidx.compose.runtime:runtime")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.window:window:1.5.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.9.0")
    implementation("io.ktor:ktor-client-core:3.6.0")
    implementation("io.ktor:ktor-client-okhttp:3.6.0")
    implementation("io.ktor:ktor-client-content-negotiation:3.6.0")
    implementation("io.ktor:ktor-serialization-kotlinx-json:3.6.0")
    implementation("androidx.room3:room3-runtime:3.0.3")
    implementation("androidx.sqlite:sqlite-bundled:2.7.1")
    implementation("io.coil-kt.coil3:coil-compose:3.6.3")
    implementation("io.coil-kt.coil3:coil-svg:3.6.3")
    implementation("io.coil-kt.coil3:coil-network-ktor3:3.6.3")
    implementation("com.fleeksoft.ksoup:ksoup:0.2.6")
    ksp("androidx.room3:room3-compiler:3.0.3")

    testImplementation("org.jetbrains.kotlin:kotlin-test-junit:2.4.21")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.10.2")
    androidTestImplementation("org.jetbrains.kotlin:kotlin-test-junit:2.4.21")
    androidTestImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.10.2")
    androidTestImplementation("io.ktor:ktor-client-mock:3.6.0")
    androidTestImplementation("androidx.test:runner:1.7.0")
    androidTestImplementation("androidx.test:core:1.7.0")
    androidTestImplementation("androidx.test.ext:junit:1.3.0")
}
room3 { schemaDirectory("$projectDir/schemas") }
