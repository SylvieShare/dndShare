package ru.dndshare.client

import android.content.Context
import androidx.room3.Room
import androidx.sqlite.driver.bundled.BundledSQLiteDriver
import androidx.sqlite.execSQL
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.util.UUID
import kotlin.test.*
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import org.junit.runner.RunWith
import ru.dndshare.client.character.*
import ru.dndshare.client.data.*
import ru.dndshare.client.model.*

@RunWith(AndroidJUnit4::class)
class CharacterSheetStorageTest {
    @Test
    fun acknowledgedUndoHistoryIsNotAnUnsavedDraft() = runTest {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val db = buildDatabase(Room.inMemoryDatabaseBuilder<ClientDatabase>(context))
        try {
            val before = WireJson.parseToJsonElement("""{"values":{"name":"Лира"}}""").jsonObject
            val step =
                sheetHistoryStep(
                    before,
                    listOf(
                        SheetPatch(
                            path = sheetPath("values", "name"),
                            value = JsonPrimitive("Торин"),
                        )
                    ),
                )
            val historyOnly = SheetDraft(undo = listOf(step))
            db.characterSheets()
                .put(CachedCharacterSheet("history", "{}", WireJson.encodeToString(historyOnly)))
            assertTrue(db.characterSheets().pending().isEmpty())
            db.characterSheets()
                .put(
                    CachedCharacterSheet(
                        "pending",
                        "{}",
                        WireJson.encodeToString(historyOnly.copy(edits = listOf(step.redo))),
                    )
                )
            assertEquals(listOf("pending"), db.characterSheets().pending())
        } finally {
            db.close()
        }
    }

    @Test
    fun migrationKeepsTheInstalledCatalogueAndCharacterList() = runTest {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val name = "sheet-migration-${UUID.randomUUID()}.db"
        val path = context.getDatabasePath(name)
        path.parentFile!!.mkdirs()
        val json =
            InstrumentationRegistry.getInstrumentation()
                .context
                .assets
                .open("ru.dndshare.client.data.ClientDatabase/1.json")
                .bufferedReader()
                .use { it.readText() }
        val schema = WireJson.parseToJsonElement(json).jsonObject.getValue("database").jsonObject
        BundledSQLiteDriver().open(path.absolutePath).use { connection ->
            for (raw in schema.getValue("entities").jsonArray) {
                val entity = raw.jsonObject
                connection.execSQL(
                    entity
                        .getValue("createSql")
                        .jsonPrimitive
                        .content
                        .replace(
                            "\${TABLE_NAME}",
                            entity.getValue("tableName").jsonPrimitive.content,
                        )
                )
            }
            schema.getValue("setupQueries").jsonArray.forEach {
                connection.execSQL(it.jsonPrimitive.content)
            }
            connection.execSQL("PRAGMA user_version=1")
            connection.execSQL(
                "INSERT INTO catalogue_sync(sourceId,cursor,resumeCursor,lastSyncedAt,ready) VALUES(1,'keep-cursor',NULL,NULL,1)"
            )
            connection.execSQL(
                "INSERT INTO catalogue_items(sourceId,id,typeId,name,nameEn,searchText,editionKeys,hidden,revision,payload) VALUES(1,1,5,'keep','','keep','|1|',0,1,'{}')"
            )
            connection.execSQL("INSERT INTO characters(id,payload) VALUES(7,'{}')")
        }
        val db = buildDatabase(Room.databaseBuilder<ClientDatabase>(context, name))
        try {
            assertNull(db.cache().syncState(1)?.cursor)
            assertFalse(db.cache().syncState(1)?.ready ?: true)
            assertEquals(listOf(1L), db.cache().itemIds(1))
            assertEquals(7L, db.cache().observeCharacters().first().single().id)
            db.characterSheets().put(CachedCharacterSheet("test", "{}"))
            assertEquals("{}", db.characterSheets().get("test")?.payload)
        } finally {
            db.close()
            context.deleteDatabase(name)
        }
    }

    @Test
    fun expiredAuthenticationKeepsEncryptedDraftsScopedToTheirOwner() = runTest {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val device = MemoryDeviceServices()
        val db = buildDatabase(Room.inMemoryDatabaseBuilder<ClientDatabase>(context))
        val sheet =
            CharacterSheet("DND5", 7, buildJsonObject { put("values", JsonObject(emptyMap())) }, 1)
        val row =
            CachedCharacterSheet(
                "private",
                WireJson.encodeToString(sheet),
                WireJson.encodeToString(SheetDraft(blocked = "offline")),
            )
        try {
            db.characterSheets().put(row)
            retainCharacterDrafts(device, 7, db)
            val other = buildDatabase(Room.inMemoryDatabaseBuilder<ClientDatabase>(context))
            try {
                restoreCharacterDrafts(device, 8, other)
                assertNull(other.characterSheets().get("private"))
                restoreCharacterDrafts(device, 7, other)
                assertEquals(row, other.characterSheets().get("private"))
            } finally {
                other.close()
            }
            discardCharacterDraftBackup(device, 7)
        } finally {
            db.close()
        }
    }
}
