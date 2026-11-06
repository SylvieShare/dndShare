package ru.dndshare.client

import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.*
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.lifecycleScope
import ru.dndshare.client.ui.designsystem.ShareAction
import androidx.room3.Room
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import coil3.ImageLoader
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.first
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.data.ClientDatabase
import ru.dndshare.client.data.buildDatabase
import ru.dndshare.client.model.HandbookMetadata
import ru.dndshare.client.ui.character.*
import ru.dndshare.client.ui.designsystem.ShareTheme

class SkillEditorSyncTest {
    @Test
    fun rankAndTotalUpdateAndWindowClosesBeforeServerReplies() = runBlocking<Unit> {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val name = "skill-sync-${UUID.randomUUID()}.db"
        val db = buildDatabase(Room.databaseBuilder<ClientDatabase>(context, name))
        val server = SheetStateServer()
        val started = CompletableDeferred<Unit>()
        val release = CompletableDeferred<Unit>()
        val delayed = object : CharacterSheetApi by server {
            override suspend fun saveCharacter(uuid: String, packet: SheetPacket): SheetChange {
                started.complete(Unit)
                release.await()
                return server.saveCharacter(uuid, packet)
            }
        }
        val sheets = CharacterSheetRepository(delayed, db.characterSheets(), 1)
        val images = ImageLoader.Builder(context).build()
        try {
            sheets.refresh("hero")
            val sheet = sheets.local("hero")!!.displayed
            val metadata = HandbookMetadata()
            ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
                scenario.onActivity { host ->
                    val controller = SheetEditorController("hero", 1, SavedStateHandle(), db.characterSheets(), sheets, host.lifecycleScope)
                    controller.liveContext = { LiveStatContext(emptyMap(), metadata, null) }
                    val sheetContext = SheetContext(sheet, metadata, emptyMap(), images, true, {}, {},
                        DndDerivedValues(sheet, emptyMap(), metadata), SheetJournalState())
                    host.setContent {
                        val editor by controller.state.collectAsState()
                        val restoring by controller.restoring.collectAsState()
                        ShareTheme {
                            CompositionLocalProvider(LocalCharacterSheet provides sheetContext) {
                                if (!restoring && editor == null) ShareAction("Скрытность", { controller.open("skill:DEX:4", sheet) })
                                editor?.let { current ->
                                    SheetStatDialog(current, controller::dismiss, controller::number, controller::input,
                                        { controller.state.value!!.fields.input }, syncError = null, retry = {})
                                }
                            }
                        }
                    }
                }
                TouchRobot.click("Скрытность")
                TouchRobot.click("Компетентность")
                withTimeout(10_000) { started.await() }
                TouchRobot.await("Expertise total while sending") { TouchRobot.find("+4") != null }
                TouchRobot.click("Без владения")
                TouchRobot.await("New total before acknowledgement") { TouchRobot.find("+0") != null }
                TouchRobot.click("Закрыть окно")
                TouchRobot.await("Can dismiss offline") { TouchRobot.find("Закрыть окно") == null }
                assertNull(db.characterSheets().openForms().firstOrNull())
                val pending = requireNotNull(sheets.local("hero"))
                assertEquals(0, pending.displayed.values["DEX"].objectValue()["skills"].objectValue()["4"].objectValue()["up"].number())
                release.complete(Unit)
                withTimeout(10_000) { sheets.observe("hero").first { it != null && it.draft.edits.isEmpty() } }
            }
        } finally {
            release.complete(Unit)
            sheets.closeAndJoin()
            images.shutdown()
            db.close()
            context.deleteDatabase(name)
        }
    }
}
