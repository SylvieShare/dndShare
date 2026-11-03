package ru.dndshare.client

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import java.io.File
import java.io.IOException
import kotlin.test.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import org.junit.Test
import ru.dndshare.client.maps.*

class MapModelCatalogueTest {
    private val original = MapModel("floor", "floor", "Пол", groupName = "Старое имя")
    private val updated = original.copy(name = "Обновлённый пол", groupName = "Новое имя")

    private fun folder() =
        File(
            ApplicationProvider.getApplicationContext<Context>().cacheDir,
            "catalogue-${System.nanoTime()}",
        )

    @Test
    fun cachedCatalogueStaysUnconfirmedUntilFreshReplyAndCannotDismissSaveFailure() =
        runBlocking<Unit> {
            val root = folder()
            val store = MapWorkspaceStore(root)
            store.models(listOf(original))
            val state = MutableStateFlow(MapEditorState(error = "Ошибка сохранения карты"))
            val fresh = CompletableDeferred<List<MapModel>>()
            val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
            val owner = MapModelCatalogue(state, store, { fresh.await() }, scope)
            try {
                val request = scope.launch { owner.load() }
                withTimeout(5000) { state.first { it.models.isNotEmpty() } }
                assertFalse(state.value.modelsFresh)
                assertFalse(state.value.modelLoading)
                assertTrue(state.value.modelRefreshing)
                fresh.complete(listOf(updated))
                request.join()
                assertTrue(state.value.modelsFresh)
                assertEquals("Ошибка сохранения карты", state.value.error)
                assertEquals(updated, store.models()?.single())
            } finally {
                scope.cancel()
                root.deleteRecursively()
            }
        }

    @Test
    fun adminSaveInvalidatesLateMetadataAndPersistedCacheContainsTheNewModel() =
        runBlocking<Unit> {
            val root = folder()
            val store = MapWorkspaceStore(root)
            val state =
                MutableStateFlow(
                    MapEditorState(
                        models = listOf(original),
                        modelLoading = false,
                        modelsFresh = true,
                    )
                )
            val stale = CompletableDeferred<List<MapModel>>()
            val started = CompletableDeferred<Unit>()
            val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
            val owner =
                MapModelCatalogue(
                    state,
                    store,
                    {
                        started.complete(Unit)
                        stale.await()
                    },
                    scope,
                )
            try {
                val request = scope.async { owner.refresh() }
                withTimeout(5000) { started.await() }
                withContext(Dispatchers.Main) { owner.adopt(updated) }
                stale.complete(listOf(original))
                assertEquals(updated, request.await().single())
                withTimeout(5000) { while (store.models()?.singleOrNull() != updated) delay(20) }
                assertEquals(updated, state.value.models.single())
            } finally {
                scope.cancel()
                root.deleteRecursively()
            }
        }

    @Test
    fun failureOfAnOlderRefreshCannotReplaceTheStatusOfANewerSuccessfulRefresh() =
        runBlocking<Unit> {
            val root = folder()
            val store = MapWorkspaceStore(root)
            val state = MutableStateFlow(MapEditorState())
            val stale = CompletableDeferred<List<MapModel>>()
            var calls = 0
            val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
            val owner =
                MapModelCatalogue(
                    state,
                    store,
                    { if (++calls == 1) stale.await() else listOf(updated) },
                    scope,
                )
            try {
                val old = scope.launch { owner.load() }
                withTimeout(5000) { while (calls == 0) delay(10) }
                assertEquals(updated, owner.refresh().single())
                stale.completeExceptionally(IOException("Старое соединение прервалось"))
                old.join()
                assertNull(state.value.modelError)
                assertFalse(state.value.modelRefreshing)
                assertTrue(state.value.modelsFresh)
            } finally {
                scope.cancel()
                root.deleteRecursively()
            }
        }
}
