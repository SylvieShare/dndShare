package ru.dndshare.client

import android.content.Context
import androidx.room3.Room
import androidx.test.core.app.ApplicationProvider
import kotlin.test.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.data.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.character.*

class SheetContentLoadingTest {
    @Test
    fun recordsResolveIndependentlyAndFailedLoadingSettlesWithoutErasingCachedItems() =
        runBlocking {
            val db =
                buildDatabase(
                    Room.inMemoryDatabaseBuilder<ClientDatabase>(
                        ApplicationProvider.getApplicationContext<Context>()
                    )
                )
            val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
            val sheet =
                CharacterSheet(
                    "DND5",
                    1,
                    buildJsonObject {
                        put(
                            "values",
                            buildJsonObject {
                                put(
                                    "abilities_class",
                                    buildJsonArray {
                                        add(buildJsonObject { put("id", 1) })
                                        add(buildJsonObject { put("id", 2) })
                                    },
                                )
                            },
                        )
                    },
                    1,
                    sourceId = 1,
                )
            val snapshot = MutableStateFlow<SheetSnapshot?>(SheetSnapshot(sheet, SheetDraft()))
            val fetching = MutableStateFlow(true)
            val reader =
                SheetContentReader(
                    db.cache(),
                    snapshot,
                    flowOf(null),
                    1,
                    scope,
                    fetching = fetching,
                )
            val collect = scope.launch { reader.state.collect() }
            try {
                withTimeout(10000) {
                    reader.state.first { it.resolvedIds.containsAll(listOf(1L, 2L)) }
                }
                fun record(id: Long) =
                    CachedItem(
                        1,
                        id,
                        17,
                        "item$id",
                        "",
                        "",
                        "",
                        false,
                        1,
                        WireJson.encodeToString(CatalogueItem(id, 17, "item$id")),
                    )
                db.cache().upsertItems(listOf(record(1)))
                val partial = withTimeout(10000) { reader.state.first { 1L in it.items } }
                assertTrue(partial.fetching)
                assertFalse(2L in partial.items)
                fetching.value = false
                val settled = withTimeout(10000) { reader.state.first { !it.fetching } }
                assertTrue(2L in settled.resolvedIds)
                assertEquals("item1", settled.items[1]?.name)
                fetching.value = true
                val retry = withTimeout(10000) { reader.state.first { it.fetching } }
                assertEquals("item1", retry.items[1]?.name)
                db.cache().upsertItems(listOf(record(2)))
                val complete = withTimeout(10000) { reader.state.first { 2L in it.items } }
                assertEquals("item1", complete.items[1]?.name)
                assertEquals("item2", complete.items[2]?.name)
            } finally {
                collect.cancelAndJoin()
                scope.cancel()
                db.close()
            }
        }
}
