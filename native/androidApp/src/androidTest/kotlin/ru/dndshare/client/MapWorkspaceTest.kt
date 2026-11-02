package ru.dndshare.client

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import java.io.File
import java.io.IOException
import kotlin.test.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.first
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.network.ApiException

class MapWorkspaceTest {
    @Test
    fun recreatedStoresSerializeWritesAndDeletionRejectsLateCallbacks(): Unit = runBlocking {
        val root =
            File(
                ApplicationProvider.getApplicationContext<Context>().cacheDir,
                "map-stores-${System.nanoTime()}",
            )
        val first = MapWorkspaceStore(root)
        val second = MapWorkspaceStore(root)
        val base = first.open(BattleMap(id = "map", revision = 1))
        coroutineScope {
            (2L..32L)
                .map { version ->
                    async(Dispatchers.Default) {
                        (if (version % 2 == 0L) first else second).put(
                            base.copy(
                                current = base.current.copy(name = "Правка $version"),
                                localVersion = version,
                            )
                        )
                    }
                }
                .awaitAll()
        }
        val latest = requireNotNull(second.readWork("map"))
        assertEquals(32L, latest.localVersion)
        assertEquals("Правка 32", latest.current.name)
        first.forget("map")
        second.put(latest.copy(localVersion = 64))
        assertNull(first.readWork("map"))
        assertTrue(second.drafts().isEmpty())
        assertTrue(second.cached("own").orEmpty().none { it.id == "map" })
        root.deleteRecursively()
    }

    @Test
    fun conflictCanBeCopiedAndExplicitReloadCannotResurrectAnOlderQueue(): Unit = runBlocking {
        val root =
            File(
                ApplicationProvider.getApplicationContext<Context>().cacheDir,
                "map-conflict-${System.nanoTime()}",
            )
        val store = MapWorkspaceStore(root)
        var remote = BattleMap(id = "original", revision = 1)
        val api =
            object : UnusedMapsApi() {
                override suspend fun get(id: String) = remote

                override suspend fun patch(id: String, packet: MapPacket): MapChange =
                    throw ApiException(409, "CONFLICT", "Карта изменилась")

                override suspend fun create(map: BattleMap) = map.copy(id = "copied", revision = 1)
            }
        val controller =
            withContext(Dispatchers.Main) {
                MapEditorController(api, store).also { it.open("original") }
            }
        withTimeout(5000) { controller.state.first { it.work != null && !it.loading } }
        withContext(Dispatchers.Main) {
            controller.change { it.copy(name = "Несохранённая") }
            assertFalse(controller.flush())
        }
        assertTrue(controller.state.value.conflict)
        val stale = requireNotNull(store.readWork("original"))
        val copy = withContext(Dispatchers.Main) { controller.saveLocalCopy() }
        assertEquals("Несохранённая · копия", copy.name)
        assertEquals("copied", store.readWork("copied")?.current?.id)
        assertTrue(store.cached("own").orEmpty().any { it.id == "copied" })
        assertFalse(requireNotNull(store.readWork("original")).dirty)
        remote = remote.copy(name = "С сервера", revision = 8)
        withContext(Dispatchers.Main) { controller.reload() }
        withTimeout(5000) {
            controller.state.first { it.work?.confirmed?.revision == 8L && !it.saving }
        }
        store.put(stale)
        assertEquals("С сервера", store.readWork("original")?.current?.name)
        assertFalse(controller.state.value.conflict)
        withContext(Dispatchers.Main) { controller.close() }
        root.deleteRecursively()
    }

    @Test
    fun pendingPacketIsRecoveredAfterLostAcknowledgement(): Unit = runBlocking {
        val directory =
            File(
                ApplicationProvider.getApplicationContext<Context>().cacheDir,
                "map-work-${System.nanoTime()}",
            )
        val store = MapWorkspaceStore(directory)
        val record = BattleMap(id = "saved", revision = 1)
        store.open(record)
        var first = true
        var accepted: MapPacket? = null
        val api =
            object : UnusedMapsApi() {
                override suspend fun get(id: String) = record

                override suspend fun patch(id: String, packet: MapPacket): MapChange {
                    if (first) {
                        accepted = packet
                        first = false
                        throw IOException("lost response")
                    }
                    assertEquals(accepted, packet)
                    return MapChange(2, patches = packet.patches)
                }
            }
        val controller =
            withContext(Dispatchers.Main) {
                MapEditorController(api, store).also { it.open("saved") }
            }
        withTimeout(5000) { controller.state.first { it.work != null && !it.loading } }
        withContext(Dispatchers.Main) {
            controller.change { it.copy(name = "Локальная") }
            assertFalse(controller.flush())
        }
        assertEquals(
            requireNotNull(accepted).mutationId,
            store.readWork("saved")?.sending?.mutationId,
        )
        withContext(Dispatchers.Main) { controller.close() }
        val reopened = MapWorkspaceStore(directory)
        val second =
            withContext(Dispatchers.Main) {
                MapEditorController(api, reopened).also { it.open("saved") }
            }
        withTimeout(5000) { second.state.first { it.work != null && !it.loading } }
        withContext(Dispatchers.Main) {
            assertTrue(second.flush())
            second.close()
        }
        assertFalse(reopened.readWork("saved")!!.dirty)
        assertEquals("Локальная", reopened.readWork("saved")!!.current.name)
        directory.deleteRecursively()
    }

    @Test
    fun staleBackgroundWritesDoNotRollBackNewerDraftsAndActorsStaySeparate(): Unit = runBlocking {
        val root =
            File(
                ApplicationProvider.getApplicationContext<Context>().cacheDir,
                "map-actors-${System.nanoTime()}",
            )
        val store = MapWorkspaceStore(File(root, "one"))
        val other = MapWorkspaceStore(File(root, "two"))
        val initial = store.open(BattleMap(id = "saved", revision = 1))
        val newer = initial.copy(current = initial.current.copy(name = "Новая"), localVersion = 12)
        store.put(newer)
        store.put(initial)
        assertEquals("Новая", store.readWork("saved")?.current?.name)
        assertNull(other.readWork("saved"))
        assertEquals(newer, MapWorkspaceStore(File(root, "one")).readWork("saved"))
        root.deleteRecursively()
    }
}
