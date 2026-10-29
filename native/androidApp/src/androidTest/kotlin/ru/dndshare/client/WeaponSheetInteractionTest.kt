package ru.dndshare.client

import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ActivityScenario
import java.util.concurrent.atomic.AtomicInteger
import kotlin.test.*
import org.junit.Test
import ru.dndshare.client.ui.designsystem.*

class WeaponSheetInteractionTest {
    @get:org.junit.Rule val animations = AnimatorScaleRule()

    @Test
    fun compactMechanicOpensFromBelowAndDragClosesItsCustomSheet() {
        val changed = AtomicInteger()
        ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
            scenario.onActivity { host ->
                host.setContent {
                    var open by remember { mutableStateOf(false) }
                    ShareTheme {
                        CompositionLocalProvider(LocalDisclosureSheets provides true) {
                            Column(
                                Modifier.windowInsetsPadding(WindowInsets.safeDrawing)
                                    .padding(16.dp)
                            ) {
                                ShareActionDisclosure(
                                    "Особое применение",
                                    "Способность",
                                    open,
                                    { open = it },
                                ) {
                                    Text("Содержимое способности")
                                    ShareButton({ changed.incrementAndGet() }) { Text("Выполнить") }
                                }
                            }
                        }
                    }
                }
            }
            TouchRobot.click("Особое применение: Способность")
            TouchRobot.await { TouchRobot.find("Содержимое способности") != null }
            TouchRobot.click("Выполнить")
            assertEquals(1, changed.get())
            var previous = TouchRobot.bounds("Потянуть, чтобы закрыть")
            var stable = 0
            TouchRobot.await {
                val current = TouchRobot.bounds("Потянуть, чтобы закрыть")
                stable = if (current == previous) stable + 1 else 0
                previous = current
                android.os.SystemClock.sleep(90)
                stable >= 3
            }
            val handle = TouchRobot.bounds("Потянуть, чтобы закрыть")
            val height =
                androidx.test.platform.app.InstrumentationRegistry.getInstrumentation()
                    .targetContext
                    .resources
                    .displayMetrics
                    .heightPixels
            TouchRobot.drag(
                handle.exactCenterX(),
                handle.exactCenterY(),
                handle.exactCenterX(),
                (height - 100).toFloat(),
                500,
            )
            TouchRobot.await { TouchRobot.find("Содержимое способности") == null }
        }
    }
}
