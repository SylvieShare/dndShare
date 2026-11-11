plugins { id("com.android.application") }
android {
    namespace = "ru.dndshare.client"
    compileSdk = 37
    defaultConfig {
        applicationId = "ru.dndshare.client"
        minSdk = 26
        targetSdk = 37
        versionCode = 3
        versionName = "0.2.1"
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
        file("../../frontend/index.html"), file("../../frontend/package-lock.json"), file("../../frontend/vite.config.js"))
    outputs.dir("../../frontend/target/dist")
}
val copyWeb by tasks.registering(Sync::class) {
    dependsOn(bundleWeb)
    from("../../frontend/target/dist") { into("public"); exclude("**/*.gz", "**/*.br") }
    into(layout.buildDirectory.dir("web-assets"))
}
tasks.named("preBuild") { dependsOn(copyWeb) }
