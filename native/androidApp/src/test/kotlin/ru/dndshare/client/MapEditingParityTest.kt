package ru.dndshare.client

import kotlin.math.abs
import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.*
import ru.dndshare.client.model.WireJson

class MapEditingParityTest {
    @Test
    fun groupTransformsMatchWebWithRectangularTilesAndHalfGridPivots() {
        val cases =
            WireJson.parseToJsonElement(
                    requireNotNull(
                            javaClass.classLoader.getResourceAsStream("maps/web-groups.json")
                        )
                        .bufferedReader()
                        .use { it.readText() }
                )
                .jsonArray
        assertEquals(8, cases.size)
        for (raw in cases) {
            val fixture = raw.jsonObject
            val models =
                fixture
                    .getValue("models")
                    .jsonArray
                    .map { value ->
                        val fields = value.jsonObject.toMutableMap()
                        fields["uuid"] = fields.getValue("id")
                        fields["id"] = fields.remove("definitionId")!!
                        WireJson.decodeFromJsonElement<MapModel>(JsonObject(fields))
                    }
                    .associateBy { it.uuid }
            val tiles = fixture.rows("tiles")
            val objects = fixture.rows("objects")
            val pivot = mapGroupPivot(tiles, objects, models)
            val expected = fixture.getValue("pivot").jsonObject
            assertEquals(expected.number("x"), pivot.x, 1e-8)
            assertEquals(expected.number("y"), pivot.y, 1e-8)
            val (rotated, moved) = mapRotateGroup(tiles, objects, models, pivot)
            equivalent(
                fixture.getValue("rotated"),
                buildJsonObject {
                    put("tiles", JsonArray(rotated))
                    put("objects", JsonArray(moved))
                },
            )
            equivalent(fixture.getValue("mirrored"), JsonArray(mapMirrorGroup(tiles, models)))
        }
    }

    @Test
    fun savedCameraRollAndAspectArePreservedAndPlanePickingInvertsProjection() {
        val view = buildJsonObject {
            put("position", numbers(2.0, 3.0, 8.0))
            put("target", numbers(2.0, 3.0, .44))
            put("up", numbers(1.0, 0.0, 0.0))
            put("width", 10)
            put("aspect", 1.25)
        }
        val camera = mapCameraView(view, 100)
        val projected = camera.project(MapPose(3.0, 4.0, .44), 100, 80)
        assertEquals(60f, projected.first, .0001f)
        assertEquals(30f, projected.second, .0001f)
        val point = camera.world(projected.first.toDouble(), projected.second.toDouble(), 100, 80)
        assertEquals(3.0, point.x, .00001)
        assertEquals(4.0, point.y, .00001)
        assertEquals(view, captureMapCamera(camera, 100, 80))
        assertNull(camera.pan(4.0, 2.0).saved)
    }

    @Test
    fun translatedCameraPreservesRollUntilItsDirectionChanges() {
        val view = buildJsonObject {
            put("position", numbers(2.0, 3.0, 8.0))
            put("target", numbers(2.0, 3.0, .44))
            put("up", numbers(1.0, 0.0, 0.0))
            put("width", 10)
            put("aspect", 1.25)
        }
        val camera = buildJsonObject {
            put("id", "one")
            put("view", view)
        }
        val moved = translateMapCamera(camera, MapPose(0.0, 0.0), MapPose(2.0, 1.0))
        assertEquals(view["up"], moved.getValue("view").jsonObject["up"])
        assertEquals(numbers(4.0, 4.0, 8.0), moved.getValue("view").jsonObject["position"])
        val aimed = translateMapCamera(camera, MapPose(0.0, 0.0), MapPose(2.0, 1.0), "target")
        assertEquals(numbers(0.0, 0.0, 1.0), aimed.getValue("view").jsonObject["up"])
    }

    private fun equivalent(expected: JsonElement, actual: JsonElement) {
        when {
            expected is JsonObject && actual is JsonObject -> {
                assertEquals(expected.keys, actual.keys)
                expected.forEach { (key, value) -> equivalent(value, actual.getValue(key)) }
            }
            expected is JsonArray && actual is JsonArray -> {
                assertEquals(expected.size, actual.size)
                expected.indices.forEach { equivalent(expected[it], actual[it]) }
            }
            expected is JsonPrimitive &&
                actual is JsonPrimitive &&
                !expected.isString &&
                expected.doubleOrNull != null &&
                actual.doubleOrNull != null ->
                assertTrue(abs(expected.double - actual.double) < 1e-8, "$expected != $actual")
            else -> assertEquals(expected, actual)
        }
    }
}
