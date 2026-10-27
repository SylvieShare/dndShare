package ru.dndshare.client

import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Text
import androidx.compose.material3.LocalContentColor
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ActivityScenario
import org.junit.Test
import ru.dndshare.designsystem.*
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import kotlin.test.*

class MorphContentIdentityTest {
    @Test fun theOriginalContentReflowsInTheWindowAndSurvivesAnInterruptedClose() {
        val open = mutableStateOf(false)
        val hostVisible = mutableStateOf(true)
        val creations = AtomicInteger(0)
        val atSource = AtomicBoolean(true)
        val reverseOnFrame = AtomicBoolean(false)
        val reopened = CountDownLatch(1)
        val modalForeground = AtomicReference<Color>()
        val sourceHeight = AtomicInteger(0)
        val expectedHeight = AtomicInteger(0)
        val compositions = AtomicInteger(0)
        val sizes = CopyOnWriteArrayList<Pair<Float, Int>>()
        val identities = CopyOnWriteArrayList<Int>()
        val state = AtomicReference<ShareMorphState>()
        ActivityScenario.launch(ComponentActivity::class.java).use { activity ->
            activity.onActivity { host -> host.setContent {
                val morph = rememberShareMorphState()
                SideEffect { state.set(morph) }
                CompositionLocalProvider(LocalShareMorphState provides morph) {
                    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp)) {
                        ShareMorphSource("stat", Modifier.width(260.dp), scrollPreview = false) { presentation ->
                            val identity = remember { creations.incrementAndGet() }
                            val foreground = LocalContentColor.current
                            val view = LocalView.current
                            val height = with(LocalDensity.current) { 40.dp.roundToPx() * 40 }
                            SideEffect {
                                identities.add(identity)
                                compositions.incrementAndGet()
                                atSource.set(!presentation.expanded)
                                if (presentation.expanded) modalForeground.set(foreground)
                                expectedHeight.set(height)
                            }
                            LazyColumn(Modifier.fillMaxWidth().heightIn(max = 5000.dp)
                                .onSizeChanged {
                                    val fraction = presentation.progress()
                                    sizes.add(fraction to it.width)
                                    if (presentation.expanded && fraction in .1f.. .9f && reverseOnFrame.compareAndSet(true, false)) {
                                        view.post { open.value = true; reopened.countDown() }
                                    }
                                    if (!presentation.expanded) sourceHeight.set(it.height)
                                }) {
                                items((0 until 40).toList()) { row ->
                                    Text("Row $row: a long preview which must reflow", Modifier.fillMaxWidth().height(40.dp))
                                }
                            }
                        }
                    }
                    if (hostVisible.value) ShareMorphDialog(morph, if (open.value) "stat" else null, "Stat", true, { open.value = false }) {
                        Text("Editor", Modifier.fillMaxWidth().height(240.dp))
                    }
                }
            } }
            await { sizes.isNotEmpty() && sourceHeight.get() > 0 }
            assertEquals(expectedHeight.get(), sourceHeight.get(), "The source must wrap all rows without an empty viewport gap")
            activity.onActivity { open.value = true }
            await { state.get()?.progress == 1f }
            assertEquals(WebPalette.Text, modalForeground.get(), "The dark modal must provide its own readable foreground")
            val animated = sizes.filter { it.first > 0f && it.first < 1f }.map { it.second }.distinct()
            assertTrue(animated.size >= 2, "Preview must be measured at intermediate widths: $sizes")
            val composedAtRest = compositions.get()
            Thread.sleep(100)
            assertEquals(composedAtRest, compositions.get(), "No continuing recomposition when settled")
            reverseOnFrame.set(true)
            activity.onActivity { open.value = false }
            assertTrue(reopened.await(10, TimeUnit.SECONDS), "The closing frame must support immediate reversal")
            await { state.get().progress == 1f }
            activity.onActivity { open.value = false }
            await { state.get().progress == 0f && atSource.get() && sizes.last().first == 0f }
            assertEquals(1, creations.get(), "Source, preview and restored source must be the same remembered instance")
            assertEquals(setOf(1), identities.toSet())
            activity.onActivity { open.value = true }
            await { state.get().progress == 1f }
            activity.onActivity { hostVisible.value = false }
            await { state.get().progress == 0f && atSource.get() }
            val remountStart = sizes.size
            activity.onActivity { hostVisible.value = true }
            await { state.get().progress == 1f }
            assertTrue(sizes.drop(remountStart).any { it.first in .1f.. .9f }, "A new host must animate from the source")
        }
    }

    private fun await(condition: () -> Boolean) {
        val deadline = System.nanoTime() + 10_000_000_000L
        while (!condition() && System.nanoTime() < deadline) Thread.sleep(10)
        assertTrue(condition(), "Timed out waiting for morph state")
    }
}
