package ru.dndshare.client

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.*
import ru.dndshare.client.model.WireJson

class MapRotationMotionTest {
    private fun pose(row: JsonObject) =
        MapVisualPose(
            row.number("x"),
            row.number("y"),
            row.number("elevation"),
            row.number("rotation"),
            row.flag("mirrored"),
        )

    @Test
    fun intermediateFramesMatchTheWebForGroupPivotsShortestTurnsAndReflection() {
        val fixtures =
            WireJson.parseToJsonElement(
                    javaClass.getResourceAsStream("/maps/web-motion.json")!!.bufferedReader().use {
                        it.readText()
                    }
                )
                .jsonArray
        for (raw in fixtures) {
            val fixture = raw.jsonObject
            val motion = MapRotationMotion<String>()
            motion.set("tile", pose(fixture.getValue("from").jsonObject))
            motion.set("tile", pose(fixture.getValue("to").jsonObject))
            for (frame in fixture.rows("frames")) {
                motion.advance(frame.number("delta"))
                val actual = motion.pose("tile")!!
                val expected = frame.getValue("pose").jsonObject
                for ((key, value) in
                    listOf(
                        "x" to actual.x,
                        "y" to actual.y,
                        "elevation" to actual.elevation,
                        "rotation" to actual.rotation,
                        "mirrorScale" to actual.mirrorScale,
                    )) assertEquals(
                    expected.number(key, if (key == "mirrorScale") 1.0 else 0.0),
                    value,
                    1e-8,
                    "${fixture.string("name")}:$key",
                )
                assertEquals(expected.flag("mirrored"), actual.mirrored)
                assertEquals(expected.flag("mirroring"), actual.mirroring)
            }
            assertFalse(motion.moving)
        }
    }

    @Test
    fun reducedMotionSettlesImmediatelyAndRetargetingStartsAtTheCurrentPose() {
        val motion = MapRotationMotion<String>()
        motion.set("tile", MapVisualPose(1.0, 1.0, 0.0, 0.0))
        motion.set("tile", MapVisualPose(2.0, 1.0, 0.0, 90.0))
        motion.advance(70.0)
        val before = motion.pose("tile")!!
        motion.set("tile", MapVisualPose(1.0, 2.0, 0.0, 180.0))
        assertEquals(before, motion.pose("tile"))
        assertFalse(motion.advance(0.0, immediate = true))
        assertEquals(180.0, motion.pose("tile")!!.rotation)
    }
}
