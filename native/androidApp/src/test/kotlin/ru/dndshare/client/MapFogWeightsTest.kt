package ru.dndshare.client

import kotlin.coroutines.CoroutineContext
import kotlin.test.*
import kotlinx.coroutines.*
import org.junit.Test
import ru.dndshare.client.maps.geometry.VolumeFogField
import ru.dndshare.client.maps.rendering.MapFogWeights

class MapFogWeightsTest {
    private class Gate : CoroutineDispatcher() {
        private val tasks = ArrayDeque<Runnable>()

        override fun dispatch(context: CoroutineContext, block: Runnable) {
            tasks += block
        }

        fun next() {
            tasks.removeFirst().run()
        }
    }

    private fun field() =
        VolumeFogField(
            doubleArrayOf(0.0, 0.0, 0.0),
            doubleArrayOf(1.0, 1.0, 1.0),
            intArrayOf(4, 4, 4),
            ByteArray(64),
            mapOf("area" to intArrayOf((255 shl 22) or 0)),
        )

    @Test
    fun newerWeightsCoalesceAndUseTheLatestDensity() =
        runBlocking<Unit> {
            val field = field()
            val gate = Gate()
            val uploads = mutableListOf<ByteArray>()
            val weights = MapFogWeights(this, { field }, { uploads += it }, {}, gate)
            try {
                weights.update(field, mapOf("area" to .2))
                weights.update(field, mapOf("area" to .5))
                yield()
                gate.next()
                yield()
                withTimeout(1000) { while (weights.working) yield() }
                assertEquals(1, uploads.size)
                assertEquals(128, uploads.single()[0].toInt() and 255)
            } finally {
                weights.close()
            }
        }

    @Test
    fun anOldFieldCannotUploadAfterItsTextureHasBeenReplaced() =
        runBlocking<Unit> {
            val first = field()
            val second = field()
            var current = first
            val gate = Gate()
            val uploads = mutableListOf<ByteArray>()
            val weights = MapFogWeights(this, { current }, { uploads += it }, {}, gate)
            try {
                weights.update(first, mapOf("area" to 1.0))
                yield()
                assertTrue(weights.working)
                current = second
                weights.seed(second, emptyMap())
                weights.update(second, mapOf("area" to .25))
                gate.next()
                yield()
                gate.next()
                yield()
                withTimeout(1000) { while (weights.working) yield() }
                assertEquals(
                    1,
                    uploads.size,
                    "The deleted field's density must not reach the new texture",
                )
                assertEquals(64, uploads.single()[0].toInt() and 255)
            } finally {
                weights.close()
            }
        }
}
