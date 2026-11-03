package ru.dndshare.client

import kotlin.math.abs
import kotlin.test.*
import org.junit.Test
import ru.dndshare.client.maps.rendering.*

class MapRenderResolutionTest {
    @Test
    fun smallWindowsKeepNativePixelsAndHighDensityStopsAtOneAndAHalf() {
        assertEquals(MapRenderSize(390, 844), mapRenderSize(390, 844, 1.0))
        assertEquals(MapRenderSize(540, 1200), mapRenderSize(1080, 2400, 3.0))
        assertEquals(MapRenderSize(1200, 1920), mapRenderSize(1600, 2560, 2.0))
    }

    @Test
    fun hugeBuffersStayInsideTheSameSixMillionPixelBudgetWithoutChangingAspect() {
        for ((width, height) in listOf(7680 to 4320, 5120 to 2880, 6000 to 10000, 32000 to 4000)) {
            val size = mapRenderSize(width, height, 1.0)
            assertTrue(size.width.toLong() * size.height <= 6_000_000)
            assertTrue(abs(size.width.toDouble() / size.height - width.toDouble() / height) < .005)
        }
    }
}
