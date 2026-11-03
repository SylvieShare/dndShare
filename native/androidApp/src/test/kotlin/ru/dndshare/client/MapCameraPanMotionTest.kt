package ru.dndshare.client

import kotlin.math.hypot
import kotlin.test.*
import org.junit.Test
import ru.dndshare.client.maps.rendering.*

class MapCameraPanMotionTest {
    @Test
    fun movementDoesNotDependOnKeyRepeatAndDiagonalSpeedIsNormalized() {
        fun distance(fps: Int, diagonal: Boolean): Double {
            val motion = MapCameraPanMotion()
            motion.down(MapPanDirection.Right)
            if (diagonal) motion.down(MapPanDirection.Down)
            var x = 0.0
            var y = 0.0
            repeat(fps) {
                val p = motion.advance(1.0 / fps)
                x += p.first
                y += p.second
            }
            return hypot(x, y)
        }
        val normal = distance(60, false)
        assertTrue(normal in 275.0..292.0)
        assertEquals(normal, distance(60, true), .001)
        assertEquals(normal, distance(120, false), 2.0)
        assertEquals(normal, distance(30, false), 3.0)
    }

    @Test
    fun quickTapMovesAndReleaseDeceleratesBeforeBecomingIdleAndStopClearsHeldKeys() {
        val motion = MapCameraPanMotion()
        motion.down(MapPanDirection.Right)
        motion.up(MapPanDirection.Right)
        assertTrue(motion.advance(.016).first > 0)
        repeat(30) { motion.advance(.016) }
        assertFalse(motion.moving)
        assertEquals(0.0 to 0.0, motion.advance(.016))
        motion.down(MapPanDirection.Down)
        motion.advance(.04)
        motion.stop()
        assertFalse(motion.moving)
        assertEquals(0.0 to 0.0, motion.advance(.04))
    }
}
