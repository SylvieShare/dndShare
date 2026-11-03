package ru.dndshare.client

import android.os.Bundle
import android.os.ParcelFileDescriptor
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
import java.io.IOException
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.MapAssetCache
import ru.dndshare.client.ui.DndTheme
import ru.dndshare.client.ui.designsystem.WebPalette
import ru.dndshare.client.ui.layoutFormat
import ru.dndshare.client.ui.maps.MapEditorScreen

@androidx.test.filters.SdkSuppress(minSdkVersion = 29)
class MapEditorWindowTest {
    @Test
    fun recreationKeepsTheLastFormInputWhileItsWriteIsPending() {
        val context = instrumentation.targetContext
        val root = File(context.cacheDir, "map-recreate-${System.nanoTime()}")
        val images = ImageLoader.Builder(context).build()
        val api =
            object : UnusedMapsApi() {
                override suspend fun get(id: String) =
                    BattleMap(id = id, name = "Изначальная", revision = 1)

                override suspend fun patch(id: String, packet: MapPacket): MapChange =
                    throw IOException("offline")
            }
        fun install(activity: ActivityScenario<ComponentActivity>) {
            activity.onActivity { host ->
                host.setContent {
                    DndTheme {
                        Surface(Modifier.fillMaxSize(), color = WebPalette.Background) {
                            MapEditorScreen(
                                "map",
                                api,
                                MapWorkspaceStore(root),
                                MapAssetCache(File(root, "models"), api),
                                images,
                                layoutFormat(390f),
                                close = {},
                            )
                        }
                    }
                }
            }
        }
        try {
            ActivityScenario.launch(ComponentActivity::class.java).use { activity ->
                install(activity)
                await { find { it.text?.toString() == "Изначальная" } != null }
                click("Настройки")
                val field = awaitNode { it.isEditable && it.text?.toString() == "Изначальная" }
                assertTrue(
                    field.performAction(
                        AccessibilityNodeInfo.ACTION_SET_TEXT,
                        Bundle().apply {
                            putCharSequence(
                                AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                                "Перед раскрытием",
                            )
                        },
                    )
                )
                activity.recreate()
                install(activity)
                await { find { it.text?.toString() == "Перед раскрытием" } != null }
                val saved =
                    kotlinx.coroutines.runBlocking { MapWorkspaceStore(root).readWork("map") }
                assertEquals("Перед раскрытием", saved?.current?.name)
            }
        } finally {
            images.shutdown()
            root.deleteRecursively()
        }
    }

    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val automation
        get() = instrumentation.uiAutomation

    @Test
    fun failedOpeningEndsTheSkeletonAndCanBeRetried() {
        val context = instrumentation.targetContext
        val root = File(context.cacheDir, "map-retry-${System.nanoTime()}")
        val images = ImageLoader.Builder(context).build()
        var attempts = 0
        val api =
            object : UnusedMapsApi() {
                override suspend fun get(id: String): BattleMap {
                    if (attempts++ == 0) throw IOException("Нет связи")
                    return BattleMap(id = id, name = "После повтора", revision = 1)
                }
            }
        try {
            ActivityScenario.launch(ComponentActivity::class.java).use { activity ->
                activity.onActivity { host ->
                    host.setContent {
                        DndTheme {
                            Surface(Modifier.fillMaxSize(), color = WebPalette.Background) {
                                MapEditorScreen(
                                    "retry",
                                    api,
                                    MapWorkspaceStore(root),
                                    MapAssetCache(File(root, "models"), api),
                                    images,
                                    layoutFormat(390f),
                                    close = {},
                                )
                            }
                        }
                    }
                }
                await { find { it.text?.toString() == "Не удалось открыть карту" } != null }
                click("Повторить загрузку")
                await { find { it.text?.toString() == "После повтора" } != null }
                assertNull(find { it.text?.toString() == "Не удалось открыть карту" })
                assertEquals(2, attempts)
            }
        } finally {
            images.shutdown()
            root.deleteRecursively()
        }
    }

    @Test
    fun editorFitsThreeWindowsAndFormEditsReachTheMapApi() =
        editorWindows(listOf(390 to 844, 834 to 1112, 1920 to 1080))

