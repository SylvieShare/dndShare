package ru.dndshare.client

import android.graphics.Bitmap
import android.graphics.Rect
import android.view.accessibility.AccessibilityNodeInfo
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import coil3.ImageLoader
import coil3.svg.SvgDecoder
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import kotlin.test.assertTrue
import kotlinx.coroutines.flow.collect
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.HandbookMetadata
import ru.dndshare.client.ui.character.*
import ru.dndshare.client.ui.designsystem.*

class VisualPhasePopupContinuityTest {
    @Test fun openingAndClosingTheCharacterMenuNeverRestartsTheVisibleClock() {
        val instrument = InstrumentationRegistry.getInstrumentation()
        val images = ImageLoader.Builder(instrument.targetContext).components { add(SvgDecoder.Factory()) }.build()
        val initial = SheetStateServer().sheet
        val sheet = initial.copy(data = applySheetPatches(initial.data, listOf(
            SheetPatch(path = sheetPath("values", "hp", "current"), value = JsonPrimitive(9)),
            SheetPatch(path = sheetPath("values", "hp", "max", "base"), value = JsonPrimitive(18)),
            SheetPatch(path = sheetPath("values", "hp", "temp"), value = JsonPrimitive(5)),
        )))
        val context = SheetContext(sheet, HandbookMetadata(), emptyMap(), images, true, {}, {}, DndDerivedValues(sheet, emptyMap()), SheetJournalState())
        val latest = AtomicReference(0f)
        val focused = AtomicBoolean(false)
        try {
            ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
                scenario.onActivity { host -> host.setContent {
                    ShareTheme {
                        val phase = rememberVisualPhase(true, 1f, maxFps = 24, pauseOnFocusLoss = false)
                        val windowFocused = LocalWindowInfo.current.isWindowFocused
                        SideEffect { focused.set(windowFocused) }
                        LaunchedEffect(phase) { snapshotFlow { phase.value }.collect { latest.set(it) } }
                        Box(Modifier.fillMaxSize().shareCanvas().padding(24.dp)) {
                            DndHeading(context)
                        }
                    }
                } }
                TouchRobot.await("Initial visible phase") { focused.get() && latest.get() > .4f }
                val bitmap = requireNotNull(instrument.uiAutomation.takeScreenshot())
                try { File(instrument.targetContext.getExternalFilesDir(null), "visual-phase-popup.png").outputStream().use {
                    bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)
                } } finally { bitmap.recycle() }
                val before = latest.get()
                fun actor() = TouchRobot.findNode { it.contentDescription?.toString()?.contains("Действия персонажа") == true }
                TouchRobot.await("Character tile accessibility") { actor() != null }
                var tile = requireNotNull(actor())
                while (!tile.isClickable && tile.parent != null) tile = tile.parent
                val bounds = Rect().also { tile.getBoundsInScreen(it) }
                assertTrue(bounds.width() <= DesignTokens.Layout.SheetHeaderTileMax.value * instrument.targetContext.resources.displayMetrics.density + 1)
                assertTrue(tile.performAction(AccessibilityNodeInfo.ACTION_CLICK))
                TouchRobot.await("Focusable character menu") { !focused.get() && TouchRobot.find("Изменить HP") != null }
                instrument.waitForIdleSync()
                val during = latest.get()
                assertTrue(during >= before, "Popup focus reset phase: $before -> $during")
                TouchRobot.click("Изменить HP")
                TouchRobot.await("Focus returns to the sheet") { focused.get() }
                assertTrue(latest.get() >= during, "Closing the menu reset the phase")
            }
        } finally { images.shutdown() }
    }
}
