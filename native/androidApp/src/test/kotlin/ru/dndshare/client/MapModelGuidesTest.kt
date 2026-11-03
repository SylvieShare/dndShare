package ru.dndshare.client

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.maps.*

class MapModelGuidesTest {
    private val slot = buildJsonObject {
        put("x", 0)
        put("y", 0)
        put("width", 2)
        put("height", 1)
        put("elevation", .6)
    }
    private val model =
        MapModel(
            "model",
            "model",
            "Модель",
            tileType = "floor",
            width = 2,
            height = 1,
            mountDepth = .1,
            surfaceHeight = .5,
            maxHeight = 1.0,
            placementOffset = listOf(.05, -.02),
            supportSlots = JsonArray(listOf(slot)),
            raw =
                buildJsonObject {
                    put("wallMode", "edge")
                    put("wallMask", 17)
                },
        )

    @Test
    fun measuredHeightsAndPortsUseTheSameFrameAsTheReferenceModel() {
        val guides = mapModelGuides(model, "surfaceHeight", 0)
        val mount = guides.labels.single { it.field.key == "mountDepth" }
        assertEquals(-.05, mount.point.elevation, 1e-9)
        val surface = guides.labels.single { it.field.key == "surfaceHeight" }
        assertEquals(.15, surface.point.elevation, 1e-9)
        val ports = guides.markers.filter { it.kind == "port" }
        assertEquals(listOf(0, 2, 4, 6), ports.map { it.index })
        assertEquals(listOf(0, 4), ports.filter { it.active }.map { it.index })
        assertEquals(1.14, ports.first().point.elevation, 1e-9)
        val slots = guides.markers.filter { it.kind == "slot" }
        assertEquals(2, slots.size)
        assertTrue(slots.all { it.valid })
        assertEquals(.535, slots.first().point.elevation, 1e-9)
    }

    @Test
    fun invalidInsertionProfilesRemainVisibleAsInvalidSockets() {
        val invalid =
            model.copy(
                supportSlots = JsonArray(listOf(slot.with("insertionRise", JsonPrimitive(.1))))
            )
        assertTrue(
            mapModelGuides(invalid, null, -1).markers.filter { it.kind == "slot" }.all { !it.valid }
        )
        val frame = invalid.copy(tileType = "frame")
        assertTrue(
            mapModelGuides(frame, null, -1).markers.filter { it.kind == "slot" }.all { it.valid }
        )
    }
}
