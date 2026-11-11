plugins {
    id("com.android.application") version "9.4.0" apply false
    id("com.android.library") version "9.4.0" apply false
}
subprojects {
    buildscript.configurations.matching { it.name == "classpath" }.configureEach {
        resolutionStrategy.force("com.android.tools.build:gradle:9.4.0")
    }
}
