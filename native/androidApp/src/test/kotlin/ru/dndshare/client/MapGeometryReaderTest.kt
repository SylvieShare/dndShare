package ru.dndshare.client

import kotlin.test.*
import org.junit.Test
import ru.dndshare.client.maps.geometry.*

class MapGeometryReaderTest {
    private fun box() =
        GlbDocument(
                requireNotNull(javaClass.classLoader.getResourceAsStream("maps/box.glb")).use {
                    it.readBytes()
                }
            )
            .parts()

    @Test
    fun rayHitUsesExactSurfaceRatherThanQuantizedGpuDepth() {
        val hit =
            assertNotNull(
                mapSurfaceIntersection(box(), Vec3(.1234f, 10f, .2345f), Vec3(0f, -1f, 0f))
            )
        assertEquals(.1234f, hit.position.x, .00001f)
        assertEquals(.5f, hit.position.y, .00001f)
        assertEquals(.2345f, hit.position.z, .00001f)
        assertTrue(hit.normal.y > .99f)
        assertNull(mapSurfaceIntersection(box(), Vec3(2f, 10f, 2f), Vec3(0f, -1f, 0f)))
    }

    @Test
    fun projectedStampKeepsItsBoundsAndDoesNotPaintOppositeFaces() {
        val projected =
            projectDecal(
                box().single().geometry,
                Vec3(0f, .5f, 0f),
                Vec3(0f, 1f, 0f),
                .4f,
                .6f,
                .1f,
                25f,
            )
        assertTrue(projected.count > 0)
        assertTrue(projected.positions.all { it.isFinite() })
        assertTrue(projected.uv.all { it in -.00001f..1.00001f })
        for (i in 0 until projected.count) {
            assertEquals(.5008f, projected.position(i).y, .00001f)
            assertTrue(projected.normal(i).y > .99f)
        }
    }

    @Test
    fun glbCpuGeometryMatchesItsWorldSpaceBounds() {
        val bytes =
            requireNotNull(javaClass.classLoader.getResourceAsStream("maps/box.glb")).use {
                it.readBytes()
            }
        val parts = GlbDocument(bytes).parts()
        assertEquals(1, parts.size)
        val geometry = parts.single().geometry
        assertEquals(36, geometry.indices.size)
        val positions = (0 until geometry.count).map(geometry::position)
        assertEquals(-.5f, positions.minOf { it.x }, .0001f)
        assertEquals(.5f, positions.maxOf { it.x }, .0001f)
        assertEquals(-.5f, positions.minOf { it.y }, .0001f)
        assertEquals(.5f, positions.maxOf { it.z }, .0001f)
        assertTrue(geometry.normals.all { it.isFinite() })
    }

    @Test
    fun transformationsInvertWithoutChangingTheInput() {
        val matrix =
            Mat4.trs(
                floatArrayOf(4f, 3f, 2f),
                floatArrayOf(0f, .70710677f, 0f, .70710677f),
                floatArrayOf(-2f, 1.5f, 3f),
            )
        val point = Vec3(.3f, .5f, 1.2f)
        val restored = Mat4.point(Mat4.inverse(matrix), Mat4.point(matrix, point))
        assertEquals(point.x, restored.x, .0001f)
        assertEquals(point.y, restored.y, .0001f)
        assertEquals(point.z, restored.z, .0001f)
    }
}
