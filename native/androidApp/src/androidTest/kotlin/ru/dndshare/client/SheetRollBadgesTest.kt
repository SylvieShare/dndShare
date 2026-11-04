package ru.dndshare.client

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import coil3.ImageLoader
import java.io.File
import kotlinx.serialization.json.jsonObject
import org.junit.Test
import ru.dndshare.client.character.DndDerivedValues
import ru.dndshare.client.model.CatalogueItem
import ru.dndshare.client.model.HandbookMetadata
import ru.dndshare.client.model.WireJson
import ru.dndshare.client.ui.character.DndAbilityTile
import ru.dndshare.client.ui.character.LocalCharacterSheet
import ru.dndshare.client.ui.character.SheetContext
import ru.dndshare.client.ui.character.SheetJournalState
import ru.dndshare.client.ui.character.dndAbilities
import ru.dndshare.client.ui.designsystem.ShareTheme
import ru.dndshare.client.ui.designsystem.shareCanvas

class SheetRollBadgesTest {
    @Test
    fun abilityTileShowsManualAutomaticAndCancelledRollModes() {
        val instrument = InstrumentationRegistry.getInstrumentation()
        val sheet = SheetStateServer().sheet.copy(
            sourceVersion = "2014",
            data = WireJson.parseToJsonElement(
                """{"values":{"lvl":{"level":1},"DEX":{"value":{"base":14},"save_roll_mode":"advantage"},"exhaustion":{"level":1},"abilities_class":[{"id":10}]}}"""
            ).jsonObject,
        )
        val feature = CatalogueItem(10, 4, "Тихий шаг", data = WireJson.parseToJsonElement(
            """{"derived_effects":[{"kind":"roll_mode","mode":"advantage","scopes":["skill_check"],"skill_ids":[4]}]}"""
        ).jsonObject)
        val items = mapOf(10L to feature)
        val images = ImageLoader.Builder(instrument.targetContext).build()
        val context = SheetContext(
            sheet = sheet,
            metadata = HandbookMetadata(),
            items = items,
            images = images,
            canEdit = true,
            edit = {},
            openItem = {},
            mechanics = DndDerivedValues(sheet, items),
            journal = SheetJournalState(),
        )
        try {
            ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
                scenario.onActivity { activity ->
                    activity.setContent {
                        ShareTheme {
                            CompositionLocalProvider(LocalCharacterSheet provides context) {
                                Box(Modifier.fillMaxSize().shareCanvas().safeDrawingPadding().padding(16.dp)) {
                                    Box(Modifier.widthIn(max = 360.dp)) {
                                        DndAbilityTile(
                                            dndAbilities.first { it.id == "DEX" },
                                            compact = LocalConfiguration.current.screenWidthDp < 1200,
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
                TouchRobot.await("Manual save advantage") {
                    TouchRobot.find("Преимущество · Переопределено вручную") != null
                }
                TouchRobot.await("Disadvantage from exhaustion") {
                    TouchRobot.find("Помеха · Истощение") != null
                }
                TouchRobot.await("Effects cancel for Stealth") {
                    TouchRobot.findNode {
                        val description = it.contentDescription?.toString().orEmpty()
                        description.startsWith("Обычный бросок · Преимущество и помеха взаимно отменяются") &&
                            "Тихий шаг" in description && "Истощение" in description
                    } != null
                }
                if (InstrumentationRegistry.getArguments().getString("captureRollBadges") == "true") {
                    instrument.uiAutomation.waitForIdle(350, 5_000)
                    val screenshot = requireNotNull(instrument.uiAutomation.takeScreenshot())
                    File(instrument.targetContext.getExternalFilesDir(null), "roll-badges.png")
                        .outputStream().use { screenshot.compress(Bitmap.CompressFormat.PNG, 100, it) }
                    screenshot.recycle()
                }
            }
        } finally {
            images.shutdown()
        }
    }
}
