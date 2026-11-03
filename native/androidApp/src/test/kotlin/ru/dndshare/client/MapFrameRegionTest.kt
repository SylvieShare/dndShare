package ru.dndshare.client

import kotlin.test.*
import org.junit.Test
import ru.dndshare.client.maps.MapPose
import ru.dndshare.client.maps.rendering.*

class MapFrameRegionTest {
    @Test
    fun cropUsesPhysicalPixelsAndNeverReplacesWithPartialFrame() {
        val camera = MapCamera(x = 3.0, y = 3.0, pixels = 50.0, elevation = 0.0)
        val center = mapLightFrameRegion(camera, MapPose(3.0, 3.0), 800, 600, 100, 50, 2.0)!!
        assertEquals(320, center.width)
        assertEquals(160, center.height)
        assertEquals(240, center.left)
        assertEquals(220, center.top)
        assertNull(mapLightFrameRegion(camera, MapPose(-30.0, 3.0), 800, 600, 100, 50, 2.0))
        assertNull(mapLightFrameRegion(camera, MapPose(3.0, 3.0), 100, 100, 100, 50, 2.0))
    }
}
