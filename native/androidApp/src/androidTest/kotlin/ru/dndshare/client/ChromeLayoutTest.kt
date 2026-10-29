package ru.dndshare.client

import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInWindow
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ActivityScenario
import androidx.test.filters.SdkSuppress
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

    @Test
    fun edgeToEdgeScrollUsesSystemBarAreasAndKeepsControlsSafe() {
        val viewport = AtomicReference(Rect.Zero)
        val first = AtomicReference(0f)
        val last = AtomicReference(Rect.Zero)
        val safeBottom = AtomicReference(0f)
        val scroll = AtomicReference<ScrollState>()
        ActivityScenario.launch(ComponentActivity::class.java).use { activity ->
            activity.onActivity { host ->
                host.enableEdgeToEdge(
                    statusBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
                    navigationBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
                )
                host.setContent {
                    DndTheme {
                        val density = LocalDensity.current
                        val bottom = WindowInsets.safeDrawing.getBottom(density).toFloat()
                        val state = rememberScrollState()
                        SideEffect {
                            scroll.set(state)
                            safeBottom.set(bottom)
                        }
                        ShareChromeLayout(header = { ShareWorkspaceHeader { Text("Toolbar") } }) {
                            padding ->
                            Column(
                                Modifier.fillMaxSize()
                                    .onGloballyPositioned {
                                        viewport.set(
                                            Rect(
                                                it.positionInWindow(),
                                                Size(
                                                    it.size.width.toFloat(),
                                                    it.size.height.toFloat(),
                                                ),
                                            )
                                        )
                                    }
                                    .verticalScroll(state)
                                    .padding(padding)
                            ) {
                                Text(
                                    "First",
                                    Modifier.onGloballyPositioned {
                                        first.set(it.positionInWindow().y)
                                    },
                                )
                                Spacer(Modifier.height(1600.dp))
                                ShareButton(
                                    {},
                                    Modifier.onGloballyPositioned { last.set(it.boundsInWindow()) },
                                ) {
                                    Text("Last action")
                                }
                            }
                        }
                    }
                }
            }
            await { viewport.get().height > 0 && scroll.get()?.maxValue?.let { it > 0 } == true }
            assertEquals(0f, viewport.get().top, 1f)
            assertTrue(first.get() > 64f)
            kotlinx.coroutines.runBlocking { scroll.get().scrollTo(scroll.get().maxValue) }
            await { first.get() < 0 && last.get().height > 0 }
            val screenshot =
                requireNotNull(
                    InstrumentationRegistry.getInstrumentation().uiAutomation.takeScreenshot()
                )
            assertEquals(screenshot.height.toFloat(), viewport.get().bottom, 1f)
            screenshot.recycle()
            assertTrue(last.get().bottom <= viewport.get().bottom - safeBottom.get() + 1f)
        }
    }

    @Test
    fun keyboardResizesScrollViewportAndKeepsFooterReachable() {
        val viewport = AtomicReference(Rect.Zero)
        val action = AtomicReference(Rect.Zero)
        val keyboard = AtomicReference(0)
        ActivityScenario.launch(ComponentActivity::class.java).use { activity ->
            activity.onActivity { host ->
                host.enableEdgeToEdge()
                host.setContent {
                    DndTheme {
                        val density = LocalDensity.current
                        val ime = WindowInsets.ime.getBottom(density)
                        SideEffect { keyboard.set(ime) }
                        ShareChromeLayout(
                            header = { ShareWorkspaceHeader { Text("Toolbar") } },
                            footer = {
                                ShareButton(
                                    {},
                                    Modifier.onGloballyPositioned {
                                        action.set(it.boundsInWindow())
                                    },
                                ) {
                                    Text("Safe action")
                                }
                            },
                        ) { padding ->
                            Column(
                                Modifier.fillMaxSize()
                                    .onGloballyPositioned { viewport.set(it.boundsInWindow()) }
                                    .verticalScroll(rememberScrollState())
                                    .padding(padding)
                            ) {
                                ShareTextInput("Entry", {}, "Field")
                                Spacer(Modifier.height(1200.dp))
                            }
                        }
                    }
                }
            }
            await { action.get().height > 0 }
            val initial = viewport.get()
            TouchRobot.click("Entry")
            await { keyboard.get() > 0 && viewport.get().height < initial.height - 80 }
            assertTrue(action.get().bottom <= viewport.get().bottom + 1f)
            assertTrue(action.get().top >= viewport.get().top)
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
