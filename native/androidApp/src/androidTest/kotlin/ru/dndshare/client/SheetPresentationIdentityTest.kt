package ru.dndshare.client

import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.test.core.app.ActivityScenario
import coil3.ImageLoader
import java.util.concurrent.atomic.AtomicReference
import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.HandbookMetadata
import ru.dndshare.client.ui.RichInteractions
import ru.dndshare.client.ui.character.*

class SheetPresentationIdentityTest {
    @Test
    fun navigationReusesPresentationAndActualStatChangesInvalidateIt() {
        fun snapshot(score: Int) =
            SheetSnapshot(
                CharacterSheet(
                    "DND5",
                    1,
                    buildJsonObject {
                        put(
                            "values",
                            buildJsonObject {
                                put(
                                    "STR",
                                    buildJsonObject {
                                        put("value", buildJsonObject { put("base", score) })
                                    },
                                )
                            },
                        )
                    },
                    1,
                ),
                SheetDraft(),
            )
        val document = mutableStateOf(snapshot(12))
        val navigation = mutableStateOf(0)
        val observed = AtomicReference<Triple<Int, CharacterSheet, RichInteractions>>()
        val roll: (SheetRollRequest) -> Unit = {}
        ActivityScenario.launch(ComponentActivity::class.java).use { activity ->
            activity.onActivity { host ->
                host.setContent {
                    val sheet = requireNotNull(rememberPresentedSheet(document.value))
                    val metadata = remember { HandbookMetadata() }
                    val images = remember { ImageLoader.Builder(host).build() }
                    DisposableEffect(images) { onDispose { images.shutdown() } }
                    val mechanics =
                        remember(sheet) { DndDerivedValues(sheet, emptyMap(), metadata) }
                    val rich =
                        rememberSheetRichInteractions(sheet, mechanics, metadata, images, roll)
                    val index = navigation.value
                    SideEffect { observed.set(Triple(index, sheet, rich)) }
                    Text("Page $index")
                }
            }
            await { observed.get() != null }
            val first = observed.get()
            activity.onActivity { navigation.value = 7 }
            await { observed.get().first == 7 }
            assertSame(first.second, observed.get().second)
            assertSame(first.third, observed.get().third)
            activity.onActivity { document.value = snapshot(18) }
            await { observed.get().second !== first.second }
            assertNotSame(first.third, observed.get().third)
            assertEquals(4.0, observed.get().third.variables["str_mod"])
        }
    }

    private fun await(test: () -> Boolean) {
        val end = System.nanoTime() + 10_000_000_000
        while (!test()) {
            if (System.nanoTime() > end) error("Presentation did not update")
            Thread.sleep(20)
        }
    }
}
