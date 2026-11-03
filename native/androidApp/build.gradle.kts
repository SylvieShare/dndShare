import java.security.MessageDigest

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
    ndkVersion = "29.0.14206865"
    externalNativeBuild { cmake { path = file("src/main/cpp/CMakeLists.txt"); version = "3.31.6" } }
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
    buildTypes {
        create("benchmark") {
            initWith(getByName("release"))
            signingConfig = signingConfigs.getByName("debug")
            applicationIdSuffix = ".benchmark"
            isDebuggable = false
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
            matchingFallbacks += "release"
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    sourceSets {
        getByName("test").kotlin.directories += "src/testSupport/kotlin"
        getByName("test").resources.srcDir("../fixtures")
        getByName("test").resources.srcDir("src/androidTest/assets")
        getByName("androidTest").kotlin.directories += "src/testSupport/kotlin"
        getByName("androidTest").assets.srcDir("schemas")
    }
}
dependencies {
    implementation(platform("androidx.compose:compose-bom:2026.09.00"))
    implementation("androidx.compose.runtime:runtime")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.11.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.11.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-savedstate:2.11.0")
    implementation("androidx.window:window:1.5.1")
    implementation(files("../vendor/filament/filament-android-1.77.3-ortho1.aar"))
    implementation("com.google.android.filament:gltfio-android:1.77.3")
    implementation("com.google.android.filament:filament-utils-android:1.77.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("androidx.exifinterface:exifinterface:1.4.2")
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
    debugImplementation("androidx.compose.ui:ui-test-manifest:1.12.1")
    add("benchmarkImplementation", "androidx.profileinstaller:profileinstaller:1.4.1")
}
room3 { schemaDirectory("$projectDir/schemas") }

// Keep the in-app design package independent from features so it can be extracted later.
val checkDesignSystemBoundary by tasks.registering {
    val sources = fileTree("src/main/kotlin/ru/dndshare/client/ui/designsystem") { include("**/*.kt") }
    inputs.files(sources)
    doLast {
        sources.forEach { source ->
            source.readLines().map(String::trim).filter { it.startsWith("import ru.dndshare.client.") }.forEach { line ->
                require(line == "import ru.dndshare.client.R" || line.startsWith("import ru.dndshare.client.ui.designsystem.")) {
                    "Design system cannot import application features: ${source.name}: $line"
                }
            }
        }
    }
}
tasks.named("preBuild") { dependsOn(checkDesignSystemBoundary) }

// Checked-in packages must be rebuilt whenever a shader source changes.
val checkMapMaterials by tasks.registering {
    val sources = fileTree("materials") { include("*.mat", "*.glsl") }
    val packages = fileTree("src/main/assets/maps/materials")
    inputs.files(sources, packages)
    doLast {
        val manifest = groovy.json.JsonSlurper().parse(file("src/main/assets/maps/materials/manifest.json")) as Map<*, *>
        fun sha256(file: File) = MessageDigest.getInstance("SHA-256").digest(file.readBytes()).joinToString("") { "%02x".format(it) }
        val sourceHashes = manifest["sources"] as Map<*, *>
        require(sources.files.map { it.name }.toSet() == sourceHashes.keys) { "Run scripts/native/compile-map-materials.py" }
        sources.forEach { require(sha256(it) == sourceHashes[it.name]) { "Recompile map material: ${it.name}" } }
        val outputHashes = manifest["outputs"] as Map<*, *>
        require(outputHashes.keys == sources.files.filter { it.extension == "mat" }.map { it.nameWithoutExtension + ".filamat" }.toSet()) {
            "Missing or unexpected map material packages"
        }
        outputHashes.forEach { (name, hash) ->
            require(sha256(file("src/main/assets/maps/materials/$name")) == hash) { "Invalid map material: $name" }
        }
    }
}
tasks.named("preBuild") { dependsOn(checkMapMaterials) }

// Static exports must stay tied to the web sources from which they were produced.
val checkMapStaticAssets by tasks.registering {
    val definitions = listOf(file("src/main/assets/maps/packs"), file("src/main/resources/maps/builtin"))
    val repository = rootProject.projectDir.parentFile
    inputs.files(definitions.map { fileTree(it) })
    inputs.files(File(repository,"frontend/src/features/maps/components/MapPackIcon.vue"), File(repository,"frontend/src/features/maps/rendering/sceneObjects.js"))
    doLast {
        fun hash(path: File) = MessageDigest.getInstance("SHA-256").digest(path.readBytes()).joinToString("") { "%02x".format(it) }
        definitions.forEach { directory ->
            val manifest = groovy.json.JsonSlurper().parse(File(directory,"manifest.json")) as Map<*, *>
            require(hash(File(repository,manifest["source"] as String)) == manifest["sourceHash"]) { "Regenerate native map exports: ${directory.name}" }
            val packages=manifest["packages"] as Map<*, *>
            require(directory.listFiles().orEmpty().filter {it.extension in setOf("glb","svg")}.map {it.name}.toSet()==packages.keys) { "Unexpected native map export: ${directory.name}" }
            packages.forEach {(name,expected)->require(hash(File(directory,name as String))==expected){"Invalid native map export: $name"}}
        }
    }
}
tasks.named("preBuild") { dependsOn(checkMapStaticAssets) }

// All consumers use the same engine, including gltfio and filament-utils.
configurations.configureEach {
    exclude(group = "com.google.android.filament", module = "filament-android")
}

val checkMapFilament by tasks.registering {
    val repository = rootProject.projectDir.parentFile
    val vendor = File(repository, "native/vendor/filament")
    inputs.files(fileTree(vendor), File(repository, "scripts/native/rebuild-map-filament.py"))
    doLast {
        val manifest = groovy.json.JsonSlurper().parse(File(vendor, "manifest.json")) as Map<*, *>
        fun sha256(path: File) = MessageDigest.getInstance("SHA-256").digest(path.readBytes()).joinToString("") { "%02x".format(it) }
        val sources = manifest["sources"] as Map<*, *>
        require(sources.keys == setOf("scripts/native/rebuild-map-filament.py", "native/vendor/filament/CMakeLists.txt", "native/vendor/filament/orthographic-froxels.patch"))
        sources.forEach { (name, expected) ->
            require(sha256(File(repository, name as String)) == expected) { "Rebuild patched Filament: $name" }
        }
        require(sha256(File(vendor, "filament-android-1.77.3-ortho1.aar")) == manifest["aarHash"]) { "Invalid patched Filament package" }
    }
}
tasks.named("preBuild") { dependsOn(checkMapFilament) }
