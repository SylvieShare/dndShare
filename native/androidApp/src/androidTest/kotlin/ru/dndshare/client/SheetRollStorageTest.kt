package ru.dndshare.client

import android.content.Context
import androidx.room3.Room
import androidx.sqlite.driver.bundled.BundledSQLiteDriver
import androidx.sqlite.execSQL
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.UUID
import kotlin.test.*
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Test
import org.junit.runner.RunWith
import ru.dndshare.client.data.*

@RunWith(AndroidJUnit4::class)
class SheetRollStorageTest {
    @Test
    fun clearingCommandAndPublishingResultRollbackTogether() = runTest {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val name = "roll-receipt-${UUID.randomUUID()}.db"
        var db = buildDatabase(Room.databaseBuilder<ClientDatabase>(context, name))
        try {
            val dao = db.characterSheets()
            dao.put(CachedCharacterSheet("hero", "document"))
            dao.putForm(CachedSheetForm("hero", "one", "baseline"))
            dao.putSection(CachedSheetSection("hero", "remote-command", "pending"))
            db.close()
            BundledSQLiteDriver().open(context.getDatabasePath(name).absolutePath).use { connection
                ->
                connection.execSQL(
                    "CREATE TRIGGER reject_roll_ack BEFORE UPDATE ON character_sheet_sections WHEN NEW.section='remote-command' AND NEW.payload='{}' BEGIN SELECT RAISE(ABORT,'test interruption'); END"
                )
            }
            db = buildDatabase(Room.databaseBuilder<ClientDatabase>(context, name))
            val reopened = db.characterSheets()
            assertFails {
                reopened.acceptCommand(
                    CachedSheetSection("hero", "remote-command", "{}"),
                    "one",
                    CachedSheetSection("hero", "dice-result", "result"),
                )
            }
            assertEquals("pending", reopened.observeSection("hero", "remote-command").first())
            assertNull(reopened.observeSection("hero", "dice-result").first())
            assertNotNull(reopened.form("hero", "one"))
        } finally {
            db.close()
            context.deleteDatabase(name)
        }
    }

    @Test
    fun localResourceOutboxAndResultCheckpointRollbackTogether() = runTest {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val name = "roll-outbox-${UUID.randomUUID()}.db"
        var db = buildDatabase(Room.databaseBuilder<ClientDatabase>(context, name))
        val original = CachedCharacterSheet("hero", "document")
        try {
            db.characterSheets().put(original)
            db.close()
            BundledSQLiteDriver().open(context.getDatabasePath(name).absolutePath).use { connection
                ->
                connection.execSQL(
                    "CREATE TRIGGER reject_roll_result BEFORE INSERT ON character_sheet_sections WHEN NEW.section='dice-result' BEGIN SELECT RAISE(ABORT,'test interruption'); END"
                )
            }
            db = buildDatabase(Room.databaseBuilder<ClientDatabase>(context, name))
            val dao = db.characterSheets()
            assertFails {
                dao.acceptSection(
                    original.copy(draft = "paid-roll-packet"),
                    CachedSheetSection("hero", "dice-result", "result"),
                )
            }
            assertEquals(original, dao.get("hero"))
            assertNull(dao.observeSection("hero", "dice-result").first())
        } finally {
            db.close()
            context.deleteDatabase(name)
        }
    }
}
