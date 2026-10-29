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
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.*
import org.junit.Test
import org.junit.runner.RunWith
import ru.dndshare.client.data.*
import ru.dndshare.client.model.WireJson

@RunWith(AndroidJUnit4::class)
class SheetFormsStorageTest {
    @Test
    fun migrationFromVersionTwoKeepsTheServerDocumentAndPendingPacket() = runTest {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val name = "form-migration-${UUID.randomUUID()}.db"
        val path = context.getDatabasePath(name)
        path.parentFile!!.mkdirs()
        val raw =
            InstrumentationRegistry.getInstrumentation()
                .context
                .assets
                .open("ru.dndshare.client.data.ClientDatabase/2.json")
                .bufferedReader()
                .use { it.readText() }
        val schema = WireJson.parseToJsonElement(raw).jsonObject.getValue("database").jsonObject
        BundledSQLiteDriver().open(path.absolutePath).use { connection ->
            schema.getValue("entities").jsonArray.forEach { entity ->
                val row = entity.jsonObject
                connection.execSQL(
                    row.getValue("createSql")
                        .jsonPrimitive
                        .content
                        .replace("\${TABLE_NAME}", row.getValue("tableName").jsonPrimitive.content)
                )
            }
            schema.getValue("setupQueries").jsonArray.forEach {
                connection.execSQL(it.jsonPrimitive.content)
            }
            connection.execSQL("PRAGMA user_version=2")
            connection.execSQL(
                "INSERT INTO character_sheets(uuid,payload,draft) VALUES('hero','server-document','immutable-packet')"
            )
            connection.execSQL(
                "INSERT INTO character_sheet_sections(uuid,section,payload) VALUES('hero','journal','cached-journal')"
            )
        }
        val database = buildDatabase(Room.databaseBuilder<ClientDatabase>(context, name))
        try {
            val dao = database.characterSheets()
            assertEquals(
                CachedCharacterSheet("hero", "server-document", "immutable-packet"),
                dao.get("hero"),
            )
            dao.putForm(CachedSheetForm("hero", "one", "original-baseline"))
            dao.putForm(CachedSheetForm("hero", "two", "another-window"))
            assertEquals("original-baseline", dao.form("hero", "one")?.baseline)
            assertEquals("another-window", dao.form("hero", "two")?.baseline)
        } finally {
            database.close()
            context.deleteDatabase(name)
        }
    }

    @Test
    fun acceptingTheOutboxAndConsumingTheFormRollBackTogether() = runTest {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val name = "form-atomic-${UUID.randomUUID()}.db"
        var database = buildDatabase(Room.databaseBuilder<ClientDatabase>(context, name))
        try {
            val dao = database.characterSheets()
            val original = CachedCharacterSheet("hero", "original")
            dao.put(original)
            dao.putForm(CachedSheetForm("hero", "one", "original-baseline"))
            // Install the failure trigger while Room has no background WAL/invalidation work.
            database.close()
            BundledSQLiteDriver().open(context.getDatabasePath(name).absolutePath).use { connection
                ->
                connection.execSQL(
                    "CREATE TRIGGER reject_form BEFORE DELETE ON character_sheet_forms BEGIN SELECT RAISE(ABORT,'test interruption'); END"
                )
            }
            database = buildDatabase(Room.databaseBuilder<ClientDatabase>(context, name))
            val reopened = database.characterSheets()
            val failure = assertFails {
                reopened.acceptForm(original.copy(draft = "new-packet"), "one")
            }
            assertTrue(
                generateSequence(failure) { it.cause }
                    .any { it.message?.contains("test interruption") == true }
            )
            assertEquals(original, reopened.get("hero"))
            assertNotNull(reopened.form("hero", "one"))
        } finally {
            database.close()
            context.deleteDatabase(name)
        }
    }

    @Test
    fun updatingInputsKeepsTheImmutableBaselineAndCannotRecreateAnAcceptedForm() = runTest {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val name = "form-inputs-${UUID.randomUUID()}.db"
        val database = buildDatabase(Room.databaseBuilder<ClientDatabase>(context, name))
        try {
            val dao = database.characterSheets()
            val baseline = "immutable-" + "x".repeat(1024 * 1024)
            dao.putForm(CachedSheetForm("hero", "one", baseline))
            dao.putForm(CachedSheetForm("hero", "two", "other-baseline", "other-input"))
            repeat(20) { index ->
                assertEquals(1, dao.updateFormInputs("hero", "one", "input-$index"))
            }
            assertEquals(baseline, dao.form("hero", "one")?.baseline)
            assertEquals("input-19", dao.form("hero", "one")?.inputs)
            assertEquals("other-input", dao.form("hero", "two")?.inputs)
            dao.removeForm("hero", "one")
            assertEquals(0, dao.updateFormInputs("hero", "one", "stale-input"))
            assertNull(dao.form("hero", "one"))
        } finally {
            database.close()
            context.deleteDatabase(name)
        }
    }

    @Test
    fun liveCheckpointPreservesNewerInputAndRollsBackWithTheOutbox() = runTest {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val name = "live-checkpoint-${UUID.randomUUID()}.db"
        var database = buildDatabase(Room.databaseBuilder<ClientDatabase>(context, name))
        try {
            var dao = database.characterSheets()
            dao.put(CachedCharacterSheet("hero", "original", "old-outbox"))
            dao.putForm(CachedSheetForm("hero", "live", "base-1", "latest-input"))
            dao.checkpointForm(
                CachedCharacterSheet("hero", "original", "accepted-outbox"),
                CachedSheetForm("hero", "live", "base-2", "stale-input"),
            )
            assertEquals("latest-input", dao.form("hero", "live")?.inputs)
            assertEquals("base-2", dao.form("hero", "live")?.baseline)
            database.close()
            BundledSQLiteDriver().open(context.getDatabasePath(name).absolutePath).use { connection
                ->
                connection.execSQL(
                    "CREATE TRIGGER reject_checkpoint BEFORE UPDATE OF baseline ON character_sheet_forms BEGIN SELECT RAISE(ABORT,'test interruption'); END"
                )
            }
            database = buildDatabase(Room.databaseBuilder<ClientDatabase>(context, name))
            dao = database.characterSheets()
            assertFails {
                dao.checkpointForm(
                    CachedCharacterSheet("hero", "original", "uncommitted-outbox"),
                    CachedSheetForm("hero", "live", "base-3"),
                )
            }
            assertEquals("accepted-outbox", dao.get("hero")?.draft)
            assertEquals("base-2", dao.form("hero", "live")?.baseline)
            assertEquals("latest-input", dao.form("hero", "live")?.inputs)
        } finally {
            database.close()
            context.deleteDatabase(name)
        }
    }
}
