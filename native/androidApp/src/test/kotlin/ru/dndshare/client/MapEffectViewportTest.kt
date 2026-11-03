package ru.dndshare.client

import kotlin.test.*
import org.junit.Test
import ru.dndshare.client.maps.geometry.VolumeFogField
import ru.dndshare.client.maps.rendering.*

class MapEffectViewportTest {
    @Test
    fun intersectingVolumesRemainActiveEvenWhenTheirCentreIsOutsideTheScreen() {
        val view =
            MapEffectViewport(
                MapCamera(x = 0.0, y = 0.0, azimuth = 0.0, tilt = 90.0, pixels = 100.0),
                400,
                300,
            )
        assertTrue(view.fire(0.0, 0.0, 0.0, .2, .4))
        assertFalse(view.fire(10.0, 10.0, 0.0, .2, .4))
        assertTrue(view.fire(2.1, 0.0, 0.0, .2, .4))
        val near =
            VolumeFogField(
                doubleArrayOf(1.9, 0.0, -1.0),
                doubleArrayOf(2.0, 2.0, 2.0),
                intArrayOf(1, 1, 1),
                byteArrayOf(1),
                emptyMap(),
            )
        assertTrue(view.fog(near))
        assertFalse(view.fog(near.copy(min = doubleArrayOf(10.0, 0.0, 10.0))))
    }
}
