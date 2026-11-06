package ru.dndshare.client.mechanics

import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.CompositionLocalProvider
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import coil3.ImageLoader
import java.util.concurrent.atomic.AtomicReference
import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.SheetStateServer
import ru.dndshare.client.TouchRobot
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.character.*
import ru.dndshare.client.ui.designsystem.ShareTheme

class StatusActionsUiTest {
    @Test fun openingAnAppliedEffectOffersItsSavingThrow() {
        fun obj(s: String) = WireJson.parseToJsonElement(s).jsonObject
        val effect = CatalogueItem(80, 15, "Проверяемый яд", data = obj("""{"repeat_save":{"ability":3,"dc":12,"timing":"turn_end"}}"""))
        val sheet = SheetStateServer().sheet.copy(data = obj("""{"values":{"CON":{"value":14},"states":[{"uid":"poison","effect_id":80}]}}"""))
        val metadata = HandbookMetadata()
        val items = mapOf(effect.id to effect)
        val images = ImageLoader.Builder(InstrumentationRegistry.getInstrumentation().targetContext).build()
        val rolled = AtomicReference<SheetRollRequest>()
        val context = SheetContext(sheet, metadata, items, images, true, {}, {}, DndDerivedValues(sheet, items),
            SheetJournalState(), roll = rolled::set)
        try {
            ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
                scenario.onActivity { host -> host.setContent {
                    ShareTheme { CompositionLocalProvider(LocalCharacterSheet provides context) { DndStatuses() } }
                } }
                TouchRobot.await { TouchRobot.find("Проверяемый яд") != null }
                TouchRobot.click("Проверяемый яд")
                TouchRobot.await { TouchRobot.find("Повторить спасбросок · Сл 12") != null }
                TouchRobot.click("Повторить спасбросок · Сл 12")
                TouchRobot.await { rolled.get() != null }
                assertEquals(3L, rolled.get().ability)
                assertEquals(2, rolled.get().bonus)
                assertEquals("poison", rolled.get().statusAction?.uid)
            }
        } finally { images.shutdown() }
    }
}
