package ru.dndshare.client

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.model.WireJson

class MapPlacementParityTest {
    private val fixtures: JsonObject
        get() =
            WireJson.parseToJsonElement(
                    requireNotNull(
                            javaClass.classLoader?.getResourceAsStream("maps/web-placement.json")
                        )
                        .bufferedReader()
                        .use { it.readText() }
                )
                .jsonObject

    private fun models(row: JsonObject) =
        row.getValue("models")
            .jsonArray
            .map { element ->
                val fields = element.jsonObject.toMutableMap()
                fields["uuid"] = fields.getValue("id")
                fields["id"] = fields.remove("definitionId")!!
                WireJson.decodeFromJsonElement<MapModel>(JsonObject(fields))
            }
            .associateBy { it.uuid }

    @Test
    fun nearbyCandidatesMatchTheWebIncludingOverhangsRotationsAndMapEdges() {
        val cases = fixtures.getValue("nearest").jsonArray
        assertEquals(12, cases.size)
        for ((index, element) in cases.withIndex()) {
            val row = element.jsonObject
            val expected = row["expected"]
            val result =
                nearestMapTilePlacement(
                    row.getValue("document").jsonObject,
                    row.getValue("tile").jsonObject,
                    models(row),
                )
            if (expected == JsonNull) assertNull(result, "case $index")
            else {
                assertNotNull(result, "case $index")
                val target = expected!!.jsonObject
                for (key in listOf("x", "y", "level", "rotation")) assertEquals(
                    target.number(key),
                    result.tile.number(key),
                    .000001,
                    "case $index $key",
                )
                assertEquals(
                    target.number("elevation"),
                    result.elevation,
                    .000001,
                    "case $index elevation",
                )
            }
        }
    }

    @Test
    fun boundedRoomFloodFillMatchesTheWebAndRejectsAnOpenBoundary() {
        val cases = fixtures.getValue("fills").jsonArray
        assertEquals(3, cases.size)
        for (element in cases) {
            val row = element.jsonObject
            val point = row.getValue("point").jsonObject
            val actual =
                mapEnclosedCells(
                    row.getValue("document").jsonObject,
                    MapPose(point.number("x"), point.number("y")),
                    models(row),
                )
            val expected = row["expected"]
            if (expected == JsonNull) assertNull(actual)
            else
                assertEquals(
                    expected!!.jsonArray.map {
                        it.jsonObject.number("x").toInt() to it.jsonObject.number("y").toInt()
                    },
                    actual,
                )
        }
    }
}
