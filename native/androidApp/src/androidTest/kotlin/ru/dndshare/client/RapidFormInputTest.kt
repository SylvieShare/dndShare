package ru.dndshare.client

import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import kotlin.test.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map
import org.junit.Test
import ru.dndshare.client.ui.designsystem.*

class RapidFormInputTest {
    @Test
    fun delayedScreenUpdatesNeverReplaceTheNativeEditingBuffer() {
        val model = MutableStateFlow("")
        val latest = AtomicReference("")
        val focused = AtomicBoolean(false)
        val placed = AtomicBoolean(false)
        val registry = ShareFormInputs()
        val instrument = InstrumentationRegistry.getInstrumentation()
        ActivityScenario.launch(ComponentActivity::class.java).use { activity ->
            activity.onActivity { host ->
                host.setContent {
                    val delayed =
                        remember(model) {
                            model.map {
                                delay(25)
                                it
                            }
                        }
                    val rendered by delayed.collectAsState("")
                    val request = remember { FocusRequester() }
                    ShareTheme {
                        CompositionLocalProvider(LocalShareFormInputs provides registry) {
                            Column(Modifier.fillMaxWidth().padding(24.dp)) {
                                ShareTextInput(
                                    rendered,
                                    {
                                        latest.set(it)
                                        model.value = it
                                    },
                                    "Название",
                                    Modifier.focusRequester(request)
                                        .onFocusChanged { focused.set(it.hasFocus) }
                                        .onGloballyPositioned { placed.set(it.size.width > 0) },
                                )
                            }
                            LaunchedEffect(Unit) { request.requestFocus() }
                        }
                    }
                }
            }
            try {
                await { placed.get() && focused.get() }
                val expected = "NativeRope".repeat(12)
                instrument.sendStringSync(expected)
                instrument.runOnMainSync { registry.flush() }
                await { latest.get() == expected }
                assertEquals(expected, latest.get())
                // Append after old presentation emissions: the cursor must still be at the end.
                Thread.sleep(200)
                instrument.sendStringSync("END")
                instrument.runOnMainSync { registry.flush() }
                await { latest.get() == expected + "END" }
                assertEquals(expected + "END", latest.get())
            } catch (error: Throwable) {
                activity.onActivity { host ->
                    val state =
                        "placed=${placed.get()} focused=${focused.get()} latest=${latest.get()} windowFocus=${host.window.decorView.hasWindowFocus()} shown=${host.window.decorView.isShown}"
                    java.io.File(host.filesDir, "rapid-input-diagnostic.txt").writeText(state)
                }
                throw error
            }
        }
    }

    private fun await(predicate: () -> Boolean) {
        val deadline = System.nanoTime() + 15_000_000_000
        while (!predicate()) {
            check(System.nanoTime() < deadline) {
                "Native text input did not reach the expected state"
            }
            Thread.sleep(40)
        }
    }
}
