package ru.dndshare.client

import android.graphics.Bitmap
import android.view.SurfaceView
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Suite
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.geometry.Vec3
import ru.dndshare.client.maps.rendering.*

@RunWith(Suite::class)
@Suite.SuiteClasses(
    MapRendererTest::class,
    MapTextureCodecTest::class,
    MapEffectsRendererTest::class,
)
class NativeMapEngineSuite

@androidx.test.filters.SdkSuppress(minSdkVersion = 31)
class MapEffectsRendererTest {
    @Test
    fun animatedSurfacesProjectedDecalsAndVolumeFogRenderAndRelease() {
        val test = InstrumentationRegistry.getInstrumentation()
        val context = test.targetContext
        val glb = test.context.assets.open("maps/box-water-custom.glb").use { it.readBytes() }
        val solidBytes = test.context.assets.open("maps/box.glb").use { it.readBytes() }
        val solid =
            MapModel(
                "solid",
                "solid",
                "Передний объект",
                renderUrl = "/api/maps/models/solid/render",
            )
        val api =
            object : UnusedMapsApi() {
                override suspend fun modelBytes(url: String) =
                    if (url.contains("/solid/")) solidBytes else glb

                override suspend fun mediaBytes(url: String) =
                    """<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="28" fill="#22ff66"/></svg>"""
                        .toByteArray()
            }
        val folder = File(context.cacheDir, "map-effects-${System.nanoTime()}")
        val model =
            MapModel(
                "water",
                "water",
                "Вода",
                renderUrl = "/api/maps/models/water/render",
                behaviour =
                    buildJsonObject {
                        put(
                            "waterAnimation",
                            buildJsonObject {
                                put("enabled", true)
                                put("speed", 1)
                                put("strength", 1)
                                put("pattern", "pool")
                                put("roughnessMax", .5)
                            },
                        )
                    },
            )
        var document =
            newMapDocument()
                .with("width", JsonPrimitive(4))
                .with("height", JsonPrimitive(4))
                .with("lightingEnabled", JsonPrimitive(true))
                .with(
                    "tiles",
                    JsonArray(
                        (1..2).map { x ->
                            buildJsonObject {
                                put("id", "tile-$x")
                                put("modelId", "water")
                                put("x", x)
                                put("y", 1)
                                put("rotation", 0)
                                put("level", 0)
                            }
                        }
                    ),
                )
        document =
            document.with(
                "tiles",
                JsonArray(
                    document.rows("tiles") +
                        buildJsonObject {
                            put("id", "foreground")
                            put("modelId", "solid")
                            put("x", 3)
                            put("y", 3)
                            put("rotation", 0)
                            put("level", 0)
                        }
                ),
            )
        val light =
            newMapLight("torch", MapPose(1.5, 1.5, 0.0))
                .with("areaId", JsonPrimitive("fog"))
                .with(
                    "effect",
                    buildJsonObject {
                        put("kind", "fire")
                        put("size", numbers(.3, .6))
                        put("offset", numbers(0.0, 0.0, -.175))
                        put("strength", .7)
                    },
                )
        val decal =
            newMapDecal(
                MapDecalImage("stamp", "Метка", "graffiti", "/images/maps/decals/rune.svg"),
                "tile",
                "tile-1",
                Vec3(0f, .5f, 0f),
                Vec3(0f, 1f, 0f),
            )
        document =
            document
                .with("lights", JsonArray(listOf(light)))
                .with("decals", JsonArray(listOf(decal)))
        val scene = AtomicReference<FilamentMapScene>()
        val failure = AtomicReference<String>()
        try {
            ActivityScenario.launch(ComponentActivity::class.java).use { activity ->
                activity.onActivity { host ->
                    host.setContent {
                        AndroidView(
                            modifier = Modifier.fillMaxSize(),
                            factory = { owner ->
                                SurfaceView(owner).also { view ->
                                    val renderer =
                                        FilamentMapScene(view, MapAssetCache(folder, api)) {
                                            _,
                                            error ->
                                            if (error != null) failure.set(error)
                                        }
                                    scene.set(renderer)
                                    renderer.options(MapSceneOptions(streamAssets = false))
                                    view.addOnLayoutChangeListener { _, l, t, r, b, _, _, _, _ ->
                                        renderer.camera(MapCamera().fit(4.0, 4.0, r - l, b - t))
                                    }
                                    renderer.update(document, listOf(model, solid))
                                }
                            },
                            onRelease = { scene.get().close() },
                        )
                    }
                }
                await(failure) {
                    scene.get()?.effectStatistics?.let {
                        it.waterModels == 1 &&
                            it.decals == 1 &&
                            it.flames == 1 &&
                            model.renderUrl in scene.get().readyModelUrls &&
                            solid.renderUrl in scene.get().readyModelUrls
                    } == true
                }
                val first = screenshot(activity, scene.get())
                var frames = scene.get().renderedFrames
                Thread.sleep(500)
                assertTrue(scene.get().renderedFrames > frames, "Native water/fire must animate")
                assertIdleOutsideViewport(scene.get())
                frames = scene.get().renderedFrames
                document =
                    document.with(
                        "lights",
                        JsonArray(listOf(light.with("enabled", JsonPrimitive(false)))),
                    )
                activity.onActivity {
                    scene.get().options(MapSceneOptions(animate = false, streamAssets = false))
                    scene.get().update(document, listOf(model, solid))
                }
                await(failure) { scene.get().renderedFrames > frames }
                first.recycle()
                activity.onActivity {
                    scene.get().options(MapSceneOptions(animate = true, streamAssets = false))
                }
                val movingStart = screenshot(activity, scene.get())
                Thread.sleep(400)
                val movingEnd = screenshot(activity, scene.get())
                val waterPoints =
                    listOf(2.0 to 1.0, 3.0 to 1.0, 3.0 to 2.0, 2.0 to 2.0).map { (x, y) ->
                        scene
                            .get()
                            .camera()
                            .project(MapPose(x, y, .5), movingStart.width, movingStart.height)
                    }
                var waterChanges = 0
                for (y in
                    waterPoints.minOf { it.second }.toInt()..waterPoints
                            .maxOf { it.second }
                            .toInt()) for (x in
                    waterPoints.minOf { it.first }.toInt()..waterPoints
                            .maxOf { it.first }
                            .toInt()) {
                    val before = movingStart.getPixel(x, y)
                    val after = movingEnd.getPixel(x, y)
                    if (
                        listOf(0, 8, 16).maxOf {
                            kotlin.math.abs(((before ushr it) and 255) - ((after ushr it) and 255))
                        } > 10
                    )
                        waterChanges++
                }
                movingStart.recycle()
                movingEnd.recycle()
                assertTrue(
                    waterChanges > 20,
                    "Water must change its pixels independently of fire: $waterChanges",
                )
                activity.onActivity {
                    scene.get().options(MapSceneOptions(animate = false, streamAssets = false))
                }
                val stationary = screenshot(activity, scene.get())
                document =
                    document.with(
                        "areas",
                        JsonArray(
                            listOf(
                                buildJsonObject {
                                    put("id", "fog")
                                    put("name", "Туман")
                                    put("color", "#a98aff")
                                    put("tileIds", JsonArray(listOf(JsonPrimitive("tile-1"))))
                                    put("objectIds", JsonArray(emptyList()))
                                    put("hidden", false)
                                    put("fog", true)
                                }
                            )
                        ),
                    )
                activity.onActivity { scene.get().update(document, listOf(model, solid)) }
                await(failure) {
                    scene.get().effectStatistics.fog && scene.get().effectStatistics.flames == 0
                }
                val fogged = screenshot(activity, scene.get())
                val foreground =
                    scene
                        .get()
                        .camera()
                        .project(MapPose(3.5, 3.5, .5), stationary.width, stationary.height)
                val px = foreground.first.toInt()
                val py = foreground.second.toInt()
                val beforePixel = stationary.getPixel(px, py)
                val afterPixel = fogged.getPixel(px, py)
                var changes = 0
                for (y in 0 until stationary.height step 4) for (x in
                    0 until stationary.width step 4) if (
                    stationary.getPixel(x, y) != fogged.getPixel(x, y)
                )
                    changes++
                val output =
                    File(context.getExternalFilesDir(null), "map-effects").apply { mkdirs() }
                File(output, "before.png").outputStream().use {
                    stationary.compress(Bitmap.CompressFormat.PNG, 100, it)
                }
                File(output, "fog.png").outputStream().use {
                    fogged.compress(Bitmap.CompressFormat.PNG, 100, it)
                }
                export(output, listOf("before.png", "fog.png"))
                for (shift in listOf(0, 8, 16)) assertTrue(
                    kotlin.math.abs(
                        ((beforePixel ushr shift) and 255) - ((afterPixel ushr shift) and 255)
                    ) <= 5,
                    "Fog must preserve foreground geometry: $beforePixel / $afterPixel",
                )
                fun redBounds(image: Bitmap): List<Int> {
                    val xs = mutableListOf<Int>()
                    val ys = mutableListOf<Int>()
                    val corners =
                        listOf(3.0, 4.0).flatMap { x ->
                            listOf(3.0, 4.0).flatMap { y ->
                                listOf(-.5, .5).map { z ->
                                    scene
                                        .get()
                                        .camera()
                                        .project(MapPose(x, y, z), image.width, image.height)
                                }
                            }
                        }
                    val minX = (corners.minOf { it.first }.toInt() - 1).coerceAtLeast(0)
                    val maxX =
                        (corners.maxOf { it.first }.toInt() + 1).coerceAtMost(image.width - 1)
                    val minY = (corners.minOf { it.second }.toInt() - 1).coerceAtLeast(0)
                    val maxY =
                        (corners.maxOf { it.second }.toInt() + 1).coerceAtMost(image.height - 1)
                    for (y in minY..maxY) for (x in minX..maxX) {
                        val c = image.getPixel(x, y)
                        if (
                            android.graphics.Color.red(c) > 40 &&
                                android.graphics.Color.green(c) < 4 &&
                                android.graphics.Color.blue(c) < 4
                        ) {
                            xs += x
                            ys += y
                        }
                    }
                    return listOf(xs.min(), ys.min(), xs.max(), ys.max())
                }
                val beforeBounds = redBounds(stationary)
                val afterBounds = redBounds(fogged)
                beforeBounds.indices.forEach {
                    assertTrue(
                        kotlin.math.abs(beforeBounds[it] - afterBounds[it]) <= 1,
                        "Fog must keep the same viewport: $beforeBounds / $afterBounds",
                    )
                }
                assertTrue(
                    changes > 100,
                    "Volume compositing must change real GPU pixels: $changes",
                )
                stationary.recycle()
                fogged.recycle()
                scene.get().options(MapSceneOptions(animate = true, streamAssets = false))
                assertIdleOutsideViewport(scene.get())
                activity.onActivity { scene.get().foreground(false) }
                Thread.sleep(200)
                frames = scene.get().renderedFrames
                Thread.sleep(300)
                assertEquals(frames, scene.get().renderedFrames, "Effects must stop in background")
                assertNull(failure.get())
            }
        } finally {
            folder.deleteRecursively()
        }
    }

