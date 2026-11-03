package ru.dndshare.client

import kotlin.math.*
import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.geometry.*
import ru.dndshare.client.maps.rendering.*

class MapScenePoseTest {
    private val floor =
        MapModel(
            "floor",
            "floor",
            "Пол",
            tileType = "floor",
            canStand = true,
            surfaceHeight = .5,
            placementPoints =
                JsonArray(
                    listOf(
                        buildJsonObject {
                            put("x", .2)
                            put("y", .5)
                            put("elevation", .5)
                        }
                    )
                ),
        )
    private val prop = MapModel("prop", "prop", "Предмет", tileType = "object")
    private val models = listOf(floor, prop)
    private val tile = MapEntityRef(MapEntityKind.Tile, "tile")
    private val obj = MapEntityRef(MapEntityKind.Object, "prop")

    private fun document(rotation: Int = 0, mirror: Boolean = false) =
        newMapDocument()
            .with(
                "tiles",
                JsonArray(
                    listOf(
                        buildJsonObject {
                            put("id", "tile")
                            put("modelId", "floor")
                            put("x", 2)
                            put("y", 2)
                            put("rotation", rotation)
                            put("level", 0)
                            put("mirrored", mirror)
                        }
                    )
                ),
            )
            .with(
                "objects",
                JsonArray(
                    listOf(
                        buildJsonObject {
                            put("id", "prop")
                            put("kind", "chest")
                            put("modelId", "prop")
                            put("rotation", 0)
                            put("scale", 1)
                            put(
                                "placement",
                                buildJsonObject {
                                    put("tileId", "tile")
                                    put("point", 0)
                                },
                            )
                        }
                    )
                ),
            )

    private fun sync(motion: MapSceneMotion, doc: JsonObject) {
        motion.sync(
            mapSceneEntries(doc, models.associateBy { it.uuid }).associateBy { it.ref },
            MapContext(doc, models),
        )
    }

    @Test
    fun anAttachedObjectFollowsTheTurningSurfaceWithoutChangingItsLocalPoint() {
        val motion = MapSceneMotion()
        sync(motion, document())
        sync(motion, document(rotation = 90))
        motion.advance(0.0, true)
        motion.advance(.07, true)
        val parent = motion.matrix(tile)!!
        val child = motion.matrix(obj)!!
        val local = Mat4.point(Mat4.inverse(parent), Vec3(child[12], child[13], child[14]))
        assertEquals(-.3f, local.x, .0001f)
        assertEquals(.5f, local.y, .0001f)
        assertEquals(0f, local.z, .0001f)
        assertTrue(abs(child[12] - 2.5f) > .001f, "The item must move through an intermediate pose")
    }

    @Test
    fun mirroringMovesTheAnchorButDoesNotSqueezeTheAttachedObject() {
        val motion = MapSceneMotion()
        sync(motion, document())
        sync(motion, document(mirror = true))
        motion.advance(0.0, true)
        motion.advance(.14, true)
        val parent = motion.matrix(tile)!!
        val child = motion.matrix(obj)!!
        assertTrue(abs(parent[0]) < .01f)
        assertEquals(
            1.0,
            sqrt((child[0] * child[0] + child[1] * child[1] + child[2] * child[2]).toDouble()),
            .0001,
        )
        assertEquals(2.5f, child[12], .001f)
    }

    @Test
    fun publishingVisualMatricesCannotOverwriteTheTargetUsedByAnchoredLight() {
        val motion = MapSceneMotion()
        sync(motion, document())
        val doc = document(rotation = 90)
        val context = MapContext(doc, models)
        val targets =
            mapSceneEntries(doc, models.associateBy { it.uuid })
                .associateBy { it.ref }
                .toMutableMap()
        motion.sync(targets, context)
        targets[tile] = targets.getValue(tile).copy(matrix = motion.matrix(tile)!!)
        motion.advance(0.0, true)
        motion.advance(.07, true)
        val light = buildJsonObject {
            put("id", "light")
            put("height", 1)
            put("offset", numbers(.2, 0.0))
            put(
                "anchor",
                buildJsonObject {
                    put("kind", "tile")
                    put("id", "tile")
                },
            )
        }
        val target = mapLightPose(light, context)
        val visual = motion.anchors().light(target)
        assertTrue(
            hypot(target.point.x - visual.point.x, target.point.y - visual.point.y) > .01,
            "The light must follow the intermediate surface, not its final canonical point",
        )
    }
}
