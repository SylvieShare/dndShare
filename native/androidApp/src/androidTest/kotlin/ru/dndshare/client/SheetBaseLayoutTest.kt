package ru.dndshare.client

import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import coil3.ImageLoader
import java.util.concurrent.ConcurrentHashMap
import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.HandbookMetadata
import ru.dndshare.client.ui.character.*

class SheetBaseLayoutTest {
    @Test
    fun identityAndHealthMeasureAtEachWidthIncludingCompactIntrinsicHealth() {
        val width = mutableIntStateOf(350)
        val measured = ConcurrentHashMap<String, Int>()
        val font = mutableFloatStateOf(1f)
        val instrument = InstrumentationRegistry.getInstrumentation()
        val initial = SheetStateServer().sheet
        val sheet =
            initial.copy(
                data =
                    applySheetPatches(
                        initial.data,
                        listOf(
                            SheetPatch(
                                path = sheetPath("values", "hp", "current"),
                                value = JsonPrimitive(12345),
                            ),
                            SheetPatch(
                                path = sheetPath("values", "hp", "max", "base"),
                                value = JsonPrimitive(54321),
                            ),
                        ),
                    )
            )
        val images = ImageLoader.Builder(instrument.targetContext).build()
        val context =
            SheetContext(
                sheet,
                HandbookMetadata(),
                emptyMap(),
                images,
                false,
                {},
                {},
                DndDerivedValues(sheet, emptyMap()),
                SheetJournalState(),
            )
        try {
            ActivityScenario.launch(ComponentActivity::class.java).use { activity ->
                activity.onActivity { host ->
                    host.setContent {
                        val current = width.intValue
                        val scale = font.floatValue
                        val density = LocalDensity.current
                        CompositionLocalProvider(
                            LocalCharacterSheet provides context,
                            LocalDensity provides Density(density.density, scale),
                        ) {
                            Column(
                                Modifier.requiredWidth(current.dp)
                                    .height(800.dp)
                                    .verticalScroll(rememberScrollState())
                            ) {
                                Box(
                                    Modifier.onGloballyPositioned {
                                        measured["$current:$scale"] = it.size.height
                                    }
                                ) {
                                    DndIdentityCard(compactHealth = current < 600)
                                }
                            }
                        }
                    }
                }
                for ((size, scale) in listOf(350 to 1f, 694 to 1f, 700 to 1f, 350 to 2f)) {
                    activity.onActivity {
                        width.intValue = size
                        font.floatValue = scale
                    }
                    val key = "$size:$scale"
                    val end = System.nanoTime() + 10_000_000_000L
                    while (!measured.containsKey(key) && System.nanoTime() < end) Thread.sleep(10)
                    assertTrue(
                        (measured[key] ?: 0) > 0,
                        "The real identity/health composition must measure at $size",
                    )
                }
            }
        } finally {
            images.shutdown()
        }
    }
}
