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
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import kotlin.test.*
import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.*
import ru.dndshare.client.model.WireJson
import ru.dndshare.client.ui.DndTheme
import ru.dndshare.client.ui.designsystem.WebPalette
import ru.dndshare.client.ui.layoutFormat
import ru.dndshare.client.ui.maps.MapEditorScreen

class MapLoadingFlowTest {
    private val test = InstrumentationRegistry.getInstrumentation()
    private val automation
        get() = test.uiAutomation

    @Test
    fun editingRemainsAvailableDuringRetryAndClosedErrorsStayClosedUntilRecoveryInThreeWindows() =
        runBlocking<Unit> {
            val size = shell("wm size")
            val density = shell("wm density")
            val context = test.targetContext
            val root = File(context.cacheDir, "loading-flow-${System.nanoTime()}")
            val fixture =
                WireJson.parseToJsonElement(
                        test.context.assets.open("maps/editor-review.json").bufferedReader().use {
                            it.readText()
                        }
                    )
                    .jsonObject
            val template =
                WireJson.decodeFromJsonElement(BattleMap.serializer(), fixture.getValue("map"))
            val models =
                fixture.rows("models").map(::decodeMapModel).map {
                    it.copy(
                        renderUrl = "${it.renderUrl}?signature=do-not-display",
                        lodUrl = "${it.lodUrl}?signature=do-not-display",
                    )
                }
            val bytes = test.context.assets.open("maps/review-tile.glb").use { it.readBytes() }
            val images =
                ImageLoader.Builder(context).components { add(SvgDecoder.Factory()) }.build()
            try {
                shell("wm density 160")
                for ((width, height) in listOf(390 to 844, 834 to 1112, 1920 to 1080)) {
                    shell("wm size ${width}x$height")
                    val record = AtomicReference(template)
                    val attempts = ConcurrentHashMap<String, AtomicInteger>()
                    val gate = CompletableDeferred<ByteArray>()
                    val loading = CompletableDeferred<Unit>()
                    val api =
                        object : UnusedMapsApi() {
                            override suspend fun get(id: String) = record.get()

                            override suspend fun models() = models

                            override suspend fun modelBytes(url: String) =
                                modelBytes(url) { _, _ -> }

                            override suspend fun modelBytes(
                                url: String,
                                progress: (Long, Long?) -> Unit,
                            ): ByteArray {
                                if (url.contains("22222222-2222")) {
                                    val count =
                                        attempts
                                            .computeIfAbsent(url) { AtomicInteger() }
                                            .incrementAndGet()
                                    if (count <= 2) throw IOException("GLB: соединение прервалось")
                                    loading.complete(Unit)
                                    progress(bytes.size / 2L, bytes.size.toLong())
                                    return gate.await().also {
                                        progress(it.size.toLong(), it.size.toLong())
                                    }
                                }
                                return bytes.also { progress(it.size.toLong(), it.size.toLong()) }
                            }

                            override suspend fun patch(id: String, packet: MapPacket): MapChange {
                                val old = record.get()
                                assertEquals(old.revision, packet.baseVersion)
                                val next =
                                    old.withContent(mapApply(old.content, packet.patches))
                                        .copy(revision = old.revision + 1)
                                record.set(next)
                                return MapChange(next.revision, patches = packet.patches)
                            }
                        }
                    val folder = File(root, "$width")
                    ActivityScenario.launch(ComponentActivity::class.java).use { activity ->
                        activity.onActivity { host ->
                            host.setContent {
                                DndTheme {
                                    Surface(Modifier.fillMaxSize(), color = WebPalette.Background) {
                                        MapEditorScreen(
                                            template.id,
                                            api,
                                            MapWorkspaceStore(File(folder, "draft")),
                                            MapAssetCache(File(folder, "assets"), api),
                                            images,
                                            layoutFormat(width.toFloat()),
                                            close = {},
                                        )
                                    }
                                }
                            }
                        }
                        await { find { it.text?.toString() == "Проблемы загрузки карты" } != null }
                        assertNull(find { it.text?.toString()?.contains("do-not-display") == true })
                        if (width >= 1200) {
                            await {
                                find { it.text?.toString() == "Ресурс: Основная модель" } != null &&
                                    find { it.text?.toString() == "Ресурс: LOD" } != null
                            }
                        }
                        click("Закрыть")
                        withTimeout(12_000) { loading.await() }
                        await { attempts.isNotEmpty() && attempts.values.all { it.get() >= 3 } }
                        delay(200)
                        assertNull(find { it.text?.toString() == "Проблемы загрузки карты" })
                        click("Настройки")
                        val name = awaitNode {
                            it.isEditable && it.text?.toString() == template.name
                        }
                        assertTrue(
                            name.performAction(
                                AccessibilityNodeInfo.ACTION_SET_TEXT,
                                Bundle().apply {
                                    putCharSequence(
                                        AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                                        "Редактирование во время загрузки",
                                    )
                                },
                            )
                        )
                        await { record.get().name == "Редактирование во время загрузки" }
                        assertNull(find { it.text?.toString() == "Проблемы загрузки карты" })
                        click("Свернуть панель")
                        await {
                            find {
                                it.isEditable &&
                                    it.text?.toString()?.startsWith("Редактирование во время") ==
                                        true
                            } == null
                        }
                        automation.waitForIdle(100, 5000)
                        automation.takeScreenshot()?.let {
                            exportMapTestImage("android-downloads-$width.png", it)
                            it.recycle()
                        }
                        gate.complete(bytes)
                        await {
                            find { it.contentDescription?.toString() == "Загрузка моделей" } == null
                        }
                        assertEquals(48, record.get().document.rows("tiles").size)
                        assertEquals(1, record.get().document.rows("objects").size)
                    }
                }
            } finally {
                fun restore(kind: String, before: String) {
                    val value =
                        before
                            .lineSequence()
                            .firstOrNull { it.startsWith("Override") }
                            ?.substringAfter(':')
                            ?.trim()
                    shell("wm $kind ${value ?: "reset"}")
                }
                restore("size", size)
                restore("density", density)
                images.shutdown()
                root.deleteRecursively()
            }
        }

