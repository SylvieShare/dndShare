package ru.dndshare.client

import androidx.test.platform.app.InstrumentationRegistry
import kotlin.math.abs
import kotlin.test.*
import org.junit.Test
import ru.dndshare.client.maps.geometry.*

class MapTextureCodecTest {
    @Test
    fun basisAndUastcTexturesDecodeWithBoundedMipResolution() {
        val assets = InstrumentationRegistry.getInstrumentation().context.assets
        for (codec in listOf("basis-lz", "uastc")) {
            val bytes = assets.open("maps/checker-$codec.ktx2").use { it.readBytes() }
            for (size in listOf(32, 16)) {
                val bitmap = MapTextureCodec.decode(bytes, size)
                try {
                    assertEquals(size, bitmap.width)
                    assertEquals(size, bitmap.height)
                    for ((x, expected) in
                        listOf(
                            2 to intArrayOf(190, 65, 30),
                            (size - 3) to intArrayOf(35, 130, 200),
                        )) {
                        val pixel = bitmap.getPixel(x, size / 2)
                        val actual =
                            intArrayOf(
                                android.graphics.Color.red(pixel),
                                android.graphics.Color.green(pixel),
                                android.graphics.Color.blue(pixel),
                            )
                        actual.indices.forEach {
                            assertTrue(
                                abs(expected[it] - actual[it]) <= 12,
                                "$codec mip $size: ${actual.toList()}",
                            )
                        }
                    }
                } finally {
                    bitmap.recycle()
                }
            }
        }
    }

    @Test
    fun compressedCpuGeometryIsAvailableForPrecisePicking() {
        val assets = InstrumentationRegistry.getInstrumentation().context.assets
        val model = GlbDocument(assets.open("maps/box-meshopt.glb").use { it.readBytes() }).parts()
        val hit =
            assertNotNull(mapSurfaceIntersection(model, Vec3(.123f, 2f, .234f), Vec3(0f, -1f, 0f)))
        assertEquals(.5f, hit.position.y, .0001f)
        assertTrue(hit.normal.y > .99f)
    }
}
