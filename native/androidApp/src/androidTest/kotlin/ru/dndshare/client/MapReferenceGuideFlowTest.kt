package ru.dndshare.client

import android.os.Bundle
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
import ru.dndshare.client.ui.LayoutFormat
import ru.dndshare.client.ui.designsystem.WebPalette
import ru.dndshare.client.ui.maps.MapEditorScreen

class MapReferenceGuideFlowTest {
    private val test = InstrumentationRegistry.getInstrumentation()
    private val automation = test.uiAutomation

    @Test
    fun adminCanUseGuidesAndCannotSaveAnIncompleteNumber() {
        val context = test.targetContext
        val folder = File(context.cacheDir, "map-reference-guides-${System.nanoTime()}")
        val bytes = test.context.assets.open("maps/box.glb").use { it.readBytes() }
        val saved = AtomicReference<JsonObject>()
        val model =
            MapModel(
                "model",
                "model",
                "Пробная модель",
                collection = "test",
                collectionName = "Тест",
                tileType = "floor",
                category = "floor",
                canStand = true,
                mountDepth = .1,
                mountProfile = "stand",
                surfaceHeight = .5,
                maxHeight = 1.0,
                renderUrl = "/api/maps/models/model/render",
                supportSlots =
                    JsonArray(
                        listOf(
                            buildJsonObject {
                                put("x", 0)
                                put("y", 0)
                                put("width", 1)
                                put("height", 1)
                                put("elevation", .5)
                            }
                        )
                    ),
                placementPoints =
                    JsonArray(
                        listOf(
                            buildJsonObject {
                                put("x", .5)
                                put("y", .5)
                                put("elevation", .5)
                            }
                        )
                    ),
                raw =
                    buildJsonObject {
                        put("wallMode", "edge")
                        put("wallMask", 1)
                    },
            )
        val api =
            object : UnusedMapsApi() {
                override suspend fun get(id: String) =
                    BattleMap(id = "map", name = "Проверка направляющих", revision = 1)

                override suspend fun models() = listOf(model)

                override suspend fun modelBytes(url: String) = bytes

                override suspend fun updateModel(
                    original: MapModel,
                    payload: JsonObject,
                ): MapModel {
                    saved.set(payload)
                    return decodeMapModel(
                        JsonObject(
                            editableMapModel(original) +
                                payload +
                                mapOf("renderUrl" to JsonPrimitive(original.renderUrl))
                        )
                    )
                }
            }
        val images = ImageLoader.Builder(context).components { add(SvgDecoder.Factory()) }.build()
        try {
            ActivityScenario.launch(ComponentActivity::class.java).use { activity ->
                activity.onActivity { host ->
                    host.setContent {
                        DndTheme {
                            Surface(Modifier.fillMaxSize(), color = WebPalette.Background) {
                                MapEditorScreen(
                                    "map",
                                    api,
                                    MapWorkspaceStore(File(folder, "work")),
                                    MapAssetCache(File(folder, "models"), api),
                                    images,
                                    LayoutFormat.Phone,
                                    close = {},
                                    admin = true,
                                )
                            }
                        }
                    }
                }
                click("Справочник моделей")
                click("Пробная модель")
                await { find { it.text?.toString() == "Основание" } != null }
                await {
                    find {
                        it.contentDescription?.toString()?.startsWith("Поле карты. Готово") == true
                    } != null
                }
                click("Вписать превью")
                click("Основание")
                automation.takeScreenshot()?.let {
                    exportMapTestImage("reference-guides-flow.png", it)
                    it.recycle()
                }
                reveal { it.contentDescription?.toString() == "Выбрать паз 1 в превью" }
                click("Выбрать паз 1 в превью")
                click("Стык: Север")
                val number = editable("Глубина монтажного основания")
                number.performAction(
                    AccessibilityNodeInfo.ACTION_SET_TEXT,
                    Bundle().apply {
                        putCharSequence(
                            AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                            "-",
                        )
                    },
                )
                click("Сохранить")
                await {
                    find { it.text?.toString()?.contains("Проверьте числовые поля") == true } !=
                        null
                }
                assertNull(saved.get())
                val valid = editable("Глубина монтажного основания")
                valid.performAction(
                    AccessibilityNodeInfo.ACTION_SET_TEXT,
                    Bundle().apply {
                        putCharSequence(
                            AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                            "0",
                        )
                    },
                )
                click("Сохранить")
                await { saved.get() != null }
                assertEquals(0.0, saved.get().number("mountDepth"))
                assertEquals("", saved.get().string("mountProfile"))
                assertEquals(0.0, saved.get().number("wallMask"))
            }
        } finally {
            images.shutdown()
            folder.deleteRecursively()
        }
    }

    private fun editable(label: String): AccessibilityNodeInfo {
        var node: AccessibilityNodeInfo? = reveal { it.contentDescription?.toString() == label }
        while (node != null && !node.isEditable) node = node.parent
        return requireNotNull(node) { "Editable owner not found: $label" }
    }

    private fun reveal(predicate: (AccessibilityNodeInfo) -> Boolean): AccessibilityNodeInfo {
        for (action in
            listOf(
                AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD,
                AccessibilityNodeInfo.ACTION_SCROLL_FORWARD,
            )) {
            repeat(14) {
                find(predicate)
                    ?.takeIf { node -> node.isVisibleToUser }
                    ?.let {
                        return it
                    }
                val scroll =
                    find { it.isScrollable } ?: error("Reference form has no scrolling container")
                scroll.performAction(action)
                automation.waitForIdle(50, 1500)
            }
        }
        automation.takeScreenshot()?.let {
            exportMapTestImage("reference-guide-failure.png", it)
            it.recycle()
        }
        val entries = mutableListOf<String>()
        fun describe(node: AccessibilityNodeInfo) {
            if (node.text != null || node.contentDescription != null)
                entries +=
                    "${node.className} e=${node.isEditable} s=${node.isScrollable} d=${node.contentDescription} t=${node.text}"
            for (i in 0 until node.childCount) node.getChild(i)?.let(::describe)
        }
        automation.rootInActiveWindow?.let(::describe)
        error("Reference field did not become visible: ${entries.takeLast(35)}")
    }

    private fun click(label: String) {
        var node: AccessibilityNodeInfo? = null
        await {
            node = find {
                it.contentDescription?.toString() == label || it.text?.toString() == label
            }
            node != null
        }
        while (node != null && !node!!.isClickable) node = node!!.parent
        assertTrue(requireNotNull(node).performAction(AccessibilityNodeInfo.ACTION_CLICK), label)
    }

    private fun find(predicate: (AccessibilityNodeInfo) -> Boolean): AccessibilityNodeInfo? {
        if (android.os.Build.VERSION.SDK_INT >= 34) automation.clearCache()
        fun search(node: AccessibilityNodeInfo): AccessibilityNodeInfo? {
            if (predicate(node)) return node
            for (i in 0 until node.childCount) node.getChild(i)?.let {
                search(it)?.let {
                    return it
                }
            }
            return null
        }
        return automation.rootInActiveWindow?.let(::search)
    }

    private fun await(condition: () -> Boolean) {
        val until = System.currentTimeMillis() + 15000
        while (System.currentTimeMillis() < until) {
            if (condition()) return
            Thread.sleep(50)
        }
        error("Reference UI did not reach the expected state")
    }
}
