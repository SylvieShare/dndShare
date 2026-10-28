package ru.dndshare.client

import android.os.SystemClock
import android.view.KeyEvent
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import kotlin.test.*
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Suite
import ru.dndshare.client.ui.character.sheetHistoryKeys

@RunWith(Suite::class)
@Suite.SuiteClasses(
    SheetHistoryKeysTest::class,
    CharacterSheetStorageTest::class,
    ImagePreparationTest::class,
)
class SheetDocumentSuite

class SheetHistoryKeysTest {
    @Test
    fun hardwareShortcutsFollowAvailabilityAndLeaveOpenEditorsAlone() {
        val events = CopyOnWriteArrayList<Boolean>()
        val enabled = mutableStateOf(true)
        val canRedo = mutableStateOf(true)
        val renderedEnabled = AtomicBoolean(false)
        val renderedRedo = AtomicReference<Boolean?>(null)
        val instrument = InstrumentationRegistry.getInstrumentation()
        ActivityScenario.launch(ComponentActivity::class.java).use { activity ->
            activity.onActivity { host ->
                host.setContent {
                    val active = enabled.value
                    val redoAvailable = canRedo.value
                    SideEffect { renderedEnabled.set(active); renderedRedo.set(redoAvailable) }
                    Column(
                        Modifier.fillMaxSize()
                            .sheetHistoryKeys(active, true, redoAvailable, events::add)
                    ) {
                        Text("Sheet")
                    }
                }
            }
            fun key(code: Int, shift: Boolean = false) {
                instrument.waitForIdleSync()
                val now = SystemClock.uptimeMillis()
                val flags = KeyEvent.META_CTRL_ON or if (shift) KeyEvent.META_SHIFT_ON else 0
                for (action in listOf(KeyEvent.ACTION_DOWN, KeyEvent.ACTION_UP)) instrument
                    .sendKeySync(KeyEvent(now, now, action, code, 0, flags))
                instrument.waitForIdleSync()
            }
            key(KeyEvent.KEYCODE_Z)
            key(KeyEvent.KEYCODE_Z, true)
            key(KeyEvent.KEYCODE_Y)
            assertEquals(listOf(false, true, true), events.toList())
            activity.onActivity { canRedo.value = false }
            val redoDeadline = SystemClock.uptimeMillis() + 5_000
            while (renderedRedo.get() != false && SystemClock.uptimeMillis() < redoDeadline) Thread.sleep(10)
            assertEquals(false, renderedRedo.get())
            key(KeyEvent.KEYCODE_Y)
            assertEquals(3, events.size)
            activity.onActivity { enabled.value = false }
            val deadline = SystemClock.uptimeMillis() + 5_000
            while (renderedEnabled.get() && SystemClock.uptimeMillis() < deadline) Thread.sleep(10)
            assertFalse(renderedEnabled.get(), "The editor state must reach a composed frame before delivering its key")
            key(KeyEvent.KEYCODE_Z)
            assertEquals(3, events.size)
        }
    }
}