    private fun editorWindows(windows: List<Pair<Int, Int>>) {
        val beforeSize = shell("wm size")
        val beforeDensity = shell("wm density")
        val context = instrumentation.targetContext
        val folder = File(context.cacheDir, "map-windows-${System.nanoTime()}")
        val bytes = instrumentation.context.assets.open("maps/box.glb").use { it.readBytes() }
        val images = ImageLoader.Builder(context).components { add(SvgDecoder.Factory()) }.build()
        val pictures = File(context.getExternalFilesDir(null), "map-review").apply { mkdirs() }
        try {
            shell("wm density 160")
            shell("mkdir -p /data/local/tmp/dndshare-map-review")
            for ((width, height) in windows) {
                shell("wm size ${width}x$height")
                val record =
                    AtomicReference(BattleMap(id = "map", name = "Пробная карта", revision = 1))
                val closed = AtomicBoolean(false)
                val api =
                    object : UnusedMapsApi() {
                        override suspend fun get(id: String) = record.get()

                        override suspend fun models() =
                            listOf(
                                MapModel(
                                    "box",
                                    "box",
                                    "Плитка",
                                    collection = "Тестовый набор",
                                    category = "floor",
                                    tileType = "floor",
                                    renderUrl = "/api/maps/models/box/render",
                                )
                            )

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
                val store = MapWorkspaceStore(File(folder, "draft-$width"))
                ActivityScenario.launch(ComponentActivity::class.java).use { activity ->
                    activity.onActivity { host ->
                        host.setContent {
                            DndTheme {
                                Surface(Modifier.fillMaxSize(), color = WebPalette.Background) {
                                    MapEditorScreen(
                                        "map",
                                        api,
                                        store,
                                        MapAssetCache(File(folder, "models"), api),
                                        images,
                                        layoutFormat(width.toFloat()),
                                        close = { closed.set(true) },
                                    )
                                }
                            }
                        }
                    }
                    await { find { it.text?.toString() == "Пробная карта" } != null }
                    await {
                        find {
                            it.contentDescription?.toString()?.startsWith("Поле карты. Готово") ==
                                true
                        } != null
                    }
                    automation.waitForIdle(100, 5000)
                    val committed = CountDownLatch(2)
                    activity.onActivity { host ->
                        val root = host.window.decorView
                        fun commit() {
                            root.viewTreeObserver.registerFrameCommitCallback {
                                committed.countDown()
                                if (committed.count > 0)
                                    root.postOnAnimation {
                                        commit()
                                        root.invalidate()
                                    }
                            }
                            root.invalidate()
                        }
                        root.postOnAnimation { commit() }
                    }
                    assertTrue(committed.await(5, TimeUnit.SECONDS))
                    val image = requireNotNull(automation.takeScreenshot())
                    val destination = File(pictures, "android-map-$width.png")
                    destination.outputStream().use {
                        image.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it)
                    }
                    shell(
                        "cp ${destination.absolutePath} /data/local/tmp/dndshare-map-review/android-map-$width.png"
                    )
                    image.recycle()
                    click("Настройки")
                    val editable = awaitNode {
                        it.isEditable && it.text?.toString()?.contains("Пробная карта") == true
                    }
                    assertTrue(
                        editable.performAction(
                            AccessibilityNodeInfo.ACTION_SET_TEXT,
                            Bundle().apply {
                                putCharSequence(
                                    AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                                    "Карта $width",
                                )
                            },
                        )
                    )
                    await { record.get().name == "Карта $width" }
                    val back = awaitNode { it.contentDescription?.toString() == "К картам" }
                    assertTrue(back.performAction(AccessibilityNodeInfo.ACTION_CLICK))
                    await { closed.get() }
                }
            }
        } finally {
            restore("size", beforeSize, "Override size: ")
            restore("density", beforeDensity, "Override density: ")
            images.shutdown()
            folder.deleteRecursively()
        }
    }

    private fun restore(kind: String, value: String, prefix: String) {
        val override =
            value.lineSequence().firstOrNull { it.startsWith(prefix) }?.removePrefix(prefix)?.trim()
        shell("wm $kind ${override ?: "reset"}")
    }

    private fun shell(command: String): String =
        ParcelFileDescriptor.AutoCloseInputStream(automation.executeShellCommand(command))
            .bufferedReader()
            .use { it.readText() }

    private fun click(text: String) {
        var node: AccessibilityNodeInfo? = awaitNode {
            (it.contentDescription?.toString() == text && it.isClickable) ||
                it.text?.toString() == text
        }
        while (node != null && !node.isClickable) node = node.parent
        assertTrue(requireNotNull(node).performAction(AccessibilityNodeInfo.ACTION_CLICK))
    }

    private fun find(test: (AccessibilityNodeInfo) -> Boolean): AccessibilityNodeInfo? {
        if (android.os.Build.VERSION.SDK_INT >= 34) automation.clearCache()
        fun search(node: AccessibilityNodeInfo): AccessibilityNodeInfo? {
            if (test(node)) return node
            for (i in 0 until node.childCount) node.getChild(i)?.let {
                search(it)?.let { found ->
                    return found
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
        val until = System.currentTimeMillis() + 15_000
        while (System.currentTimeMillis() < until) {
            if (test()) return
            Thread.sleep(50)
        }
        error("Map editor did not reach the expected UI state")
    }
}
