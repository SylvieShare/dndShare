plugins { id("com.android.application") }
val releases = groovy.json.JsonSlurper().parse(file("../../release/versions.json")) as Map<*, *>
val nativeRelease = releases["android"] as Map<*, *>
android {
    namespace = "ru.dndshare.client"
    compileSdk = 37
    defaultConfig {
        applicationId = "ru.dndshare.client"
        minSdk = 26
        targetSdk = 37
        versionCode = (nativeRelease["build"] as Number).toInt()
        versionName = nativeRelease["version"] as String
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
    buildTypes {
        release { signingConfig = signingConfigs.getByName("debug") }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_21
        targetCompatibility = JavaVersion.VERSION_21
    }
    sourceSets.getByName("main").assets.srcDir(file("build/web-assets"))
    sourceSets.getByName("main").assets.srcDir(file("build/runtime-assets"))
    sourceSets.getByName("androidTest").assets.srcDir(file("build/ota-test-assets"))
}
dependencies {
    implementation(project(":capacitor-android"))
    implementation("androidx.activity:activity:1.13.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("androidx.window:window:1.5.1")
    implementation("androidx.window:window-java:1.5.1")
    implementation("androidx.annotation:annotation-experimental:1.4.1")
    androidTestImplementation("androidx.test:runner:1.7.0")
    androidTestImplementation("androidx.test.ext:junit:1.3.0")
    androidTestImplementation("androidx.test:core:1.7.0")
}
val bundleWeb by tasks.registering(Exec::class) {
    workingDir = file("../../frontend")
    commandLine("node", "node_modules/vite/bin/vite.js", "build")
    inputs.files(fileTree("../../frontend/src"), fileTree("../../frontend/public"), fileTree("../../frontend/scripts"),
        file("../../frontend/index.html"), file("../../frontend/package-lock.json"), file("../../frontend/vite.config.js"),
        fileTree("../../release"), fileTree("../../scripts/release"), fileTree("src/main"), file("build.gradle.kts"))
    outputs.dir("../../frontend/target/dist")
}
val copyWeb by tasks.registering(Sync::class) {
    dependsOn(bundleWeb)
    from("../../frontend/target/dist") { into("public"); exclude("**/*.gz", "**/*.br") }
    into(layout.buildDirectory.dir("web-assets"))
}
val runtimeMetadata by tasks.registering(Exec::class) {
    dependsOn(bundleWeb)
    workingDir = file("../..")
    commandLine("node", "scripts/release/metadata.mjs", "--native-out", file("build/runtime-assets").absolutePath)
    inputs.files(fileTree("src/main"), file("build.gradle.kts"), fileTree("../../release"), fileTree("../../scripts/release"), file("../../frontend/package-lock.json"), file("../../frontend/target/dist/build-info.json"))
    outputs.file("build/runtime-assets/client-runtime.json")
}
tasks.named("preBuild") { dependsOn(copyWeb, runtimeMetadata) }
val updaterFixtures by tasks.registering(Exec::class) {
    workingDir = file("../..")
    commandLine("node", "scripts/release/test-bundles.mjs", file("build/ota-test-assets/ota").absolutePath)
    inputs.files(fileTree("../../scripts/release"), file("../../frontend/package-lock.json"))
    outputs.dir("build/ota-test-assets/ota")
}
tasks.matching { it.name.contains("AndroidTest") }.configureEach { dependsOn(updaterFixtures) }
