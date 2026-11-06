package ru.dndshare.client

import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import coil3.ImageLoader
import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.LayoutFormat
import ru.dndshare.client.ui.character.*
import ru.dndshare.client.ui.designsystem.*

class WeaponPropertyContinuationTest {
    @Test fun magicUseSitsUnderPropertiesAndOpensIndependently() {
        fun obj(json: String) = WireJson.parseToJsonElement(json).jsonObject
        val base = CatalogueItem(1, 1, "Копьё", data = obj("""{"tags":[6],"attacks":[{"count":1,"dice_id":"d6","type":1}]}"""))
        val magic = CatalogueItem(2, 19, "Копьё молнии", data = obj("""
            {"weapon":{"base_item_id":1},"attunement":"none","weapon_uses":[
             {"key":"bolt","title":"Метнуть молнией","attack_mode":"thrown","range_ft":120,"resource_cost":0,
              "steps":[{"key":"hit","title":"Попадание","kind":"weapon_damage","dice":"d6","dice_count":4}]}]}
        """))
        val sheet = SheetStateServer().sheet.copy(data = obj("""
            {"values":{"lvl":{"level":3},"weapon":[{"uid":"spear","item_id":1,"magic_item_id":2},{"uid":"plain","item_id":1}]}}
        """))
        val items = mapOf(1L to base, 2L to magic)
        val metadata = HandbookMetadata(suggests = mapOf("14" to listOf(Suggest(6, 14, "Метательное"))))
        val images = ImageLoader.Builder(InstrumentationRegistry.getInstrumentation().targetContext).build()
        val context = SheetContext(sheet, metadata, items, images, true, {}, {},
            DndDerivedValues(sheet, items, metadata), SheetJournalState())
        try {
            ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
                scenario.onActivity { host -> host.setContent {
                    ShareTheme {
                        CompositionLocalProvider(LocalCharacterSheet provides context) {
                            Column(Modifier.fillMaxSize().safeDrawingPadding().padding(16.dp)) { DndWeapons(LayoutFormat.Tablet) }
                        }
                    }
                } }
                val use = "Особое применение: Метнуть молнией"
                TouchRobot.await { TouchRobot.find(use) != null }
                val heading = TouchRobot.bounds("Свойства")
                val panel = TouchRobot.bounds(use)
                assertTrue(panel.top >= heading.bottom)
                assertTrue(heading.centerX() in panel.left..panel.right)
                TouchRobot.click(use)
                TouchRobot.await { TouchRobot.find("Потянуть, чтобы закрыть") != null }
                assertNull(TouchRobot.find("Изменить"))
            }
        } finally { images.shutdown() }
    }
}
