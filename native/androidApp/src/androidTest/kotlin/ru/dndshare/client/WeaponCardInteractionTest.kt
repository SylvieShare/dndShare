package ru.dndshare.client

import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ActivityScenario
import coil3.ImageLoader
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.LayoutFormat
import ru.dndshare.client.ui.character.*
import ru.dndshare.client.ui.designsystem.*

class WeaponCardInteractionTest {
    @get:org.junit.Rule val animation = AnimatorScaleRule()

    @Test fun heldCardCanReverseRepeatedlyAcrossColumns() = exercise(2)

    @Test fun heldCardCanReverseRepeatedlyAcrossRows() = exercise(1)

    private fun exercise(columns: Int) {
        val latest = AtomicReference<List<String>>(emptyList())
        val saves = AtomicInteger()
        ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
            scenario.onActivity { host ->
                host.setContent {
                    CompositionLocalProvider(LocalDensity provides Density(1f, 1f)) {
                        var rows by remember {
                            mutableStateOf(
                                listOf("a", "b", "c", "d").map { uid ->
                                    buildJsonObject {
                                        put("uid", uid)
                                        put(
                                            "override",
                                            buildJsonObject { put("name", "Клинок $uid") },
                                        )
                                    }
                                }
                            )
                        }
                        val sheet = SheetStateServer().sheet
                        val context =
                            SheetContext(
                                sheet,
                                HandbookMetadata(),
                                emptyMap(),
                                remember { ImageLoader.Builder(host).build() },
                                true,
                                {},
                                {},
                                DndDerivedValues(sheet, emptyMap(), HandbookMetadata()),
                                SheetJournalState(),
                            )
                        ShareTheme {
                            CompositionLocalProvider(LocalCharacterSheet provides context) {
                                Box(
                                    Modifier.width(700.dp)
                                        .windowInsetsPadding(WindowInsets.safeDrawing)
                                ) {
                                    WeaponGrid(
                                        rows,
                                        columns,
                                        true,
                                        { order ->
                                            rows = orderedWeapons(rows, order)
                                            latest.set(order)
                                            saves.incrementAndGet()
                                            null
                                        },
                                    ) { entry, modifier, dragging ->
                                        WeaponSheetCard(
                                            entry,
                                            null,
                                            LayoutFormat.Tablet,
                                            modifier.heightIn(
                                                min = if (entry.text("uid") == "b") 180.dp else 0.dp
                                            ),
                                            dragging,
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
            TouchRobot.await {
                TouchRobot.find("Действия с записью: Клинок a") != null &&
                    TouchRobot.find("Действия с записью: Клинок b") != null
            }
            val a = TouchRobot.bounds("Действия с записью: Клинок a")
            val b = TouchRobot.bounds("Действия с записью: Клинок b")
            if (columns == 2) {
                assertEquals(a.top, b.top)
                assertTrue(b.left > a.left)
            } else assertTrue(b.top > a.top)
            fun position(label: String) =
                TouchRobot.bounds(label).let { if (columns == 2) it.left else it.top }
            val source = if (columns == 2) a.left else a.top
            val destination = if (columns == 2) b.left else b.top
            val ap = a.exactCenterX() to a.exactCenterY()
            val bp = b.exactCenterX() to b.exactCenterY()
            TouchRobot.longPressDragPath(listOf(ap, bp, ap, bp)) { index ->
                TouchRobot.await("live reverse leg $index") {
                    position("Действия с записью: Клинок b") ==
                        if (index == 1) destination else source
                }
            }
            TouchRobot.await { latest.get().firstOrNull() == "b" }
            assertEquals(1, saves.get())
            val newA = TouchRobot.bounds("Действия с записью: Клинок a")
            val newB = TouchRobot.bounds("Действия с записью: Клинок b")
            TouchRobot.longPressDragPath(
                listOf(
                    newA.exactCenterX() to newA.exactCenterY(),
                    newB.exactCenterX() to newB.exactCenterY(),
                    newA.exactCenterX() to newA.exactCenterY(),
                )
            ) { index ->
                TouchRobot.await("return without release") {
                    position("Действия с записью: Клинок b") ==
                        if (index == 0) destination else source
                }
            }
            assertEquals(
                1,
                saves.get(),
                "Returning to the start must not enqueue an unchanged order",
            )
            assertNull(
                TouchRobot.find("Свойства"),
                "A drag must not open an action menu on release",
            )
            assertEquals(setOf("a", "b", "c", "d"), latest.get().toSet())
            TouchRobot.click("Действия с записью: Клинок a")
            TouchRobot.await { TouchRobot.find("Свойства") != null }
        }
    }
}
