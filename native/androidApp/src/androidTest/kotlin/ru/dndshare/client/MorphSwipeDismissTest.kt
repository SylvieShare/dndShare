package ru.dndshare.client

import android.graphics.Rect
import android.view.accessibility.AccessibilityNodeInfo
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect as ComposeRect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ActivityScenario
import java.util.concurrent.atomic.*
import kotlin.test.*
import org.junit.Rule
import org.junit.Test
import ru.dndshare.client.ui.designsystem.*

class MorphSwipeDismissTest {
    @get:Rule val animatorScale = AnimatorScaleRule()

    private fun scenario(
        test:
            (
                ActivityScenario<ComponentActivity>,
                MutableState<Boolean>,
                AtomicReference<ShareMorphState>,
                AtomicInteger,
                AtomicReference<ComposeRect>,
            ) -> Unit
    ) {
        val open = mutableStateOf(false)
        val state = AtomicReference<ShareMorphState>()
        val instances = AtomicInteger()
        val preview = AtomicReference(ComposeRect.Zero)
        ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
            scenario.onActivity { activity ->
                activity.setContent {
                    ShareTheme {
                        val morph = rememberShareMorphState()
                        SideEffect { state.set(morph) }
                        CompositionLocalProvider(LocalShareMorphState provides morph) {
                            ShareMorphHost(
                                morph,
                                Modifier.fillMaxSize()
                                    .windowInsetsPadding(WindowInsets.safeDrawing),
                                background = {
                                    ShareMorphSource(
                                        "face",
                                        Modifier.width(260.dp),
                                        scrollPreview = false,
                                    ) {
                                        remember { instances.incrementAndGet() }
                                        Box(
                                            Modifier.fillMaxWidth()
                                                .height(80.dp)
                                                .background(Color.Green)
                                                .onGloballyPositioned {
                                                    preview.set(it.boundsInWindow())
                                                }
                                        )
                                    }
                                },
                            ) {
                                ShareMorphDialog(
                                    morph,
                                    if (open.value) "face" else null,
                                    "Редактор",
                                    true,
                                    { open.value = false },
                                ) {
                                    Column {
                                        repeat(40) {
                                            Text(
                                                "Строка $it",
                                                Modifier.fillMaxWidth().height(40.dp),
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            scenario.onActivity { open.value = true }
            TouchRobot.await {
                state.get()?.progress == 1f && TouchRobot.find("Потянуть, чтобы закрыть") != null
            }
            test(scenario, open, state, instances, preview)
        }
    }

    @Test
    fun shortDragReturnsAndFullDragClosesTheSameRememberedPreview() =
        scenario { _, open, morph, instances, preview ->
            val handle = TouchRobot.bounds("Потянуть, чтобы закрыть")
            val top = preview.get().top
            val density =
                androidx.test.platform.app.InstrumentationRegistry.getInstrumentation()
                    .targetContext
                    .resources
                    .displayMetrics
                    .density
            TouchRobot.drag(
                handle.exactCenterX(),
                handle.exactCenterY(),
                handle.exactCenterX(),
                handle.exactCenterY() + 30 * density,
                500,
            )
            TouchRobot.await { kotlin.math.abs(preview.get().top - top) < 2f }
            assertTrue(open.value)
            assertEquals(1, instances.get())
            TouchRobot.drag(
                handle.exactCenterX(),
                handle.exactCenterY(),
                handle.exactCenterX(),
                handle.exactCenterY() + 160 * density,
                500,
            ) {
                val fd =
                    androidx.test.platform.app.InstrumentationRegistry.getInstrumentation()
                        .uiAutomation
                        .executeShellCommand(
                            "screencap -p /sdcard/Download/controls-motion-drag.png"
                        )
                android.os.ParcelFileDescriptor.AutoCloseInputStream(fd).use { it.readBytes() }
                assertTrue(
                    preview.get().top > top + 120 * density,
                    "Preview follows the finger before release: before=$top actual=${preview.get()} handle=$handle",
                )
            }
            TouchRobot.await { !open.value && !morph.get().isActive }
            assertEquals(1, instances.get(), "Dismiss preserves the original subtree")
        }

    @Test
    fun aScrolledFormConsumesTheDragBeforeTheSheetCanBeDismissed() =
        scenario { _, open, morph, _, _ ->
            fun scroller() = TouchRobot.findNode { it.isScrollable }
            val scroll = requireNotNull(scroller())
            assertTrue(scroll.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD))
            Thread.sleep(350)
            val area = Rect().also { requireNotNull(scroller()).getBoundsInScreen(it) }
            val density =
                androidx.test.platform.app.InstrumentationRegistry.getInstrumentation()
                    .targetContext
                    .resources
                    .displayMetrics
                    .density
            TouchRobot.drag(
                area.exactCenterX(),
                area.top + 90 * density,
                area.exactCenterX(),
                area.top + 230 * density,
                500,
            )
            assertTrue(
                open.value,
                "Scrolling toward the beginning must not dismiss a scrolled form",
            )
            repeat(4) {
                scroller()?.performAction(AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD)
                Thread.sleep(120)
            }
            TouchRobot.drag(
                area.exactCenterX(),
                area.top + 40 * density,
                area.exactCenterX(),
                area.top + 200 * density,
                500,
            )
            TouchRobot.await { !open.value && !morph.get().isActive }
        }
}
