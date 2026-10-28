package ru.dndshare.client

import java.io.IOException
import kotlin.test.*
import kotlinx.coroutines.*
import kotlinx.coroutines.test.*
import kotlinx.serialization.encodeToString
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.device.SecureStore
import ru.dndshare.client.model.WireJson

@OptIn(ExperimentalCoroutinesApi::class)
class InventoryIconCacheTest {
    private val preset =
        InventoryIconPreset(12, 2, "Сумка", "item", "https://example.test/icon.webp")

    @Test
    fun restoresOfflineAndCoalescesLoadsThenRetriesWithoutLosingTheCache() = runTest {
        val store = MemoryDeviceServices().secureStore
        store.write(InventoryIconCache.KEY, WireJson.encodeToString(listOf(preset)))
        var calls = 0
        var online = false
        val gate = CompletableDeferred<Unit>()
        val cache =
            InventoryIconCache(
                {
                    calls++
                    gate.await()
                    if (!online) throw IOException("offline")
                    listOf(preset.copy(name = "Новая сумка"))
                },
                store,
                backgroundScope,
                StandardTestDispatcher(testScheduler),
            )
        runCurrent()
        assertEquals(listOf(preset), cache.state.value.presets)
        repeat(5) { cache.load() }
        runCurrent()
        assertEquals(1, calls)
        assertTrue(cache.state.value.loading)
        gate.complete(Unit)
        runCurrent()
        assertFalse(cache.state.value.loading)
        assertEquals(listOf(preset), cache.state.value.presets)
        assertNotNull(cache.state.value.error)
        online = true
        cache.load(force = true)
        runCurrent()
        assertEquals(2, calls)
        assertTrue(cache.state.value.loaded)
        assertNull(cache.state.value.error)
        assertEquals("Новая сумка", cache.state.value.presets.single().name)
        assertEquals(
            cache.state.value.presets,
            WireJson.decodeFromString<List<InventoryIconPreset>>(
                store.read(InventoryIconCache.KEY)!!
            ),
        )
        cache.load()
        runCurrent()
        assertEquals(2, calls)
    }

    @Test
    fun brokenLocalStorageDoesNotPreventFetchingAndUsingIcons() = runTest {
        val broken =
            object : SecureStore {
                override fun keys() = emptySet<String>()

                override fun read(key: String): String? = throw IOException("unreadable")

                override fun write(key: String, value: String?) {
                    throw IOException("read only")
                }
            }
        val cache =
            InventoryIconCache(
                { listOf(preset) },
                broken,
                backgroundScope,
                StandardTestDispatcher(testScheduler),
            )
        cache.load()
        runCurrent()
        assertEquals(listOf(preset), cache.state.value.presets)
        assertTrue(cache.state.value.loaded)
        assertNull(cache.state.value.error)
    }
}
