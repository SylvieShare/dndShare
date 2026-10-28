package ru.dndshare.client

import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ActivityScenario
import java.util.concurrent.atomic.AtomicReference
import kotlin.math.abs
import kotlin.test.assertTrue
import org.junit.Rule
import org.junit.Test
import ru.dndshare.client.ui.designsystem.*

class MorphEditorViewportTest {
    @get:Rule val animatorScale = AnimatorScaleRule()

    @Test
    fun shortPreviewLeavesTheEntireRemainingHeightForTheScrollableForm() {
        val open = mutableStateOf(false)
        val state = AtomicReference<ShareMorphState>()
        val viewport = AtomicReference<LayoutCoordinates>()
        val preview = AtomicReference<LayoutCoordinates>()
        val form = AtomicReference<LayoutCoordinates>()
        ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
            scenario.onActivity { activity ->
                activity.setContent {
                    ShareTheme {
                        val morph = rememberShareMorphState()
                        SideEffect { state.set(morph) }
                        CompositionLocalProvider(LocalShareMorphState provides morph) {
                            ShareMorphHost(
                                morph,
                                Modifier.requiredSize(390.dp, 700.dp).onGloballyPositioned {
                                    viewport.set(it)
                                },
                                background = {
                                    ShareMorphSource(
                                        "short",
                                        Modifier.width(240.dp),
                                        scrollPreview = false,
                                    ) {
                                        Box(
                                            Modifier.fillMaxWidth()
                                                .height(80.dp)
                                                .onGloballyPositioned { preview.set(it) }
                                        )
                                    }
                                },
                            ) {
                                ShareMorphDialog(
                                    morph,
                                    if (open.value) "short" else null,
                                    "Editor",
                                    true,
                                    { open.value = false },
                                ) {
                                    Column(Modifier.onGloballyPositioned { form.set(it) }) {
                                        repeat(30) {
                                            Text(
                                                "Form row $it",
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
            val deadline = System.nanoTime() + 10_000_000_000L
            var ready = false
            while (!ready && System.nanoTime() < deadline) {
                scenario.onActivity {
                    ready =
                        state.get()?.progress?.let { it >= 0.999f } == true &&
                            form.get()?.isAttached == true
                }
                if (!ready) Thread.sleep(20)
            }
            assertTrue(ready, "Morph must finish opening")
            scenario.onActivity {
                val hostBounds = viewport.get().boundsInWindow()
                val previewBounds = preview.get().boundsInWindow()
                val formBounds = form.get().boundsInWindow()
                assertTrue(
                    abs(formBounds.top - previewBounds.bottom) < 3f,
                    "Form starts after the actual preview",
                )
                assertTrue(
                    abs(formBounds.bottom - hostBounds.bottom) < 3f,
                    "A short preview must not leave an empty area below the scrollable form: $formBounds inside $hostBounds",
                )
            }
        }
    }
}
