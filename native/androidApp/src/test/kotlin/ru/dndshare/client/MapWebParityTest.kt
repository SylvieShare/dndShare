package ru.dndshare.client

import kotlin.math.abs
import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.model.WireJson

class MapWebParityTest {
    @Test
    fun nativeOperationsMatchIndependentWebFixtures() {
        val source =
            requireNotNull(javaClass.classLoader.getResourceAsStream("maps/web-operations.json"))
                .bufferedReader()
                .use { it.readText() }
        val cases = WireJson.parseToJsonElement(source).jsonArray
        assertTrue(cases.size >= 40)
        for ((index, raw) in cases.withIndex()) {
            val test = raw.jsonObject
            val doc = test.getValue("input").jsonObject
            val models =
                test.getValue("models").jsonArray.map { value ->
                    val fields = value.jsonObject.toMutableMap()
                    fields["uuid"] = fields.getValue("id")
                    fields["id"] = fields.remove("definitionId")!!
                    WireJson.decodeFromJsonElement<MapModel>(JsonObject(fields))
                }
            val actual =
                when (test.string("kind")) {
                    "normalize" -> cleanIds(normalizeMapDocument(doc, models))
                    "surface" -> {
                        val tile = test.getValue("tile").jsonObject
                        val pose =
                            mapSurface(
                                tile,
                                models.first { it.uuid == tile.string("modelId") },
                                test.getValue("point").jsonObject,
                                test.number("elevation"),
                            )
                        poseJson(pose)
                    }
                    "lightPose" -> {
                        val pose =
                            mapLightPose(test.getValue("light").jsonObject, MapContext(doc, models))
                        poseJson(pose.point)
                            .with("height", JsonPrimitive(pose.height))
                            .with("worldHeight", JsonPrimitive(pose.worldHeight))
                    }
                    "transition" ->
                        runCatching {
                                cleanIds(
                                    mapApplyTransition(
                                        doc,
                                        models,
                                        "tile",
                                        "tile",
                                        test.string("key"),
                                    )
                                )
                            }
                            .getOrElse { JsonNull }
                    else -> error("Unknown fixture")
                }
            val expected =
                if (test.string("kind") == "lightPose")
                    JsonObject(
                        test.getValue("expected").jsonObject.filterKeys {
                            it in setOf("x", "y", "elevation", "height", "worldHeight")
                        }
                    )
                else test.getValue("expected")
            equivalent(expected, actual, "case $index ${test.string("kind")}")
        }
    }

    private fun poseJson(p: MapPose) = buildJsonObject {
        put("x", p.x)
        put("y", p.y)
        put("elevation", p.elevation)
    }

    private fun cleanIds(doc: JsonObject) =
        doc.with(
            "lights",
            JsonArray(
                doc.rows("lights").map { light ->
                    val anchor = light["anchor"] as? JsonObject
                    if (light.string("builtinKey").isBlank()) light
                    else
                        light.with(
                            "id",
                            JsonPrimitive(
                                "${anchor?.string("kind")}:${anchor?.string("id")}:${light.string("builtinKey")}"
                            ),
                        )
                }
            ),
        )

    private fun equivalent(expected: JsonElement, actual: JsonElement, path: String) {
        when {
            expected is JsonObject && actual is JsonObject -> {
                assertEquals(expected.keys, actual.keys, path)
                for (key in expected.keys) equivalent(
                    expected.getValue(key),
                    actual.getValue(key),
                    "$path.$key",
                )
            }
            expected is JsonArray && actual is JsonArray -> {
                assertEquals(expected.size, actual.size, path)
                expected.indices.forEach { equivalent(expected[it], actual[it], "$path[$it]") }
            }
            expected is JsonPrimitive &&
                actual is JsonPrimitive &&
                !expected.isString &&
                !actual.isString &&
                expected.doubleOrNull != null &&
                actual.doubleOrNull != null ->
                assertTrue(
                    abs(expected.double - actual.double) < 1e-8,
                    "$path: $expected != $actual",
                )
            else -> assertEquals(expected, actual, path)
        }
    }
}
