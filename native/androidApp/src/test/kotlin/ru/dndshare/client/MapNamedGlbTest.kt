package ru.dndshare.client

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.geometry.GlbDocument
import ru.dndshare.client.maps.geometry.parts
import ru.dndshare.client.maps.rendering.*

class MapNamedGlbTest {
    @Test
    fun namesKeepNodeIndicesTransformsAndEmbeddedBinaryGeometryUnchanged() {
        val bytes = javaClass.getResourceAsStream("/maps/box.glb")!!.use { it.readBytes() }
        val original = GlbDocument(bytes)
        val tagged = GlbDocument(mapNamedGlb(bytes))
        assertEquals(original.json.without("nodes"), tagged.json.without("nodes"))
        original.json.rows("nodes").forEachIndexed { index, node ->
            assertEquals(node.without("name"), tagged.json.rows("nodes")[index].without("name"))
            assertEquals("$MAP_NODE_NAME$index", tagged.json.rows("nodes")[index].string("name"))
        }
        val first = original.parts()
        val after = tagged.parts()
        assertEquals(first.size, after.size)
        first.zip(after).forEach { (a, b) ->
            assertEquals(a.node, b.node)
            assertEquals(a.primitive, b.primitive)
            assertContentEquals(a.geometry.positions, b.geometry.positions)
            assertContentEquals(a.geometry.indices, b.geometry.indices)
        }
    }
}
