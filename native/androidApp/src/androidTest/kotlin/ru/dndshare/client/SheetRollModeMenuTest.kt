package ru.dndshare.client

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import coil3.ImageLoader
import java.io.File
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import kotlin.test.assertEquals
import org.junit.Test
import ru.dndshare.client.character.DndDerivedValues
import ru.dndshare.client.character.SheetRollRequest
import ru.dndshare.client.model.HandbookMetadata
import ru.dndshare.client.ui.character.LocalCharacterSheet
import ru.dndshare.client.ui.character.SheetContext
import ru.dndshare.client.ui.character.SheetJournalState
import ru.dndshare.client.ui.character.SheetRollActions
import ru.dndshare.client.ui.designsystem.ShareAction
import ru.dndshare.client.ui.designsystem.ShareTheme
import ru.dndshare.client.ui.designsystem.shareCanvas

class SheetRollModeMenuTest {
    @Test
    fun eachClickReplacesTheOtherModeAndReopeningRestoresTheDefault() {
        val title = "Ловкость — спасбросок"
        val request = SheetRollRequest(title, kind = "saving_throw", bonus = 6, manualMode = "advantage")
        val results = LinkedBlockingQueue<SheetRollRequest>()
        val sheet = SheetStateServer().sheet
        val instrument = InstrumentationRegistry.getInstrumentation()
        val images = ImageLoader.Builder(instrument.targetContext).build()
        val context = SheetContext(
            sheet = sheet,
            metadata = HandbookMetadata(),
            items = emptyMap(),
            images = images,
            canEdit = true,
            edit = {},
            openItem = {},
            mechanics = DndDerivedValues(sheet, emptyMap()),
            journal = SheetJournalState(),
            roll = { results.add(it) },
        )
        try {
            ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
                scenario.onActivity { host ->
                    host.setContent {
                        ShareTheme {
                            CompositionLocalProvider(LocalCharacterSheet provides context) {
                                var open by remember { mutableStateOf(false) }
                                Box(Modifier.fillMaxSize().shareCanvas(), contentAlignment = Alignment.Center) {
                                    Box {
                                        ShareAction(title, { open = true })
                                        SheetRollActions(open, { open = false }, request, editTarget = "stats")
                                    }
                                }
                            }
                        }
                    }
                }
                fun verify(mode: String, vararg clicks: String) {
                    TouchRobot.click(title)
                    clicks.forEach(TouchRobot::click)
                    TouchRobot.click("Бросить кубик")
                    assertEquals(request.copy(manualMode = mode), results.poll(5, TimeUnit.SECONDS))
                    TouchRobot.await("Roll menu closed") { TouchRobot.find("Бросить кубик") == null }
                }
                verify("disadvantage", "Помеха")
                verify("advantage", "Помеха", "Преимущество")
                verify("normal", "Преимущество")
                verify("advantage")
                if (InstrumentationRegistry.getArguments().getString("captureRollMode") == "true") {
                    TouchRobot.click(title)
                    TouchRobot.await("Advantage card") { TouchRobot.find("Преимущество") != null }
                    instrument.uiAutomation.waitForIdle(350, 5_000)
                    val screenshot = requireNotNull(instrument.uiAutomation.takeScreenshot())
                    val output = File(instrument.targetContext.getExternalFilesDir(null), "roll-mode.png")
                    output.outputStream().use { screenshot.compress(Bitmap.CompressFormat.PNG, 100, it) }
                    screenshot.recycle()
                }
            }
        } finally {
            images.shutdown()
        }
    }
}
