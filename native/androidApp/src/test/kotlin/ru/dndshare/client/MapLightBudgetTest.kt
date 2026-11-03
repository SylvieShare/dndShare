package ru.dndshare.client

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.*

class MapLightBudgetTest {
    private fun source(
        id: String,
        x: Double,
        y: Double,
        radius: Double = 1.0,
        shadows: Boolean = false,
    ): MapLightPose {
        val row = buildJsonObject {
            put("id", id)
            put("x", x)
            put("y", y)
            put("elevation", .44)
            put("height", 0)
            put("radius", radius)
            put("enabled", true)
            put("intensity", 8)
            put("shadows", shadows)
        }
        return mapLightPose(row, MapContext(newMapDocument(), emptyList()))
    }

    @Test
    fun shadowDefaultsIncludeTheNormalAndPolygonBiasesMissingFromTheJavaRecord() {
        val options = mapShadowOptions(512)
        assertEquals(512, options.mapSize)
        assertEquals(1f, options.normalBias)
        assertEquals(.001f, options.constantBias)
        assertEquals(.5f, options.polygonOffsetConstant)
        assertEquals(2f, options.polygonOffsetSlope)
        assertEquals(1f, options.transformW)
    }

    @Test
    fun selectionAndShadowsTakePriorityWithinEightVisibleSources() {
        val sources = (0..11).map { source(it.toString(), 5 + it * .05, 5.0, shadows = it == 10) }
        val result =
            mapVisibleLights(
                sources,
                MapCamera(x = 5.0, y = 5.0, pixels = 20.0, tilt = 90.0, azimuth = 0.0),
                200,
                200,
                "11",
            )
        assertEquals(8, result.size)
        assertEquals(
            listOf("11", "10", "0", "1", "2", "3", "4", "5"),
            result.map { it.source.string("id") },
        )
    }

    @Test
    fun aLightSphereCrossingTheFrustumRemainsVisibleWhileAnOutsideSelectionDoesNot() {
        val camera = MapCamera(x = 5.0, y = 5.0, pixels = 20.0, tilt = 90.0, azimuth = 0.0)
        assertTrue(mapLightIntersectsView(source("a", 11.0, 5.0, 2.0), camera, 200, 200))
        assertFalse(mapLightIntersectsView(source("a", 11.0, 5.0, .25), camera, 200, 200))
        val visible =
            mapVisibleLights(
                listOf(source("outside", 100.0, 100.0), source("inside", 5.0, 5.0)),
                camera,
                200,
                200,
                "outside",
            )
        assertEquals("inside", visible.single().source.string("id"))
    }

    @Test
    fun savedRollAndIndependentAspectControlTheSphereProjection() {
        val view = buildJsonObject {
            put("position", numbers(5.0, 5.0, 8.0))
            put("target", numbers(5.0, 5.0, .44))
            put("up", numbers(1.0, 0.0, 0.0))
            put("width", 10)
            put("aspect", 1.25)
        }
        val camera = mapCameraView(view, 200)
        assertFalse(mapLightIntersectsView(source("a", 10.1, 5.0, 1.0), camera, 200, 100))
        assertTrue(mapLightIntersectsView(source("a", 10.1, 5.0, 1.2), camera, 200, 100))
    }

    @Test
    fun zeroVisibilityDoesNotConsumeASlot() {
        val dark = source("dark", 5.0, 5.0).copy(opacity = 0f)
        val camera = MapCamera(x = 5.0, y = 5.0, pixels = 20.0)
        assertEquals(
            listOf("lit"),
            mapVisibleLights(listOf(dark, source("lit", 5.0, 5.0)), camera, 200, 200).map {
                it.source.string("id")
            },
        )
    }
}
