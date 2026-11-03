package ru.dndshare.client

import kotlin.math.exp
import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.*

class MapPlacementMotionTest {
    private val model = MapModel("floor", "floor", "Пол", mountDepth = .3)
    private val prop = MapModel("prop", "prop", "Сундук", tileType = "object")
    private val models = listOf(model, prop)
    private val fake = MapEntityRef(MapEntityKind.Tile, "preview")
    private val real = MapEntityRef(MapEntityKind.Tile, "committed")

    private fun document(
        id: String = "preview",
        x: Double = 1.0,
        attached: Boolean = false,
    ): JsonObject {
        val tile = buildJsonObject {
            put("id", id)
            put("modelId", "floor")
            put("x", x)
            put("y", 2)
            put("level", 0)
        }
        var doc = newMapDocument().with("tiles", JsonArray(listOf(tile)))
        if (attached)
            doc =
                doc.with(
                        "objects",
                        JsonArray(
                            listOf(
                                buildJsonObject {
                                    put("id", "child")
                                    put("modelId", "prop")
                                    put(
                                        "placement",
                                        buildJsonObject {
                                            put("tileId", id)
                                            put("point", 0)
                                        },
                                    )
                                }
                            )
                        ),
                    )
                    .with(
                        "lights",
                        JsonArray(
                            listOf(
                                buildJsonObject {
                                    put("id", "lamp")
                                    put(
                                        "anchor",
                                        buildJsonObject {
                                            put("kind", "tile")
                                            put("id", id)
                                        },
                                    )
                                }
                            )
                        ),
                    )
        return doc
    }

    private fun entries(doc: JsonObject) = mapSceneEntries(doc, models.associateBy { it.uuid })

    private fun merge(
        motion: MapPlacementMotion,
        doc: JsonObject,
        spec: MapPreviewSpec = MapPreviewSpec(setOf(fake)),
        ready: Boolean = true,
    ) =
        motion.merge(
            entries(doc),
            MapContext(doc, models),
            spec,
            if (ready) entries(doc).associateBy { it.ref } else emptyMap(),
        )

    private val canonical = MapVisualPose(1.5, 2.5, 0.0, 0.0)

    @Test
    fun groupTranslationAndLiftMatchWebTimeConstantsAndSurviveCommitRemapping() {
        val motion = MapPlacementMotion()
        merge(motion, document())
        motion.advance(80.0, true)
        assertEquals(.35 * (1 - exp(-1.0)), motion.pose(fake, canonical).elevation, .00001)
        merge(motion, document(x = 5.0))
        motion.advance(45.0, true)
        val before = motion.pose(fake, canonical.copy(x = 5.5))
        assertEquals(1.5 + 4 * (1 - exp(-1.0)), before.x, .00001)
        merge(motion, document("committed", 5.0), MapPreviewSpec())
        assertEquals(before, motion.pose(real, canonical.copy(x = 5.5)))
        motion.advance(5000.0, true)
        assertFalse(motion.moving)
        assertEquals(canonical.copy(x = 5.5), motion.pose(real, canonical.copy(x = 5.5)))
    }

    @Test
    fun cancellationRetainsReadyTileAttachmentsAndLightsUntilFadeCompletes() {
        val motion = MapPlacementMotion()
        val doc = document(attached = true)
        merge(motion, doc)
        motion.advance(500.0, true)
        val empty = newMapDocument()
        val retained =
            motion.merge(
                emptyList(),
                MapContext(empty, models),
                MapPreviewSpec(),
                entries(doc).associateBy { it.ref },
            )
        assertEquals(
            setOf(fake, MapEntityRef(MapEntityKind.Object, "child")),
            retained.map { it.ref }.toSet(),
        )
        assertEquals(
            "lamp",
            motion.context(MapContext(empty, models)).document.rows("lights").single().string("id"),
        )
        motion.advance(80.0, true)
        assertEquals(exp(-1.0).toFloat(), motion.opacity(fake), .0001f)
        assertEquals(
            motion.opacity(fake),
            motion.opacity(MapEntityRef(MapEntityKind.Object, "child")),
        )
        motion.advance(5000.0, true)
        assertTrue(fake in motion.released)
        assertTrue(motion.retainedRefs.isEmpty())
        assertTrue(motion.context(MapContext(empty, models)).document.rows("lights").isEmpty())
    }

    @Test
    fun unreadyCancellationDoesNotStartDownloadsAndExistingTileReturnsToOriginalPosition() {
        val motion = MapPlacementMotion()
        merge(motion, document(), ready = false)
        assertTrue(
            motion
                .merge(
                    emptyList(),
                    MapContext(newMapDocument(), models),
                    MapPreviewSpec(),
                    emptyMap(),
                )
                .isEmpty()
        )
        assertFalse(motion.moving)
        merge(motion, document(x = 5.0))
        motion.advance(100.0, true)
        merge(motion, document(x = 1.0), MapPreviewSpec())
        assertTrue(motion.pose(fake, canonical).x > 1.5)
        motion.advance(5000.0, true)
        assertEquals(canonical, motion.pose(fake, canonical))
        assertTrue(motion.retainedRefs.isEmpty())
    }

    @Test
    fun newlyPlacedObjectStaysOnItsSupportButMovingObjectLiftsAndReducedMotionSettlesImmediately() {
        val motion = MapPlacementMotion()
        val ref = MapEntityRef(MapEntityKind.Object, "prop")
        val entry = MapSceneEntry(ref, prop, mapTransform(1.0, 2.0, .5, 0.0))
        val context = MapContext(newMapDocument(), models)
        val pose = MapVisualPose(1.0, 2.0, .5, 0.0)
        motion.merge(
            listOf(entry),
            context,
            MapPreviewSpec(setOf(ref), moving = false),
            mapOf(ref to entry),
        )
        motion.advance(500.0, true)
        assertEquals(pose, motion.pose(ref, pose))
        motion.merge(
            listOf(entry),
            context,
            MapPreviewSpec(setOf(ref), moving = true),
            mapOf(ref to entry),
        )
        motion.advance(0.0, false)
        assertEquals(.72, motion.pose(ref, pose).elevation, .00001)
        motion.merge(listOf(entry), context, MapPreviewSpec(), mapOf(ref to entry))
        motion.advance(0.0, false)
        assertEquals(pose, motion.pose(ref, pose))
        assertFalse(motion.moving)
    }
}
