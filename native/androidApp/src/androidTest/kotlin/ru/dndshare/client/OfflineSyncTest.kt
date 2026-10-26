package ru.dndshare.client

import androidx.room3.Room
import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.runner.RunWith
import io.ktor.client.engine.mock.*
import io.ktor.http.*
import java.io.IOException
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.encodeToString
import kotlin.test.*
import ru.dndshare.client.data.*
import ru.dndshare.client.model.*
import ru.dndshare.client.network.*

@RunWith(AndroidJUnit4::class)
class OfflineSyncTest {
    private fun database() = buildDatabase(Room.inMemoryDatabaseBuilder<ClientDatabase>(ApplicationProvider.getApplicationContext<Context>()))
    private fun entry(id: Long, name: String, revision: Long = 1) = SyncEntry(id, revision, "2026-10-26T00:00:00Z", false,
        CatalogueItem(id, 5, name, compatibility = listOf(Compatibility(1, "native"))))
    private fun page(entries: List<SyncEntry>, cursor: String, visible: List<Long>? = null) = SyncPage(
        protocol = 1, entries = entries, hasMore = visible == null,
        nextCursor = cursor.takeIf { visible == null }, cursor = cursor.takeIf { visible != null },
        visibleIds = visible, serverTime = "2026-10-26T01:00:00Z",
    )

    @Test fun interruptedBootstrapResumesDurablyThenWorksOffline() = runTest {
        val db = database()
        val firstApi = ApiClient("https://dndshare.ru", MemoryDeviceServices(), MockEngine { request ->
            if (request.url.parameters["cursor"] != null) throw IOException("offline")
            respond(WireJson.encodeToString(page(listOf(entry(1, "Огонь")), "page-2")), headers = jsonHeaders)
        })
        try {
            assertFailsWith<IOException> { CatalogueRepository(firstApi, db).synchronize(1) {} }
            assertEquals(listOf(1L), db.cache().itemIds(1))
            assertEquals("page-2", db.cache().syncState(1)?.resumeCursor)
            assertFalse(db.cache().syncState(1)!!.ready)
        } finally { firstApi.close() }
        val secondApi = ApiClient("https://dndshare.ru", MemoryDeviceServices(), MockEngine { request ->
            assertEquals("page-2", request.url.parameters["cursor"])
            respond(WireJson.encodeToString(page(listOf(entry(2, "Лёд")), "checkpoint", listOf(1, 2))), headers = jsonHeaders)
        })
        try {
            CatalogueRepository(secondApi, db).synchronize(1) {}
            assertEquals("checkpoint", db.cache().syncState(1)?.cursor)
            assertNull(db.cache().syncState(1)?.resumeCursor)
            assertTrue(db.cache().syncState(1)!!.ready)
        } finally { secondApi.close() }
        try {
            // No network client remains: search and descriptions use SQLite only.
            assertEquals("Огонь", db.cache().observeItems(1, null, "%|1|%", searchPattern("ОГО"), 100).first().single().name)
            assertEquals("Лёд", WireJson.decodeFromString<CatalogueItem>(db.cache().observeItem(1, 2).first()!!).name)
            assertTrue(db.cache().observeItems(2, null, "", "%", 100).first().isEmpty())
        } finally { db.close() }
    }

    @Test fun deletionAndAccessManifestRemoveStaleContentWithoutTouchingOtherSystem() = runTest {
        val db = database()
        var round = 0
        val api = ApiClient("https://dndshare.ru", MemoryDeviceServices(), MockEngine { request ->
            val next = when (round++) {
                0 -> page(listOf(entry(1, "Один"), entry(2, "Два"), entry(3, "Три")), "a", listOf(1, 2, 3))
                1 -> {
                    assertEquals("a", request.url.parameters["cursor"])
                    page(listOf(SyncEntry(2, 5, "now", true)), "b", listOf(3))
                }
                else -> {
                    assertEquals("b", request.url.parameters["cursor"])
                    page(emptyList(), "b", listOf(3))
                }
            }
            respond(WireJson.encodeToString(next), headers = jsonHeaders)
        })
        try {
            val repo = CatalogueRepository(api, db)
            repo.synchronize(1) {}
            db.cache().upsertItems(listOf(CachedItem(2, 1, 5, "Другая система", "", "другая", "|1|", false, 1, "{}")))
            repo.synchronize(1) {}
            assertEquals(listOf(3L), db.cache().itemIds(1))
            assertEquals(listOf(1L), db.cache().itemIds(2))
            repo.synchronize(1) {} // An unchanged checkpoint is valid on an empty delta.
            assertEquals("b", db.cache().syncState(1)?.cursor)
        } finally { api.close(); db.close() }
    }

    @Test fun invalidCheckpointBootstrapsAndDoesNotClearUsableDataBeforeSuccess() = runTest {
        val db = database()
        db.cache().upsertState(SyncState(1, cursor = "old", ready = true))
        var calls = 0
        val api = ApiClient("https://dndshare.ru", MemoryDeviceServices(), MockEngine { request ->
            if (calls++ == 0) {
                assertEquals("old", request.url.parameters["cursor"])
                respond("""{"type":"SYNC_RESET_REQUIRED"}""", HttpStatusCode.Conflict, jsonHeaders)
            } else {
                assertNull(request.url.parameters["cursor"])
                respond(WireJson.encodeToString(page(listOf(entry(4, "Новая запись")), "new", listOf(4))), headers = jsonHeaders)
            }
        })
        try {
            CatalogueRepository(api, db).synchronize(1) {}
            assertEquals(listOf(4L), db.cache().itemIds(1))
            assertEquals("new", db.cache().syncState(1)?.cursor)
        } finally { api.close(); db.close() }
    }

    private val jsonHeaders = headersOf(HttpHeaders.ContentType, "application/json")
}
