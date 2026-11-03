package ru.dndshare.client

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.geometry.*
import ru.dndshare.client.maps.rendering.*

class MapBuiltinPropsTest {
    @Test
    fun allWebPropKindsResolveToValidStaticGeometryAndInteractiveStatesHaveDistinctAssets() {
        for (kind in MapBuiltinProps.labels.keys) {
            val closed = buildJsonObject {
                put("id", "item")
                put("kind", kind)
                put("x", 2)
                put("y", 2)
                put("rotation", 0)
                put("scale", 1)
                put("elevation", .44)
            }
            val model = MapBuiltinProps.model(closed)
            val bytes = assertNotNull(MapBuiltinProps.bytes(model.renderUrl))
            assertTrue(GlbDocument(bytes).parts().sumOf { it.geometry.indices.size } > 0)
            val entries =
                mapSceneEntries(
                    newMapDocument().with("objects", JsonArray(listOf(closed))),
                    emptyMap(),
                )
            assertEquals(MapEntityRef(MapEntityKind.Object, "item"), entries.single().ref)
            if (kind in MapBuiltinProps.interactive) {
                val open = MapBuiltinProps.model(closed.with("open", JsonPrimitive(true)))
                assertFalse(bytes.contentEquals(MapBuiltinProps.bytes(open.renderUrl)))
                assertNotEquals(model.renderUrl, open.renderUrl)
            }
        }
    }

    @Test
    fun aLightBoundToAProceduralObjectFollowsItsPositionAndRotation() {
        val objectRow = buildJsonObject {
            put("id", "owner")
            put("kind", "chest")
            put("x", 4)
            put("y", 5)
            put("elevation", .44)
            put("rotation", 90)
            put("scale", 1)
        }
        val light = buildJsonObject {
            put("id", "light")
            put("x", 0)
            put("y", 0)
            put("height", 1)
            put(
                "anchor",
                buildJsonObject {
                    put("kind", "object")
                    put("id", "owner")
                },
            )
            put("offset", numbers(1.0, 0.0))
        }
        val pose =
            mapLightPose(
                light,
                MapContext(
                    newMapDocument().with("objects", JsonArray(listOf(objectRow))),
                    emptyList(),
                ),
            )
        assertEquals(4.0, pose.point.x, .00001)
        assertEquals(6.0, pose.point.y, .00001)
        assertEquals(.44, pose.point.elevation, .00001)
    }
}
