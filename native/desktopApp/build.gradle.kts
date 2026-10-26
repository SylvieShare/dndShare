import org.jetbrains.compose.desktop.application.dsl.TargetFormat
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    kotlin("jvm")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.compose")
}
kotlin { compilerOptions.jvmTarget.set(JvmTarget.JVM_17) }
java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}
dependencies {
    implementation(project(":shared"))
    implementation(compose.desktop.currentOs)
}
compose.desktop {
    application {
        mainClass = "ru.dndshare.client.desktop.MainKt"
        javaHome = providers.environmentVariable("JPACKAGE_HOME").getOrElse(System.getProperty("java.home"))
        nativeDistributions {
            targetFormats(TargetFormat.Exe, TargetFormat.Msi)
            packageName = "DnDShare"
            packageVersion = "0.1.0"
            description = "Персонажи и справочник DnD Share"
            vendor = "SylvieShare"
            includeAllModules = true
            windows {
                perUserInstall = true
                menuGroup = "DnD Share"
                upgradeUuid = "7d59a402-096b-45e9-bc4e-94d87b9431fc"
                iconFile.set(rootProject.file("../frontend/public/favicon.ico"))
            }
        }
    }
}
tasks.register<Zip>("packagePortableWindows") {
    dependsOn("createDistributable")
    from(layout.buildDirectory.dir("compose/binaries/main/app"))
    destinationDirectory.set(layout.buildDirectory.dir("distributions"))
    archiveFileName.set("DnDShare-windows-x64-0.1.0.zip")
}
