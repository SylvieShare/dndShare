package ru.dndshare.client

import android.content.Context
import androidx.room3.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import org.junit.Test
import org.junit.runner.RunWith
import kotlin.test.*
import ru.dndshare.client.data.*
import ru.dndshare.client.model.*

@RunWith(AndroidJUnit4::class)
class HandbookFiltersTest {
    @Test fun schemaAndPublicationFiltersApplyToTheFullOfflineDatabaseBeforePagination() = runTest {
        val db = buildDatabase(Room.inMemoryDatabaseBuilder<ClientDatabase>(ApplicationProvider.getApplicationContext<Context>()))
        try {
            val records = (1L..121L).map { id ->
                val item = CatalogueItem(id, 5, "Запись $id", data = buildJsonObject {
                    put("schoolId", if (id == 121L) 7 else 2)
                    put("kind", if (id == 121L) "rare" else "common")
                    put("ritual", id == 121L)
                    put("tags", JsonArray(listOf(JsonPrimitive(if (id == 121L) 99 else 1))))
                    put("time", buildJsonObject { put("kind", if (id == 121L) "reaction" else "action") })
                }, contentSources = listOf(Book(if (id == 121L) 9 else 3, "Источник")))
                CachedItem(1, id, 5, item.name, "", item.name.lowercase(), "|1|", false, 1, WireJson.encodeToString(item))
            }
            db.cache().upsertItems(records)
            for (filter in listOf("""{"schoolId":[7]}""", """{"kind":["rare"]}""", """{"ritual":[true]}""",
                """{"tags":[99]}""", """{"time.kind":["reaction"]}""")) {
                assertEquals(listOf(121L), db.cache().observeItems(1, 5, "%|1|%", "%", 1, filters = filter).first().map { it.id })
                assertEquals(1, db.cache().observeFilteredCount(1, 5, "%|1|%", "%", filters = filter).first())
            }
            assertEquals(listOf(121L), db.cache().observeItems(1, 5, "", "%", 1, books = "[9]").first().map { it.id })
            assertTrue(db.cache().observeItems(1, 5, "", "%", 1, books = "[9]", filters = """{"schoolId":[2]}""").first().isEmpty())
            assertEquals(121, db.cache().observeFilteredCount(1, 5, "", "%").first())
        } finally { db.close() }
    }
}
