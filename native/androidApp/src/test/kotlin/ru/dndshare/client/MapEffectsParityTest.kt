package ru.dndshare.client

import java.security.MessageDigest
import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.geometry.*
import ru.dndshare.client.model.WireJson

class MapEffectsParityTest {
    @Test
    fun effectTimeRemainsPreciseAfterLongDeviceUptime() {
        for (time in listOf(3908.0, 60.0 * 24 * 60 * 60, 100_000_000.0)) {
            val phase = mapEffectPhase(time)
            assertNotEquals(phase.toFloat(), mapEffectPhase(time + .1).toFloat())
            for (frequency in listOf(2.1, 3.2, 4.2, 7.3, 8.7, 9.1, 11.0, 13.1)) {
                assertEquals(
                    kotlin.math.sin(kotlin.math.floor(time * 12) / 12 * frequency),
                    kotlin.math.sin(phase * frequency),
                    1e-6,
                )
            }
        }
    }

    private val fixture =
        WireJson.parseToJsonElement(
                requireNotNull(javaClass.classLoader?.getResourceAsStream("maps/web-effects.json"))
                    .bufferedReader()
                    .use { it.readText() }
            )
            .jsonObject

    private fun hash(bytes: ByteArray) =
        MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }

    @Test
    fun volumeFieldsAndAreaWeightsMatchWebBytes() {
        for (raw in fixture.array("fog")) {
            val test = raw.jsonObject
            val columns =
                test.array("input").map { entry ->
                    val value = entry.jsonObject
                    FogColumn(
                        value.string("areaId"),
                        DoubleArray(3) { value.array("min").double(it) },
                        DoubleArray(3) { value.array("max").double(it) },
                    )
                }
            val field = assertNotNull(buildMapFogField(columns))
            assertContentEquals(
                IntArray(3) { test.array("dimensions").double(it).toInt() },
                field.dimensions,
            )
            for (axis in 0..2) {
                assertEquals(test.array("min").double(axis), field.min[axis], 1e-9)
                assertEquals(test.array("size").double(axis), field.size[axis], 1e-9)
            }
            assertEquals(test.string("full"), hash(field.data))
            field.weights { if (it == "A") .371 else .82 }
            assertEquals(test.string("weighted"), hash(field.data))
        }
    }

    @Test
    fun proceduralNoiseAndFireFollowWebTiming() {
        assertEquals(fixture.string("noise"), hash(mapFogNoise()))
        for (raw in fixture.array("fire")) {
            val test = raw.jsonObject
            val source = test["source"]!!.jsonObject
            val effect = source["effect"]!!.jsonObject
            val motion =
                mapFireMotion(
                    source.string("id"),
                    test.number("milliseconds") / 1000,
                    effect.number("strength"),
                    effect.array("size").double(0),
                    effect.array("size").double(1),
                )
            val expected = test["expected"]!!.jsonObject
            val offset = expected.array("offset")
            assertEquals(offset.double(0).toFloat(), motion.offset.x, 1e-6f)
            assertEquals(offset.double(1).toFloat(), motion.offset.y, 1e-6f)
            assertEquals(offset.double(2).toFloat(), motion.offset.z, 1e-6f)
            assertEquals(expected.number("gain").toFloat(), motion.gain, 1e-6f)
        }
    }
}
