plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
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
}
dependencies {
    implementation(project(":shared"))
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.window:window:1.5.1")
}
