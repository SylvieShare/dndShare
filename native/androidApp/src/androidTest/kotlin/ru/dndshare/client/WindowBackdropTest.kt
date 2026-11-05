package ru.dndshare.client

import android.graphics.Bitmap
import android.graphics.Rect
import android.view.Window
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.DialogWindowProvider
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import coil3.ImageLoader
import java.io.File
import java.util.concurrent.atomic.AtomicReference
import kotlin.math.abs
import kotlin.test.*
import org.junit.Rule
import org.junit.Test
import ru.dndshare.client.character.DndDerivedValues
import ru.dndshare.client.model.HandbookMetadata
import ru.dndshare.client.ui.character.*
import ru.dndshare.client.ui.designsystem.*

class WindowBackdropTest {
    @get:Rule val animations = AnimatorScaleRule()

    @Test fun editorBlursRealSheetPixelsAndNestedWindowsKeepTheBackdropOwned() {
        val instrument = InstrumentationRegistry.getInstrumentation()
        val images = ImageLoader.Builder(instrument.targetContext).build()
        val sheet = SheetStateServer().sheet
        val context = SheetContext(sheet, HandbookMetadata(), emptyMap(), images, false, {}, {},
            DndDerivedValues(sheet, emptyMap()), SheetJournalState())
        val open = mutableStateOf(false)
        val nested = mutableStateOf(false)
        val reference = mutableStateOf(false)
        val referenceHost = WindowBackdrops()
        val owner = AtomicReference<WindowBackdrops>()
        val window = AtomicReference<Window>()
        try {
            ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
                scenario.onActivity { host -> host.setContent {
                    ShareTheme {
                        CompositionLocalProvider(LocalDensity provides Density(1f, 1f), LocalCharacterSheet provides context) {
                            ShareMorphRoot {
                                val backdrops = requireNotNull(LocalWindowBackdrops.current)
                                SideEffect { owner.set(backdrops) }
                                Box(Modifier.fillMaxSize().background(WebPalette.Background).windowInsetsPadding(WindowInsets.safeDrawing)) {
                                    Column(Modifier.width(300.dp).fillMaxHeight().verticalScroll(rememberScrollState()).padding(20.dp)) {
                                        DndStats(adaptive = false)
                                    }
                                }
                                if (open.value) ShareFormDialog("Редактор персонажа", { open.value = false }) {
                                    val view = LocalView.current
                                    SideEffect { window.set((view.parent as DialogWindowProvider).window) }
                                    Text("Поля редактора остаются чёткими")
                                }
                                if (reference.value) CompositionLocalProvider(LocalWindowBackdrops provides referenceHost) {
                                    ShareFormDialog("Редактор персонажа", { reference.value = false }) {
                                        val view = LocalView.current
                                        SideEffect { window.set((view.parent as DialogWindowProvider).window) }
                                        Text("Поля редактора остаются чёткими")
                                    }
                                }
                                if (nested.value) ShareFormDialog("Подтверждение", { nested.value = false }) {
                                    Text("Вложенное окно")
                                }
                            }
                        }
                    }
                } }
                TouchRobot.await { owner.get() != null }
                scenario.onActivity { open.value = true }
                TouchRobot.await { owner.get().entries.size == 1 && window.get() != null }
                scenario.onActivity { nested.value = true }
                TouchRobot.await { owner.get().entries.size == 2 }
                scenario.onActivity { nested.value = false }
                TouchRobot.await { owner.get().entries.size == 1 && TouchRobot.find("Редактор персонажа") != null }
                // The app host owns this blur; no platform blur is needed for one dialog.
                assertEquals(8.dp, owner.get().radius)
                instrument.uiAutomation.waitForIdle(500, 5_000)
                scenario.onActivity { assertEquals(0, window.get().attributes.blurBehindRadius) }
                val blurred = requireNotNull(instrument.uiAutomation.takeScreenshot())
                val foreground = TouchRobot.bounds("Редактор персонажа")
                val firstWindow = window.get()
                scenario.onActivity { open.value = false }
                TouchRobot.await { owner.get().entries.isEmpty() }
                instrument.uiAutomation.waitForIdle(500, 5_000)
                // Reopen the same editor with an isolated registration host. The dim and
                // foreground stay identical while the underlying sheet has no blur owner.
                scenario.onActivity { reference.value = true }
                TouchRobot.await { referenceHost.entries.size == 1 && window.get() !== firstWindow &&
                    window.get().decorView.isShown && TouchRobot.find("Редактор персонажа") != null }
                instrument.uiAutomation.waitForIdle(500, 5_000)
                scenario.onActivity { assertEquals(0, window.get().attributes.blurBehindRadius) }
                val sharp = requireNotNull(instrument.uiAutomation.takeScreenshot())
                try {
                    if (InstrumentationRegistry.getArguments().getString("captureBackdrop") == "true") {
                        for ((name, image) in listOf("blurred" to blurred, "sharp-reference" to sharp)) {
                            File(instrument.targetContext.getExternalFilesDir(null), "editor-$name.png").outputStream().use {
                                image.compress(Bitmap.CompressFormat.PNG, 100, it)
                            }
                        }
                    }
                    val area = Rect(24, 110, 275, minOf(700, sharp.height - 100))
                    val originalEdges = edges(sharp, area)
                    assertTrue(originalEdges > 1_000, "Reference must contain real sheet text")
                    assertTrue(edges(blurred, area) < originalEdges * .8,
                        "Blur must soften edges at the same dim level: ${edges(blurred, area)} / $originalEdges")
                    assertEquals(0L, difference(blurred, sharp, foreground), "The editor title stays sharp")

                } finally { blurred.recycle(); sharp.recycle() }
                scenario.onActivity { reference.value = false }
                TouchRobot.await { owner.get().entries.isEmpty() && referenceHost.entries.isEmpty() }
            }
        } finally { images.shutdown() }
    }

    private fun brightness(pixel: Int) =
        android.graphics.Color.red(pixel) + android.graphics.Color.green(pixel) + android.graphics.Color.blue(pixel)

    private fun edges(image: Bitmap, area: Rect): Long {
        var sum = 0L
        for (y in area.top until area.bottom - 1) for (x in area.left until area.right - 1) {
            val value = brightness(image.getPixel(x, y))
            sum += abs(value - brightness(image.getPixel(x + 1, y)))
            sum += abs(value - brightness(image.getPixel(x, y + 1)))
        }
        return sum
    }

    private fun difference(a: Bitmap, b: Bitmap, area: Rect): Long {
        var sum = 0L
        for (y in area.top until area.bottom) for (x in area.left until area.right)
            sum += abs(brightness(a.getPixel(x, y)) - brightness(b.getPixel(x, y)))
        return sum
    }
}
