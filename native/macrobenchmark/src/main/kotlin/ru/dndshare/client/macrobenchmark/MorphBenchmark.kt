package ru.dndshare.client.macrobenchmark

import android.content.Intent
import android.os.SystemClock
import androidx.benchmark.macro.CompilationMode
import androidx.benchmark.macro.FrameTimingMetric
import androidx.benchmark.macro.StartupMode
import androidx.benchmark.macro.junit4.MacrobenchmarkRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import androidx.test.uiautomator.By
import androidx.test.uiautomator.Until
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@LargeTest
@RunWith(AndroidJUnit4::class)
class MorphBenchmark {
    @get:Rule val benchmark = MacrobenchmarkRule()

    @Test fun normal() = measure(extraSkills = 0, keyboard = false)
    @Test fun longPreviewWithKeyboard() = measure(extraSkills = 35, keyboard = true)

    private fun measure(extraSkills: Int, keyboard: Boolean) = benchmark.measureRepeated(
        packageName = PACKAGE, metrics = listOf(FrameTimingMetric()),
        compilationMode = CompilationMode.Full(), startupMode = StartupMode.WARM,
        iterations = 10,
        setupBlock = {
            device.wakeUp()
            startActivityAndWait(Intent().setClassName(PACKAGE, "ru.dndshare.client.benchmark.MorphBenchmarkActivity")
                .putExtra("skills", extraSkills).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK))
            check(device.wait(Until.hasObject(By.desc("Редактировать: Сила")), 10_000))
        },
    ) {
        device.findObject(By.desc("Редактировать: Сила")).click()
        repeat(5) {
            if (device.hasObject(By.text("Основное значение"))) return@repeat
            device.swipe(device.displayWidth / 2, device.displayHeight * 4 / 5,
                device.displayWidth / 2, device.displayHeight / 3, 25)
        }
        check(device.wait(Until.hasObject(By.text("Основное значение")), 5_000))
        if (keyboard) device.findObject(By.clazz("android.widget.EditText")).click()
        SystemClock.sleep(650)
        if (keyboard) { device.pressBack(); SystemClock.sleep(250) }
        device.pressBack()
        check(device.wait(Until.gone(By.clazz("android.widget.EditText")), 5_000))
    }

    companion object { const val PACKAGE = "ru.dndshare.client.benchmark" }
}
