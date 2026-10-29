package ru.dndshare.client

import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.filters.SdkSuppress
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import kotlin.math.roundToInt
import kotlin.test.*
import org.junit.Test
import ru.dndshare.client.ui.DndTheme
import ru.dndshare.client.ui.character.CharacterListSubheader
import ru.dndshare.client.ui.designsystem.*

class ChromeLayoutTest {
    @Test
    @SdkSuppress(minSdkVersion = 31)
    fun backdropIsLiveBlurredAndOptOutKeepsForegroundAndLayout() {
        val blur = mutableStateOf(true)
        val alternate = mutableStateOf(false)
        val bounds = AtomicReference(Rect.Zero)
        val inset = AtomicReference(0f)
        val density = AtomicReference(1f)
        ActivityScenario.launch(ComponentActivity::class.java).use { activity ->
            activity.onActivity { host ->
                host.setContent {
                    DndTheme {
                        val scale = LocalDensity.current.density
                        SideEffect { density.set(scale) }
                        Box(
                            Modifier.width(320.dp).height(500.dp).onGloballyPositioned {
                                bounds.set(it.boundsInWindow())
                            }
                        ) {
                            ShareChromeLayout(
                                blurEnabled = blur.value,
                                header = { ShareWorkspaceHeader { Text("Toolbar") } },
                                subheader = { CharacterListSubheader {} },
                            ) { padding ->
                                SideEffect { inset.set(padding.calculateTopPadding().value) }
                                Canvas(Modifier.fillMaxSize()) {
                                    val stripe = 4.dp.toPx()
                                    repeat((size.width / stripe).toInt() + 1) { index ->
                                        val color =
                                            if (alternate.value) {
                                                if (index % 2 == 0) Color.Green else Color.Blue
                                            } else if (index % 2 == 0) Color.White else Color.Black
                                        drawRect(
                                            color,
                                            Offset(index * stripe, 0f),
                                            Size(stripe, size.height),
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
            await { bounds.get().width > 0 && inset.get() > 64f }
            fun sample(y: Float): List<Int> {
                val bitmap =
                    requireNotNull(
                        InstrumentationRegistry.getInstrumentation().uiAutomation.takeScreenshot()
                    )
                val box = bounds.get()
                val d = density.get()
                return (0..18)
                    .map { i ->
                        val pixel =
                            bitmap.getPixel(
                                (box.left + (222 + i * 4) * d).roundToInt(),
                                (box.top + y * d).roundToInt(),
                            )
                        android.graphics.Color.red(pixel)
                    }
                    .also { bitmap.recycle() }
            }
            fun spread(y: Float): Int = sample(y).let { it.max() - it.min() }
            await { spread(20f) < 12 && spread(220f) > 180 }
            val initial = sample(20f).average()
            activity.onActivity { alternate.value = true }
            await { kotlin.math.abs(sample(20f).average() - initial) > 8 }
            val originalInset = inset.get()
            activity.onActivity {
                alternate.value = false
                blur.value = false
            }
            await { spread(20f) > 35 }
            assertEquals(originalInset, inset.get())
        }
    }

    @Test
    fun largeTextKeepsTitleAndCreationActionAboveContent() {
        val inset = AtomicReference(0f)
        val clicked = AtomicInteger()
        ActivityScenario.launch(ComponentActivity::class.java).use { activity ->
            activity.onActivity { host ->
                host.setContent {
                    val base = LocalDensity.current
                    CompositionLocalProvider(LocalDensity provides Density(base.density, 1.6f)) {
                        DndTheme {
                            Box(Modifier.width(320.dp).height(500.dp)) {
                                ShareChromeLayout(
                                    header = { ShareWorkspaceHeader { Text("Toolbar") } },
                                    subheader = {
                                        CharacterListSubheader { clicked.incrementAndGet() }
                                    },
                                ) { padding ->
                                    SideEffect { inset.set(padding.calculateTopPadding().value) }
                                    Text("Содержимое", Modifier.padding(padding))
                                }
                            }
                        }
                    }
                }
            }
            await { inset.get() > 150f }
            TouchRobot.click("Новый персонаж")
            await { clicked.get() == 1 }
            assertNotNull(TouchRobot.find("Персонажи"))
            assertNotNull(TouchRobot.find("Содержимое"))
        }
    }

    private fun await(test: () -> Boolean) {
        val end = System.nanoTime() + 10_000_000_000
        while (!test()) {
            if (System.nanoTime() > end) error("Chrome pixels did not settle")
            Thread.sleep(80)
        }
    }
}
