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
        val tagged = GlbDocument(prepareMapModel(bytes).bytes)
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

    @Test
    fun mixedMeshesSeparateAlphaRenderStateWithoutChangingTrianglesOrLogicalParts() {
        val bytes = javaClass.getResourceAsStream("/maps/flat-mixed.glb")!!.use { it.readBytes() }
        val original = GlbDocument(bytes)
        val prepared = prepareMapModel(bytes)
        val tagged = GlbDocument(prepared.bytes)
        val expected = original.parts().associateBy { MapPrimitiveRef(it.node, it.primitive) }
        val actual =
            tagged.parts().associateBy { part ->
                val tag = mapNamedPart(tagged.json.rows("nodes")[part.node].string("name"))!!
                MapPrimitiveRef(tag.node, tag.primitive ?: part.primitive)
            }
        assertEquals(expected.keys, actual.keys)
        for ((key, before) in expected) {
            val after = actual.getValue(key)
            assertContentEquals(before.geometry.positions, after.geometry.positions)
            assertContentEquals(before.geometry.indices, after.geometry.indices)
            assertEquals(before.material, after.material)
            assertEquals(before.material, prepared.materials[key])
        }
        assertTrue(tagged.json.rows("nodes").size > original.json.rows("nodes").size)
    }
}
