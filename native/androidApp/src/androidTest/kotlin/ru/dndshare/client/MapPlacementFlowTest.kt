package ru.dndshare.client

import android.graphics.Rect
import android.os.SystemClock
import android.view.InputDevice
import android.view.MotionEvent
import android.view.accessibility.AccessibilityNodeInfo
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import coil3.ImageLoader
import coil3.svg.SvgDecoder
import java.io.File
import java.util.concurrent.atomic.AtomicReference
import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.*
import ru.dndshare.client.ui.DndTheme
import ru.dndshare.client.ui.layoutFormat
import ru.dndshare.client.ui.maps.MapEditorScreen

class MapPlacementFlowTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val automation
        get() = instrumentation.uiAutomation

    @Test
    fun mobilePalettePlacesOneTileAndFloodFillsTheRemainingRoomThroughTheExistingPatchApi() {
        val context = instrumentation.targetContext
        val bytes = instrumentation.context.assets.open("maps/box.glb").use { it.readBytes() }
        val model =
            MapModel(
                "floor",
                "floor",
                "Пробная плитка",
                collection = "test",
                collectionName = "Набор",
                category = "floor",
                tileType = "floor",
                renderUrl = "/api/maps/models/floor/render",
            )
        val border = buildList {
            for (y in 1..5) for (x in 1..5) if (x == 1 || x == 5 || y == 1 || y == 5)
                add(
                    buildJsonObject {
                        put("id", "wall-$x-$y")
                        put("modelId", "floor")
                        put("x", x)
                        put("y", y)
                        put("rotation", 0)
                        put("level", 0)
                    }
                )
        }
        val doc =
            newMapDocument()
                .with("width", JsonPrimitive(7))
                .with("height", JsonPrimitive(7))
                .with("tiles", JsonArray(border))
        val record =
            AtomicReference(BattleMap(id = "map", name = "Комната", document = doc, revision = 1))
        val api =
            object : UnusedMapsApi() {
                override suspend fun get(id: String) = record.get()

                override suspend fun models() = listOf(model)

                override suspend fun modelBytes(url: String) = bytes

                override suspend fun patch(id: String, packet: MapPacket): MapChange {
                    val current = record.get()
                    assertEquals(current.revision, packet.baseVersion)
                    val next =
                        current
                            .withContent(mapApply(current.content, packet.patches))
                            .copy(revision = current.revision + 1)
                    record.set(next)
                    return MapChange(next.revision, patches = packet.patches)
                }
            }
        val folder = File(context.cacheDir, "map-placement-flow-${System.nanoTime()}")
        val images = ImageLoader.Builder(context).components { add(SvgDecoder.Factory()) }.build()
        try {
            ActivityScenario.launch(ComponentActivity::class.java).use { activity ->
                activity.onActivity { host ->
                    host.setContent {
                        DndTheme {
                            Surface(Modifier.fillMaxSize()) {
                                MapEditorScreen(
                                    "map",
                                    api,
                                    MapWorkspaceStore(folder),
                                    MapAssetCache(File(folder, "models"), api),
                                    images,
                                    layoutFormat(390f),
                                    close = {},
                                )
                            }
                        }
                    }
                }
                await { find { it.text?.toString() == "Комната" } != null }
                chooseModel()
                tapWorld(3.5, 3.5)
                await { record.get().document.rows("tiles").size == 17 }
                chooseModel()
                click("Заливка замкнутой области")
                tapWorld(2.5, 2.5)
                await { record.get().document.rows("tiles").size == 25 }
                assertEquals(
                    25,
                    record.get().document.rows("tiles").map { it.string("id") }.toSet().size,
                )
            }
        } finally {
            images.shutdown()
            folder.deleteRecursively()
        }
    }

    private fun chooseModel() {
        click("Плитки")
        click("Пробная плитка")
        await {
            find { it.contentDescription?.toString()?.startsWith("Поле карты. Готово") == true } !=
                null
        }
    }

    private fun tapWorld(x: Double, y: Double) {
        val canvas = awaitNode {
            it.contentDescription?.toString()?.startsWith("Поле карты. Готово") == true
        }
        val bounds = Rect()
        canvas.getBoundsInScreen(bounds)
        val camera = MapCamera().fit(7.0, 7.0, bounds.width(), bounds.height())
        val p = camera.project(MapPose(x, y, .44), bounds.width(), bounds.height())
        val down = SystemClock.uptimeMillis()
        for (action in listOf(MotionEvent.ACTION_DOWN, MotionEvent.ACTION_UP)) {
            val event =
                MotionEvent.obtain(
                        down,
                        SystemClock.uptimeMillis(),
                        action,
                        bounds.left + p.first,
                        bounds.top + p.second,
                        0,
                    )
                    .apply { source = InputDevice.SOURCE_TOUCHSCREEN }
            assertTrue(automation.injectInputEvent(event, true))
            event.recycle()
        }
    }

    private fun click(label: String) {
        var node: AccessibilityNodeInfo? = awaitNode {
            it.contentDescription?.toString() == label || it.text?.toString() == label
        }
        while (node != null && !node.isClickable) node = node.parent
        assertTrue(requireNotNull(node).performAction(AccessibilityNodeInfo.ACTION_CLICK), label)
    }

    private fun find(test: (AccessibilityNodeInfo) -> Boolean): AccessibilityNodeInfo? {
        if (android.os.Build.VERSION.SDK_INT >= 34) automation.clearCache()
        fun search(node: AccessibilityNodeInfo): AccessibilityNodeInfo? {
            if (test(node)) return node
            for (i in 0 until node.childCount) node.getChild(i)?.let {
                search(it)?.let {
                    return it
                }
            }
            return null
        }
        return automation.rootInActiveWindow?.let(::search)
    }

    private fun awaitNode(test: (AccessibilityNodeInfo) -> Boolean): AccessibilityNodeInfo {
        var node: AccessibilityNodeInfo? = null
        await {
            node = find(test)
            node != null
        }
        return requireNotNull(node)
    }

    private fun await(test: () -> Boolean) {
        val until = SystemClock.uptimeMillis() + 20_000
        while (SystemClock.uptimeMillis() < until) {
            if (test()) return
            Thread.sleep(50)
        }
        error("Placement UI did not reach its expected state")
    }
}
