package ru.dndshare.client

import android.graphics.Rect
import android.os.SystemClock
import android.view.InputDevice
import android.view.MotionEvent
import android.view.accessibility.AccessibilityNodeInfo
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import coil3.ImageLoader
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.atomic.AtomicReference
import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.character.*
import ru.dndshare.client.ui.designsystem.*

class InventoryInteractionTest {
    private val instrument
        get() = InstrumentationRegistry.getInstrumentation()

    private fun obj(text: String) = WireJson.parseToJsonElement(text).jsonObject

    private fun await(condition: () -> Boolean) {
        val end = SystemClock.uptimeMillis() + 15_000
        while (!condition()) {
            check(SystemClock.uptimeMillis() < end) { "Native inventory timed out" }
            Thread.sleep(30)
        }
    }

    private fun node(label: String): AccessibilityNodeInfo? {
        fun find(value: AccessibilityNodeInfo?): AccessibilityNodeInfo? {
            if (value == null) return null
            for (i in 0 until value.childCount) find(value.getChild(i))?.let {
                return it
            }
            return value.takeIf {
                it.contentDescription?.toString() == label || it.text?.toString() == label
            }
        }
        return find(instrument.uiAutomation.rootInActiveWindow)
    }

    private fun bounds(label: String): Rect {
        await { node(label) != null }
        return Rect().also { requireNotNull(node(label)).getBoundsInScreen(it) }
    }

    private fun touch(action: Int, x: Float, y: Float, down: Long) {
        val properties =
            MotionEvent.PointerProperties().apply {
                id = 0
                toolType = MotionEvent.TOOL_TYPE_FINGER
            }
        val coordinates =
            MotionEvent.PointerCoords().apply {
                this.x = x
                this.y = y
                pressure = 1f
                size = 1f
            }
        val event =
            MotionEvent.obtain(
                down,
                SystemClock.uptimeMillis(),
                action,
                1,
                arrayOf(properties),
                arrayOf(coordinates),
                0,
                0,
                1f,
                1f,
                0,
                0,
                InputDevice.SOURCE_TOUCHSCREEN,
                0,
            )
        try {
            instrument.sendPointerSync(event)
        } finally {
            event.recycle()
        }
    }

    private fun tap(label: String) {
        val rect = bounds(label)
        val down = SystemClock.uptimeMillis()
        touch(MotionEvent.ACTION_DOWN, rect.exactCenterX(), rect.exactCenterY(), down)
        touch(MotionEvent.ACTION_UP, rect.exactCenterX(), rect.exactCenterY(), down)
    }

    @Test
    fun menuActionsAndCrossSpaceDragKeepDataAndDoNotOpenAMenuAfterDragging() {
        val initial =
            CharacterSheet(
                "DND5",
                1,
                obj(
                    """{"values":{"name":"Игрок","items":{"equipped":[],"sections":[{"id":"bag","name":"Сумка","items":[{"uid":"book","item_id":2,"count":2},{"uid":"armor","item_id":12,"count":1,"params":{"saved":2}}],"slots":{"book":0,"armor":1}},{"id":"chest","name":"Сундук","items":[],"slots":{}}]},"money":{"order":[],"amounts":{}}}}"""
                ),
                1,
            )
        val state = mutableStateOf(initial)
        val latest = AtomicReference(initial)
        val edited = AtomicReference("")
        val calls = ConcurrentLinkedQueue<String>()
        val items =
            mapOf(
                2L to CatalogueItem(2, 2, "Книга", data = obj("""{"weight":2}""")),
                12L to CatalogueItem(12, 12, "Панцирь", data = obj("""{"weight":10}""")),
            )
        val images = ImageLoader.Builder(instrument.targetContext).build()
        try {
            ActivityScenario.launch(ComponentActivity::class.java).use { activity ->
                activity.onActivity { host ->
                    host.setContent {
                        val current = state.value
                        val context =
                            SheetContext(
                                current,
                                HandbookMetadata(),
                                items,
                                images,
                                true,
                                { edited.set(it) },
                                {},
                                DndDerivedValues(current, items),
                                SheetJournalState(),
                                uuid = "inventory-test",
                                itemMechanic = { uid, operation, input ->
                                    val before = state.value
                                    val after =
                                        before.copy(
                                            data =
                                                applySheetPatches(
                                                    before.data,
                                                    inventoryActionPatches(
                                                        before,
                                                        uid,
                                                        operation,
                                                        input,
                                                        items,
                                                    ),
                                                )
                                        )
                                    calls.add(operation)
                                    state.value = after
                                    latest.set(after)
                                    null
                                },
                            )
                        ShareTheme {
                            CompositionLocalProvider(LocalCharacterSheet provides context) {
                                Column(
                                    Modifier.fillMaxSize()
                                        .background(WebPalette.Background)
                                        .windowInsetsPadding(WindowInsets.safeDrawing)
                                        .verticalScroll(rememberScrollState())
                                ) {
                                    DndInventory()
                                }
                            }
                        }
                    }
                }
                tap("Действия с предметом: Книга")
                tap("Добавить 1")
                await {
                    inventoryEntry(latest.get().values["items"].objectValue(), "book")
                        ?.get("count")
                        .number() == 3
                }
                tap("Действия с предметом: Панцирь")
                tap("Экипировать")
                await {
                    latest.get().values["items"].objectValue()["equipped"].arrayValue().any {
                        it.objectValue().text("uid") == "armor"
                    }
                }
                val from = bounds("Действия с предметом: Панцирь")
                val to = bounds("Свободная ячейка 1: Сундук")
                val down = SystemClock.uptimeMillis()
                touch(MotionEvent.ACTION_DOWN, from.exactCenterX(), from.exactCenterY(), down)
                Thread.sleep(750)
                for (i in 1..20) {
                    touch(
                        MotionEvent.ACTION_MOVE,
                        from.exactCenterX() + (to.exactCenterX() - from.exactCenterX()) * i / 20,
                        from.exactCenterY() + (to.exactCenterY() - from.exactCenterY()) * i / 20,
                        down,
                    )
                    Thread.sleep(25)
                }
                touch(MotionEvent.ACTION_UP, to.exactCenterX(), to.exactCenterY(), down)
                try {
                    await {
                        latest
                            .get()
                            .values["items"]
                            .objectValue()["sections"]
                            .arrayValue()[1]
                            .objectValue()["slots"]
                            .objectValue()["armor"]
                            .number(-1) == 0
                    }
                } catch (problem: Exception) {
                    throw IllegalStateException(
                        "Inventory drag did not commit: calls=$calls; model=${latest.get().values["items"]}",
                        problem,
                    )
                }
                assertEquals(1, calls.count { it == "inventory-cell" })
                val armor =
                    latest
                        .get()
                        .values["items"]
                        .objectValue()["equipped"]
                        .arrayValue()
                        .single()
                        .objectValue()
                assertEquals("armor", armor.text("uid"))
                assertEquals(2, armor["params"].objectValue()["saved"].number())
                instrument.waitForIdleSync()
                Thread.sleep(300)
                assertNull(node("Свойства"), "A drag must not also activate the cell's click menu")
                tap("Свободная ячейка 2: Сундук")
                tap("Своя вещь")
                await { edited.get() == "inventory:new|chest|1" }
            }
        } finally {
            images.shutdown()
        }
    }
}
