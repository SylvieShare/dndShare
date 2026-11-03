package ru.dndshare.client

import android.os.ParcelFileDescriptor
import android.view.accessibility.AccessibilityNodeInfo
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import coil3.ImageLoader
import coil3.svg.SvgDecoder
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import kotlin.test.*
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.*
import ru.dndshare.client.model.WireJson
import ru.dndshare.client.ui.DndTheme
import ru.dndshare.client.ui.designsystem.WebPalette
import ru.dndshare.client.ui.maps.MapLibraryScreen

class MapLibraryWindowTest {
    private val test = InstrumentationRegistry.getInstrumentation()
    private val automation
        get() = test.uiAutomation

    @Test
    fun libraryShowsSharedSceneAndCompletesScopeSubscriptionCopyAndDeleteInThreeWindows() =
        runBlocking<Unit> {
            val size = shell("wm size")
            val density = shell("wm density")
            val context = test.targetContext
            val root =
                File(context.cacheDir, "library-review-${System.nanoTime()}").apply { mkdirs() }
            val fixture =
                WireJson.parseToJsonElement(
                        test.context.assets.open("maps/editor-review.json").bufferedReader().use {
                            it.readText()
                        }
                    )
                    .jsonObject
            val template =
                WireJson.decodeFromJsonElement(BattleMap.serializer(), fixture.getValue("map"))
            val models = fixture.rows("models").map(::decodeMapModel)
            val bytes = test.context.assets.open("maps/review-tile.glb").use { it.readBytes() }
            val network =
                object : UnusedMapsApi() {
                    override suspend fun modelBytes(url: String) = bytes
                }
            val cache = MapAssetCache(File(root, "assets"), network)
            val snapshots = MapSnapshotQueue(context, cache)
            val images =
                ImageLoader.Builder(context).components { add(SvgDecoder.Factory()) }.build()
            try {
                val image = snapshots.snapshot(template.document, models)
                val picture = File(root, "preview.png")
                picture.outputStream().use {
                    image.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it)
                }
                shell("wm density 160")
                for ((width, height) in listOf(390 to 844, 834 to 1112, 1920 to 1080)) {
                    shell("wm size ${width}x$height")
                    val owned =
                        template.copy(
                            author = "tester",
                            width = 12.0,
                            height = 10.0,
                            tileCount = 48,
                            objectCount = 1,
                            tags = listOf("подземелье", "камень"),
                            previewUrl = picture.toURI().toString(),
                        )
                    val published =
                        owned.copy(
                            id = "published",
                            name = "Зал алхимика",
                            owned = false,
                            publishedAt = "2026-10-01T12:00:00Z",
                            rating = 4.0,
                            ratingCount = 2,
                        )
                    val subscribed = AtomicBoolean(false)
                    val deleted = AtomicBoolean(false)
                    val copied = AtomicReference<String>()
                    val api =
                        object : UnusedMapsApi() {
                            override suspend fun list(scope: String) =
                                when (scope) {
                                    "own" -> if (deleted.get()) emptyList() else listOf(owned)
                                    "subscriptions" ->
                                        if (subscribed.get())
                                            listOf(published.copy(subscribed = true))
                                        else emptyList()
                                    else -> listOf(published.copy(subscribed = subscribed.get()))
                                }

                            override suspend fun get(id: String) =
                                if (id == owned.id) owned
                                else published.copy(subscribed = subscribed.get())

                            override suspend fun subscribe(id: String, enabled: Boolean) {
                                subscribed.set(enabled)
                            }

                            override suspend fun copy(id: String) = owned.copy(id = "copy")

                            override suspend fun delete(id: String) {
                                deleted.set(true)
                            }
                        }
                    ActivityScenario.launch(ComponentActivity::class.java).use { activity ->
                        activity.onActivity { host ->
                            host.setContent {
                                DndTheme {
                                    Surface(Modifier.fillMaxSize(), color = WebPalette.Background) {
                                        MapLibraryScreen(
                                            api,
                                            MapWorkspaceStore(File(root, "draft-$width")),
                                            images,
                                            WindowInsets.safeDrawing.asPaddingValues(),
                                            { copied.set(it) },
                                            cache,
                                            MapStoredPreviews(api, snapshots),
                                        )
                                    }
                                }
                            }
                        }
                        await { find { it.text?.toString() == owned.name } != null }
                        automation.waitForIdle(100, 5000)
                        automation.takeScreenshot()?.let {
                            exportMapTestImage("android-library-$width.png", it)
                            it.recycle()
                        }
                        click("Подписки")
                        await { find { it.text?.toString() == "Пока нет подписок" } != null }
                        click("Каталог")
                        await { find { it.text?.toString() == "Зал алхимика" } != null }
                        click("Подписаться")
                        await { subscribed.get() }
                        click("Подписки")
                        await { find { it.text?.toString() == "Зал алхимика" } != null }
                        click("Мои")
                        await { find { it.text?.toString() == owned.name } != null }
                        click("Создать копию карты")
                        await { copied.get() == "copy" }
                        click("Удалить карту")
                        click("Удалить")
                        await { deleted.get() }
                        await { find { it.text?.toString() == "Своих карт пока нет" } != null }
                    }
                }
            } finally {
                fun restore(kind: String, before: String) {
                    val value =
                        before
                            .lineSequence()
                            .firstOrNull { it.startsWith("Override") }
                            ?.substringAfter(":")
                            ?.trim()
                    shell("wm $kind ${value ?: "reset"}")
                }
                restore("size", size)
                restore("density", density)
                images.shutdown()
                snapshots.close()
                root.deleteRecursively()
            }
        }

    private fun shell(command: String) =
        ParcelFileDescriptor.AutoCloseInputStream(automation.executeShellCommand(command))
            .bufferedReader()
            .use { it.readText() }

    private fun click(label: String) {
        var node: AccessibilityNodeInfo? = null
        await {
            node = find {
                it.text?.toString() == label || it.contentDescription?.toString() == label
            }
            node != null
        }
        while (node != null && !node!!.isClickable) node = node!!.parent
        assertTrue(requireNotNull(node).performAction(AccessibilityNodeInfo.ACTION_CLICK), label)
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
        val deadline = System.currentTimeMillis() + 20_000
        while (System.currentTimeMillis() < deadline) {
            if (predicate()) return
            Thread.sleep(40)
        }
        error("Library did not reach expected state")
    }
}
