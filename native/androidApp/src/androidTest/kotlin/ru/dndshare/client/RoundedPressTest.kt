package ru.dndshare.client

import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.util.concurrent.atomic.AtomicInteger
import kotlin.test.*
import org.junit.Test
import ru.dndshare.client.ui.designsystem.*

class RoundedPressTest {
    @get:org.junit.Rule val animations = AnimatorScaleRule()

    @Test
    fun tabAndSpellSlotPressStayInsideTheirRoundShape() {
        val changed = AtomicInteger()
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
            scenario.onActivity { host ->
                host.setContent {
                    CompositionLocalProvider(LocalDensity provides Density(1f, 1f)) {
                        ShareTheme {
                            Column(
                                Modifier.fillMaxSize()
                                    .background(WebPalette.Surface)
                                    .windowInsetsPadding(WindowInsets.safeDrawing)
                                    .padding(20.dp)
                            ) {
                                ShareIconNavigation(
                                    listOf(
                                        ShareNavigationItem("a", "Первая"),
                                        ShareNavigationItem("b", "Вторая"),
                                    ),
                                    "a",
                                    { changed.incrementAndGet() },
                                    pill = true,
                                ) {
                                    Box(Modifier.size(16.dp).background(Color.White))
                                }
                                Spacer(Modifier.height(20.dp))
                                ShareResourceOrb(
                                    false,
                                    "Тестовая ячейка",
                                    onClick = { changed.incrementAndGet() },
                                )
                            }
                        }
                    }
                }
            }
            listOf("Вторая", "Тестовая ячейка").forEachIndexed { index, label ->
                TouchRobot.await { TouchRobot.find(label) != null }
                var node = requireNotNull(TouchRobot.find(label))
                while (!node.isClickable && node.parent != null) node = node.parent
                assertTrue(node.isClickable)
                val rect = android.graphics.Rect().also { node.getBoundsInScreen(it) }
                val before = requireNotNull(instrumentation.uiAutomation.takeScreenshot())
                TouchRobot.drag(
                    rect.exactCenterX(),
                    rect.exactCenterY(),
                    rect.exactCenterX(),
                    rect.exactCenterY(),
                    beforeRelease = {
                        android.os.SystemClock.sleep(160)
                        val during = requireNotNull(instrumentation.uiAutomation.takeScreenshot())
                        val corners =
                            listOf(
                                rect.left + 2 to rect.top + 2,
                                rect.right - 3 to rect.top + 2,
                                rect.left + 2 to rect.bottom - 3,
                                rect.right - 3 to rect.bottom - 3,
                            )
                        corners.forEach { (x, y) ->
                            assertEquals(
                                before.getPixel(x, y),
                                during.getPixel(x, y),
                                "Press leaked into corner of $label",
                            )
                        }
                        assertTrue(
                            (4..10).any { dx ->
                                before.getPixel(rect.left + dx, rect.centerY()) !=
                                    during.getPixel(rect.left + dx, rect.centerY())
                            },
                            "Pressed feedback must stay visible: $label",
                        )
                        File(
                                instrumentation.targetContext.getExternalFilesDir(null),
                                "rounded-press-$index.png",
                            )
                            .outputStream()
                            .use {
                                during.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it)
                            }
                        during.recycle()
                    },
                )
                before.recycle()
            }
            assertEquals(2, changed.get())
        }
    }
}
