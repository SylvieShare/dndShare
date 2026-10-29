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

    @Test
    fun wholeTileTapOpensMenuWhileHeldCrossColumnDragOnlyReorders() {
        val latest = AtomicReference<List<String>>(emptyList())
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
                                        2,
                                        true,
                                        { order ->
                                            rows = orderedWeapons(rows, order)
                                            latest.set(order)
                                            null
                                        },
                                    ) { entry, modifier, dragging ->
                                        WeaponSheetCard(
                                            entry,
                                            null,
                                            LayoutFormat.Tablet,
                                            modifier,
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
            assertEquals(a.top, b.top)
            assertTrue(b.left > a.left)
            TouchRobot.longPressDrag(
                a.exactCenterX(),
                a.exactCenterY(),
                b.exactCenterX(),
                b.exactCenterY(),
            )
            TouchRobot.await { latest.get().firstOrNull() == "b" }
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
