package ru.dndshare.client

import kotlin.test.*
import org.junit.Test
import ru.dndshare.client.maps.rendering.*

class MapModelTierTest {
    @Test
    fun initialTierAndHysteresisMatchTheWeb() {
        assertEquals(MapModelTier.Lod, mapModelTier(71.999, null))
        assertEquals(MapModelTier.Render, mapModelTier(72.0, null))
        assertEquals(MapModelTier.Render, mapModelTier(64.0, MapModelTier.Render))
        assertEquals(MapModelTier.Lod, mapModelTier(63.9, MapModelTier.Render))
        assertEquals(MapModelTier.Lod, mapModelTier(79.9, MapModelTier.Lod))
        assertEquals(MapModelTier.Render, mapModelTier(80.0, MapModelTier.Lod))
        assertEquals(MapModelTier.Lod, mapModelTier(200.0, MapModelTier.Render, true))
    }
}
