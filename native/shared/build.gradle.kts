import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    kotlin("multiplatform")
    kotlin("plugin.serialization")
    id("com.android.kotlin.multiplatform.library")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.compose")
    id("com.google.devtools.ksp")
    id("androidx.room3")
}
kotlin {
    android {
        namespace = "ru.dndshare.client.shared"
        compileSdk = 37
        minSdk = 26
        androidResources.enable = true
        compilerOptions.jvmTarget.set(JvmTarget.JVM_17)
    }
    jvm("desktop") { compilerOptions.jvmTarget.set(JvmTarget.JVM_17) }
    sourceSets {
        commonMain.dependencies {
            implementation(compose.runtime)
            implementation(compose.foundation)
            implementation(compose.material3)
            implementation(compose.components.resources)
            implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.10.2")
            implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.9.0")
            implementation("io.ktor:ktor-client-core:3.6.0")
            implementation("io.ktor:ktor-client-content-negotiation:3.6.0")
            implementation("io.ktor:ktor-serialization-kotlinx-json:3.6.0")
            implementation("androidx.room3:room3-runtime:3.0.3")
            implementation("androidx.sqlite:sqlite-bundled:2.7.1")
            implementation("io.coil-kt.coil3:coil-compose:3.6.3")
            implementation("io.coil-kt.coil3:coil-network-ktor3:3.6.3")
            implementation("com.fleeksoft.ksoup:ksoup:0.2.6")
        }
        androidMain.dependencies {
            implementation("io.ktor:ktor-client-okhttp:3.6.0")
            implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
            implementation("androidx.activity:activity-compose:1.13.0")
        }
        getByName("desktopMain").dependencies {
            implementation("io.ktor:ktor-client-okhttp:3.6.0")
            implementation("net.java.dev.jna:jna-platform:5.18.1")
            implementation("org.jetbrains.kotlinx:kotlinx-coroutines-swing:1.10.2")
        }
        commonTest.dependencies {
            implementation(kotlin("test"))
            implementation("io.ktor:ktor-client-mock:3.6.0")
            implementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.10.2")
        }
        getByName("desktopTest").dependencies { implementation(kotlin("test-junit")) }
    }
}
dependencies {
    add("kspAndroid", "androidx.room3:room3-compiler:3.0.3")
    add("kspDesktop", "androidx.room3:room3-compiler:3.0.3")
}
room3 { schemaDirectory("$projectDir/schemas") }
compose.resources {
    packageOfResClass = "ru.dndshare.client.resources"
    publicResClass = true
}
