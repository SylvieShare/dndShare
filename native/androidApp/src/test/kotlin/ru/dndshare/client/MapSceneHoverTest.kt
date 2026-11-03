package ru.dndshare.client

import kotlin.test.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.MapSceneHover

class MapSceneHoverTest {
    @Test
    fun pointerEventsCoalesceAndOutdatedOrClosedPicksCannotRestoreHover() {
        val callbacks = mutableListOf<(MapEntityRef?) -> Unit>()
        val positions = mutableListOf<Pair<Float, Float>>()
        var changes = 0
        val hover =
            MapSceneHover(
                { x, y, done ->
                    positions += x to y
                    callbacks += done
                },
                { changes++ },
                {},
            )
        repeat(100) { hover.pointer(it.toFloat(), 1f) }
        hover.advance()
        assertEquals(listOf(99f to 1f), positions)
        hover.pointer(200f, 2f)
        hover.advance()
        assertEquals(1, callbacks.size)
        callbacks[0](MapEntityRef(MapEntityKind.Tile, "old"))
        assertNull(hover.target)
        hover.advance()
        val target = MapEntityRef(MapEntityKind.Object, "new")
        callbacks[1](target)
        assertEquals(target, hover.target)
        assertEquals(1, changes)
        hover.pointer(null, null)
        assertNull(hover.target)
        hover.pointer(300f, 3f)
        hover.advance()
        hover.close()
        callbacks[2](target)
        assertNull(hover.target)
        assertEquals(2, changes)
    }
}