    private fun assertIdleOutsideViewport(scene: FilamentMapScene) {
        val camera = scene.camera()
        scene.camera(camera.copy(x = 10000.0, y = 10000.0))
        Thread.sleep(400)
        val idle = scene.renderedFrames
        Thread.sleep(500)
        assertEquals(
            idle,
            scene.renderedFrames,
            "Offscreen water, fire and fog must not request frames even with streamAssets=false",
        )
        scene.camera(camera)
        Thread.sleep(300)
        val resumed = scene.renderedFrames
        Thread.sleep(300)
        assertTrue(
            scene.renderedFrames > resumed,
            "Returning the camera must resume visible effects",
        )
    }

    private fun export(output: File, names: List<String>) {
        val automation = InstrumentationRegistry.getInstrumentation().uiAutomation
        val destination = "/sdcard/Download/dndshare-map-effects"
        automation.executeShellCommand("mkdir -p $destination").use { descriptor ->
            android.os.ParcelFileDescriptor.AutoCloseInputStream(descriptor).use {
                it.readBytes()
            }
        }
        for (name in names) {
            val pipes = automation.executeShellCommandRw("sh -c cat>$destination/$name")
            android.os.ParcelFileDescriptor.AutoCloseOutputStream(pipes[1]).use {
                it.write(File(output, name).readBytes())
            }
            android.os.ParcelFileDescriptor.AutoCloseInputStream(pipes[0]).use {
                it.readBytes()
            }
            val count =
                automation.executeShellCommand("wc -c $destination/$name").use { descriptor ->
                    android.os.ParcelFileDescriptor.AutoCloseInputStream(descriptor).use {
                        it.readBytes().toString(Charsets.UTF_8)
                    }
                }
            assertEquals(
                File(output, name).length(),
                count.trim().substringBefore(' ').toLong(),
            )
        }
    }

    private fun await(failure: AtomicReference<String>, condition: () -> Boolean) {
        val deadline = System.currentTimeMillis() + 60_000
        while (System.currentTimeMillis() < deadline) {
            assertNull(failure.get())
            if (condition()) return
            Thread.sleep(50)
        }
        error("GPU effect did not reach expected state")
    }

    private fun screenshot(
        activity: ActivityScenario<ComponentActivity>,
        scene: FilamentMapScene,
    ): Bitmap {
        val done = CountDownLatch(1)
        val result = AtomicReference<Result<Bitmap>>()
        activity.onActivity {
            scene.snapshot {
                result.set(it)
                done.countDown()
            }
        }
        assertTrue(done.await(15, TimeUnit.SECONDS))
        return result.get().getOrThrow()
    }
}
