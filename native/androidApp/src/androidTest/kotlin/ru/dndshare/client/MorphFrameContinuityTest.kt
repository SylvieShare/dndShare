package ru.dndshare.client

import android.graphics.Bitmap
import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import android.view.PixelCopy
import android.view.Choreographer
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Suite
import ru.dndshare.client.ui.designsystem.*
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.*
import kotlin.test.*

@RunWith(Suite::class)
@Suite.SuiteClasses(MorphContentIdentityTest::class, MorphFrameContinuityTest::class)
class MorphTransitionSuite

class MorphFrameContinuityTest {
    @Test fun openingAndClosingKeepVisiblePixelsAndModalFocusInOneWindow() {
        val open = mutableStateOf(false)
        val dismissEnabled = mutableStateOf(true)
        val renderedDismissEnabled = AtomicBoolean(true)
        val morph = AtomicReference<ShareMorphState>()
        val source = AtomicReference(Rect.Zero)
        val pixels = CopyOnWriteArrayList<Int>()
        val errors = CopyOnWriteArrayList<Int>()
        val sampledPhases = CopyOnWriteArrayList<Pair<Boolean, Float>>()
        val copying = AtomicBoolean(false)
        val backgroundFocused = AtomicBoolean(false)
        val backgroundClicks = AtomicInteger(0)
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
            lateinit var listener: Choreographer.FrameCallback
            scenario.onActivity { activity ->
                activity.setContent {
                    val state = rememberShareMorphState()
                    SideEffect { morph.set(state) }
                    CompositionLocalProvider(LocalShareMorphState provides state) {
                        ShareMorphHost(state, Modifier.widthIn(max = 400.dp), background = {
                            Column(Modifier.fillMaxSize().background(WebPalette.Background)) {
                                ShareMorphSource("face", Modifier.width(160.dp), scrollPreview = false, cornerRadius = 0.dp) {
                                    LazyColumn(Modifier.fillMaxWidth().heightIn(max = 200.dp)
                                        .onGloballyPositioned { if (!state.isActive) source.set(it.boundsInWindow()) }) {
                                        item { Box(Modifier.fillMaxWidth().height(48.dp).background(Color.Green)) }
                                    }
                                }
                                Button(onClick = { backgroundClicks.incrementAndGet() },
                                    modifier = Modifier.onFocusChanged { backgroundFocused.set(it.isFocused) }) { Text("Background") }
                            }
                        }) {
                            val canDismiss = dismissEnabled.value
                            SideEffect { renderedDismissEnabled.set(canDismiss) }
                            ShareMorphDialog(state, if (open.value) "face" else null, "Editor", canDismiss, { open.value = false }) {
                                Column {
                                    Button(onClick = {}) { Text("First") }
                                    Button(onClick = {}) { Text("Last") }
                                }
                            }
                        }
                    }
                }
                listener = Choreographer.FrameCallback {
                    val bounds = source.get()
                    val progress = morph.get()?.progress ?: 0f
                    if (bounds.width > 0 && (pixels.isEmpty() || progress > 0f && progress < 1f) && copying.compareAndSet(false, true)) {
                        val phase = open.value to progress
                        val image = Bitmap.createBitmap(2, 2, Bitmap.Config.ARGB_8888)
                        val region = android.graphics.Rect(bounds.left.toInt() + 2, bounds.top.toInt() + 2,
                            bounds.left.toInt() + 4, bounds.top.toInt() + 4)
                        activity.window.decorView.post {
                        PixelCopy.request(activity.window, region, image, { result ->
                            if (result == PixelCopy.SUCCESS) {
                                val color = image.getPixel(0, 0)
                                if (pixels.isNotEmpty() || color == android.graphics.Color.GREEN) {
                                    pixels.add(color)
                                    sampledPhases.add(phase)
                                }
                            }
                            else if (pixels.isNotEmpty()) errors.add(result)
                            image.recycle()
                            copying.set(false)
                        }, Handler(Looper.getMainLooper()))
                        }
                    }
                    Choreographer.getInstance().postFrameCallback(listener)
                }
                Choreographer.getInstance().postFrameCallback(listener)
            }
            try {
            await { pixels.isNotEmpty() }
            scenario.onActivity { open.value = true }
            await { morph.get().progress == 1f }
            repeat(12) { instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_TAB) }
            assertFalse(backgroundFocused.get(), "Keyboard focus must stay inside the modal overlay")
            assertEquals(0, backgroundClicks.get())
            scenario.onActivity {
                dismissEnabled.value = false
            }
            await { !renderedDismissEnabled.get() }
            scenario.onActivity { it.onBackPressedDispatcher.onBackPressed() }
            assertTrue(open.value, "Back must be consumed while saving")
            scenario.onActivity { dismissEnabled.value = true }
            await { renderedDismissEnabled.get() }
            scenario.onActivity { it.onBackPressedDispatcher.onBackPressed() }
            await { morph.get().progress == 0f && !morph.get().isActive }
            await { sampledPhases.any { !it.first && it.second > 0f && it.second < 1f } }
            assertTrue(sampledPhases.any { it.first && it.second > 0f && it.second < 1f }, "Opening frames must be sampled: $sampledPhases")
            assertTrue(sampledPhases.any { !it.first && it.second > 0f && it.second < 1f }, "Closing frames must be sampled: $sampledPhases")
            assertTrue(errors.isEmpty(), "The window surface must remain valid: $errors")
            assertTrue(pixels.all { it == android.graphics.Color.GREEN }, "Content disappeared in rendered frames: $pixels")
            } finally {
                scenario.onActivity { Choreographer.getInstance().removeFrameCallback(listener) }
            }
        }
    }

    private fun await(condition: () -> Boolean) {
        val deadline = System.nanoTime() + 10_000_000_000L
        while (!condition() && System.nanoTime() < deadline) Thread.sleep(10)
        assertTrue(condition(), "Morph did not settle")
    }
}
