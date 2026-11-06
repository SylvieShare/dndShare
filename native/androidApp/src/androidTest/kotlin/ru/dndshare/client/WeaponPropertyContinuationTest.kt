package ru.dndshare.client

import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import kotlin.math.roundToInt
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
    @Test fun attunedMaceAndSwordShowTheirOwnPanels() {
        fun obj(json: String) = WireJson.parseToJsonElement(json).jsonObject
        val mace = CatalogueItem(273, 19, "Булава ужаса", data = obj("""
            {"weapon":{"base_item_id":1},"attunement":"required","max_use":3,
             "status_effects":[{"key":"terror","effect":{"id":4615},"target":"other","condition":"Сл 15"}],
             "feature_actions":[{"key":"terror","uses_resource":true,"resource_cost":1}]}
        """))
        val sword = CatalogueItem(7546, 19, "Меч мести", data = obj("""
            {"weapon":{"base_item_id":1},"attunement":"required","weapon_notes":[
              {"key":"vengeance","kind":"curse","when":"attuned","title":"Мстительный дух","description":"<p>Правило мести</p>"}]}
        """))
        val sheet = SheetStateServer().sheet.copy(data = obj("""
            {"values":{"lvl":{"level":3},"weapon":[
             {"uid":"mace","item_id":1,"magic_item_id":273,"params":{"magic":{"attuned":true,"remaining":3}}},
             {"uid":"sword","item_id":1,"magic_item_id":7546,"params":{"magic":{"attuned":true}}}]}}
        """))
        val items = listOf(mace, sword, CatalogueItem(1, 1, "Оружие"), CatalogueItem(4615, 15, "Ужас булавы")).associateBy { it.id }
        val metadata = HandbookMetadata()
        val images = ImageLoader.Builder(InstrumentationRegistry.getInstrumentation().targetContext).build()
        val tapped = java.util.concurrent.atomic.AtomicReference<Pair<String, Int>>()
        val context = SheetContext(sheet, metadata, items, images, true, {}, {},
            DndDerivedValues(sheet, items, metadata), SheetJournalState(), itemMechanic = { key, operation, payload ->
                assertEquals("resource-set", operation)
                tapped.set(key to payload["value"].number())
                null
            })
        val rendered = mutableStateOf(context)
        try {
            ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
                scenario.onActivity { host -> host.setContent {
                    ShareTheme {
                        CompositionLocalProvider(LocalCharacterSheet provides rendered.value) {
                            DndWeapons(LayoutFormat.Tablet)
                        }
                    }
                } }
                val curse = "Проклятие: Мстительный дух"
                val effect = "Связанный эффект: Эффекты оружия"
                TouchRobot.await { TouchRobot.find(curse) != null && TouchRobot.find(effect) != null }
                TouchRobot.click("Булава ужаса · заряд 3")
                TouchRobot.await { tapped.get() == ("abilities:magic_items:mace" to 2) }
                TouchRobot.click(effect)
                TouchRobot.await { TouchRobot.find("Ужас булавы") != null && TouchRobot.find("Сл 15") != null }
                InstrumentationRegistry.getInstrumentation().uiAutomation.performGlobalAction(
                    android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_BACK)
                TouchRobot.click(curse)
                TouchRobot.await { TouchRobot.findNode { it.text?.toString()?.trim() == "Правило мести" } != null }
                InstrumentationRegistry.getInstrumentation().uiAutomation.performGlobalAction(
                    android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_BACK)
                TouchRobot.await { TouchRobot.find("Потянуть, чтобы закрыть") == null }
                val unattuned = sheet.copy(data = obj("""
                    {"values":{"lvl":{"level":3},"weapon":[
                     {"uid":"mace","item_id":1,"magic_item_id":273},{"uid":"sword","item_id":1,"magic_item_id":7546}]}}
                """))
                scenario.onActivity {
                    rendered.value = context.copy(sheet = unattuned, mechanics = DndDerivedValues(unattuned, items, metadata))
                }
                TouchRobot.await { TouchRobot.find(curse) == null && TouchRobot.find(effect) == null }

            }
        } finally { images.shutdown() }
    }

    @Test fun magicUseSitsUnderPropertiesAndOpensIndependently() {
        fun obj(json: String) = WireJson.parseToJsonElement(json).jsonObject
        val base = CatalogueItem(1, 1, "Копьё", data = obj("""{"tags":[6],"range_min":30,"range_max":120,"attacks":[{"count":1,"dice_id":"d6","type":1}]}"""))
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
        val menu = mutableStateOf<String?>(null)
        val density = InstrumentationRegistry.getInstrumentation().targetContext.resources.displayMetrics.density
        val expectedGap = (DesignTokens.Layout.WeaponMetricsGap.value * density).roundToInt()
        val rolls = java.util.concurrent.atomic.AtomicInteger()
        try {
            ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
                scenario.onActivity { host -> host.setContent {
                    ShareTheme {
                        CompositionLocalProvider(LocalCharacterSheet provides context.copy(
                            edit = { menu.value = it }, weaponMenuTarget = menu.value,
                            dismissWeaponMenu = { menu.value = null },
                            rollWeapon = { _, _, _ -> rolls.incrementAndGet(); menu.value = null },
                        )) {
                            Column(Modifier.fillMaxSize().safeDrawingPadding().padding(16.dp)) { DndWeapons(LayoutFormat.Tablet) }
                        }
                    }
                } }
                TouchRobot.click("Действия с записью: Копьё молнии")
                TouchRobot.await { TouchRobot.find("Изменить") != null }
                assertNull(TouchRobot.find("Бросок оружием"))
                InstrumentationRegistry.getInstrumentation().uiAutomation.performGlobalAction(
                    android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_BACK)
                TouchRobot.click("Атака: Копьё молнии")
                TouchRobot.await { TouchRobot.find("Бросить на атаку") != null }
                assertNull(TouchRobot.find("Изменить"))
                assertNotNull(TouchRobot.find("Копьё молнии · Атака"))
                assertNotNull(TouchRobot.find("Сила"))
                assertNotNull(TouchRobot.find("30/120 фт."))
                assertNotNull(TouchRobot.find("1d20"))
                assertNull(TouchRobot.find("Критическое попадание"))
                assertEquals(0, rolls.get())
                TouchRobot.click("Бросить на атаку")
                TouchRobot.await { rolls.get() == 1 && TouchRobot.find("Бросить на атаку") == null }
                TouchRobot.click("Урон: Копьё молнии")
                TouchRobot.await { TouchRobot.find("Бросить на урон") != null }
                assertNotNull(TouchRobot.find("Копьё молнии · Урон"))
                assertNotNull(TouchRobot.find("Оружие"))
                assertNull(TouchRobot.find("Преимущество"))
                assertNull(TouchRobot.find("Закрыть окно"))
                TouchRobot.click("Бросить на урон")
                TouchRobot.await { rolls.get() == 2 && TouchRobot.find("Бросить на урон") == null }
                val use = "Особое применение: Метнуть молнией"
                TouchRobot.await { TouchRobot.find(use) != null }
                val panel = TouchRobot.bounds(use)
                val properties = TouchRobot.bounds("Свойства")
                assertTrue(properties.centerX() in panel.left..panel.right)
                val automation = InstrumentationRegistry.getInstrumentation().uiAutomation
                automation.waitForIdle(250, 5_000)
                val screenshot = requireNotNull(automation.takeScreenshot())
                try {
                    // Sample the painted surfaces, away from text, icons and rounded corners.
                    val x = panel.left + panel.width() * 3 / 4
                    val surface = WebPalette.Surface.toArgb()
                    fun gapAbove(contentY: Int): Int {
                        var y = contentY
                        while (y > 0 && screenshot.getPixel(x, y) != surface) y--
                        val lastBackgroundPixel = y
                        while (y > 0 && screenshot.getPixel(x, y) == surface) y--
                        return lastBackgroundPixel - y
                    }
                    assertEquals(expectedGap, gapAbove(properties.centerY()), "Урон → Свойства")
                    assertEquals(expectedGap, gapAbove(panel.centerY()), "Свойства → Особое применение")
                } finally {
                    screenshot.recycle()
                }
                TouchRobot.click(use)
                TouchRobot.await { TouchRobot.find("Потянуть, чтобы закрыть") != null }
                assertNull(TouchRobot.find("Изменить"))
            }
        } finally { images.shutdown() }
    }
}
