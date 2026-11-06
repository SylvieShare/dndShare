package ru.dndshare.client.mechanics

import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.mutableStateOf
import androidx.room3.Room
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import coil3.ImageLoader
import kotlin.test.assertNull
import org.junit.Test
import ru.dndshare.client.SheetStateServer
import ru.dndshare.client.TouchRobot
import ru.dndshare.client.character.*
import ru.dndshare.client.data.ClientDatabase
import ru.dndshare.client.data.buildDatabase
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.character.*
import ru.dndshare.client.ui.designsystem.ShareTheme
import kotlinx.serialization.json.jsonObject

class PotionFieldsUiTest {
    @Test fun thePotionEditorOmitsTheOrdinaryEquipmentSwitch() {
        val app = InstrumentationRegistry.getInstrumentation().targetContext
        val db = buildDatabase(Room.inMemoryDatabaseBuilder<ClientDatabase>(app))
        val images = ImageLoader.Builder(app).build()
        val potion = CatalogueItem(84, 10, "Зелье лечения")
        val torch = CatalogueItem(42, 2, "Факел")
        val items = listOf(potion, torch).associateBy { it.id }
        val sheet = SheetStateServer().sheet.copy(data = WireJson.parseToJsonElement("""
            {"values":{"items":{"sections":[{"id":"bag","items":[
                {"uid":"dose","item_id":84,"count":2,"override":{"consumable":false}},
                {"uid":"torch","item_id":42,"count":1}]}]}}}
        """.trimIndent()).jsonObject)
        val context = SheetContext(sheet, HandbookMetadata(), items, images, true, {}, {}, DndDerivedValues(sheet, items), SheetJournalState())
        val uid = mutableStateOf("torch")
        try {
            ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
                scenario.onActivity { host -> host.setContent {
                    ShareTheme { CompositionLocalProvider(LocalCharacterSheet provides context) {
                        val editor = SheetEditorState(initialForm("inventory:${uid.value}", sheet, items), sheet)
                        Column { InventoryFeatureFields(FeatureFormScope(editor, { _, _ -> }), db.cache()) }
                    } }
                } }
                TouchRobot.await { TouchRobot.find("Расходуемое") != null }
                scenario.onActivity { uid.value = "dose" }
                TouchRobot.await { TouchRobot.find("Зелье лечения") != null }
                assertNull(TouchRobot.find("Расходуемое"))
            }
        } finally { images.shutdown(); db.close() }
    }
}
