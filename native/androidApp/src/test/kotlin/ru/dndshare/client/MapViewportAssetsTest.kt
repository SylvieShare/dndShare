package ru.dndshare.client

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.*

class MapViewportAssetsTest {
    private val model = MapModel("floor", "floor", "Пол", maxHeight = 1.0)

    private fun entry(x: Double, y: Double) =
        MapSceneEntry(
            MapEntityRef(MapEntityKind.Tile, "$x:$y"),
            model,
            mapTransform(x, y, 0.0, 0.0),
        )

    @Test
    fun streamingKeepsVisibleGeometryAndItsMarginWithoutDownloadingTheEntireMap() {
        val doc =
            newMapDocument().with("width", JsonPrimitive(200)).with("height", JsonPrimitive(200))
        val context = MapContext(doc, listOf(model))
        val near = entry(2.5, 2.5)
        val far = entry(100.5, 100.5)
        val camera = MapCamera(x = 2.5, y = 2.5, pixels = 80.0)
        assertEquals(
            listOf(near),
            mapViewportEntries(context, listOf(near, far), emptyMap(), camera, 400, 600, 1.0),
        )
        val viewport = MapViewportAssets()
        assertEquals(
            listOf(near, far),
            viewport.update(context, listOf(near, far), emptyMap(), camera, 400, 600, 1.0, false),
        )
    }

    @Test
    fun tallOffscreenModelsThatCanCastVisibleSunShadowsRemainLoaded() {
        val camera = MapCamera(x = 2.5, y = 2.5, pixels = 80.0)
        val tall = entry(10.5, 2.5).copy(model = model.copy(maxHeight = 12.0))
        val base =
            newMapDocument().with("width", JsonPrimitive(200)).with("height", JsonPrimitive(200))
        val lit =
            base
                .with("lightingEnabled", JsonPrimitive(true))
                .with(
                    "sun",
                    buildJsonObject {
                        put("enabled", true)
                        put("elevation", 10)
                    },
                )
        assertEquals(
            listOf(tall),
            mapViewportEntries(
                MapContext(lit, listOf(model)),
                listOf(tall),
                emptyMap(),
                camera,
                400,
                600,
                1.0,
            ),
        )
    }
}
