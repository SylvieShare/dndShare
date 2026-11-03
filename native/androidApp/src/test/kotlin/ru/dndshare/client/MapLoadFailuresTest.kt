package ru.dndshare.client

import kotlin.test.*
import org.junit.Test
import ru.dndshare.client.maps.rendering.MapLoadFailures

class MapLoadFailuresTest {
    @Test
    fun unrelatedSuccessAndSceneEditsPreserveRequiredFailuresUntilRetryOrRemoval() {
        val failures = MapLoadFailures()
        failures.fail("bad.glb", "Нет связи")
        failures.set("ready.glb", null)
        failures.retain(setOf("bad.glb", "ready.glb"))
        assertEquals("Нет связи", failures.message)
        failures.fail("second.glb", null)
        failures.retain(setOf("second.glb"))
        assertNotNull(failures.message)
        failures.clear()
        assertNull(failures.message)
        assertFalse("second.glb" in failures)
    }
}