    private fun shell(command: String) =
        ParcelFileDescriptor.AutoCloseInputStream(automation.executeShellCommand(command))
            .bufferedReader()
            .use { it.readText() }

    private fun click(label: String) {
        var node: AccessibilityNodeInfo? = awaitNode {
            it.text?.toString() == label || it.contentDescription?.toString() == label
        }
        while (node != null && !node.isClickable) node = node.parent
        assertTrue(requireNotNull(node).performAction(AccessibilityNodeInfo.ACTION_CLICK), label)
    }

    private fun awaitNode(predicate: (AccessibilityNodeInfo) -> Boolean): AccessibilityNodeInfo {
        var node: AccessibilityNodeInfo? = null
        await {
            node = find(predicate)
            node != null
        }
        return requireNotNull(node)
    }

    private fun find(predicate: (AccessibilityNodeInfo) -> Boolean): AccessibilityNodeInfo? {
        if (android.os.Build.VERSION.SDK_INT >= 34) automation.clearCache()
        fun visit(node: AccessibilityNodeInfo): AccessibilityNodeInfo? {
            if (predicate(node)) return node
            for (i in 0 until node.childCount) node.getChild(i)?.let {
                visit(it)?.let {
                    return it
                }
            }
            return null
        }
        return automation.rootInActiveWindow?.let(::visit)
    }

    private fun await(predicate: () -> Boolean) {
        val until = System.currentTimeMillis() + 20_000
        while (System.currentTimeMillis() < until) {
            if (predicate()) return
            Thread.sleep(40)
        }
        automation.takeScreenshot()?.let {
            exportMapTestImage("loading-flow-failure.png", it)
            it.recycle()
        }
        error("Loading UI did not reach expected state")
    }
}
