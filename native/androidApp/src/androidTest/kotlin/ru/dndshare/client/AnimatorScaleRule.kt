package ru.dndshare.client

import androidx.test.platform.app.InstrumentationRegistry
import java.io.FileInputStream
import org.junit.rules.ExternalResource

/** Animation tests own and restore this setting; screenshot runs deliberately set it to zero. */
class AnimatorScaleRule : ExternalResource() {
    private var previous: String? = null

    override fun before() {
        previous = shell("settings get global animator_duration_scale").trim()
        shell("settings put global animator_duration_scale 1")
    }

    override fun after() {
        previous?.let { value ->
            shell(
                if (value == "null") "settings delete global animator_duration_scale"
                else "settings put global animator_duration_scale $value"
            )
        }
    }

    private fun shell(command: String): String {
        val descriptor =
            InstrumentationRegistry.getInstrumentation().uiAutomation.executeShellCommand(command)
        return descriptor.use {
            FileInputStream(it.fileDescriptor).bufferedReader().use { reader -> reader.readText() }
        }
    }
}
