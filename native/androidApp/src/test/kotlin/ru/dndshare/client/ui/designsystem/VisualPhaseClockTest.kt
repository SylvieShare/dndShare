package ru.dndshare.client.ui.designsystem

import kotlin.test.assertEquals
import org.junit.Test

class VisualPhaseClockTest {
    @Test fun resumingKeepsItsPhaseAndExcludesPausedTime() {
        val clock = VisualPhaseClock()
        assertEquals(0L, clock.frame(100))
        assertEquals(60L, clock.frame(160))
        clock.pause()
        assertEquals(60L, clock.frame(1000))
        assertEquals(120L, clock.frame(1060))
    }

    @Test fun repeatedStopsBeforeAndAfterTheFirstFrameAreSafe() {
        val clock = VisualPhaseClock()
        repeat(3) { clock.pause() }
        assertEquals(0L, clock.frame(500))
        assertEquals(20L, clock.frame(520))
        repeat(3) { clock.pause() }
        assertEquals(20L, clock.frame(9000))
    }
}
