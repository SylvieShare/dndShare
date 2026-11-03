package ru.dndshare.client

import kotlin.test.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.*

class MapSceneQualityTest {
    private val ref = MapEntityRef(MapEntityKind.Tile, "tile")
    private val model = MapModel("floor", "floor", "Пол", renderUrl = "/render", lodUrl = "/lod")
    private val entry = MapSceneEntry(ref, model, mapTransform(1.0, 2.0, 0.0, 0.0))

    @Test
    fun fastGeometryIsPlannedBeforeRenderAndStopsBeingRequiredWhenThePreferredPoolIsReady() {
        val plan = mapAssetRequests(listOf(entry)) { false }
        assertEquals(listOf("/lod", "/render"), plan.keys.toList())
        assertEquals(1, plan.getValue("/lod").size)
        assertEquals(
            listOf("/render"),
            mapAssetRequests(listOf(entry)) { it == "/render" }.keys.toList(),
        )
        assertEquals(
            listOf("/lod"),
            mapAssetRequests(listOf(entry.copy(model = model.copy(renderUrl = "/lod")))) { false }
                .keys
                .toList(),
        )
    }

    @Test
    fun movingAndLandingDetailsUseRenderUntilForcedLodAndStableFramesReuseThePlan() {
        val quality = MapSceneQuality()
        val entries = listOf(entry)
        val low = quality.entries(newMapDocument(), entries, MapModelTier.Lod, false, emptySet())
        assertEquals("/lod", low.single().model.renderUrl)
        assertSame(
            low,
            quality.entries(newMapDocument(), entries, MapModelTier.Lod, false, emptySet()),
        )
        assertEquals(
            "/render",
            quality
                .entries(newMapDocument(), entries, MapModelTier.Lod, false, setOf(ref))
                .single()
                .model
                .renderUrl,
        )
        assertEquals(
            "/lod",
            quality
                .entries(newMapDocument(), entries, MapModelTier.Lod, true, setOf(ref))
                .single()
                .model
                .renderUrl,
        )
    }

    @Test
    fun committingAVisiblePreviewPreservesItsIntermediateRotationState() {
        val motion = MapRotationMotion<String>()
        motion.set("preview", MapVisualPose(1.0, 2.0, 0.0, 0.0))
        motion.set("preview", MapVisualPose(1.0, 2.0, 0.0, 90.0))
        motion.advance(70.0)
        val before = assertNotNull(motion.pose("preview"))
        assertTrue(before.rotation > 0 && before.rotation < 90)
        motion.remap("preview", "committed")
        motion.retain(setOf("committed"))
        motion.set("committed", MapVisualPose(1.0, 2.0, 0.0, 90.0))
        assertEquals(before, motion.pose("committed"))
        motion.advance(210.0)
        assertEquals(90.0, motion.pose("committed")?.rotation)
    }
}
