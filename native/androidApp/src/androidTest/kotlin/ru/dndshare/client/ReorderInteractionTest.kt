package ru.dndshare.client

import android.graphics.Rect
import android.os.SystemClock
import android.view.MotionEvent
import android.view.accessibility.AccessibilityNodeInfo
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import java.util.concurrent.atomic.AtomicReference
import kotlin.test.*
import org.junit.Test
import ru.dndshare.client.ui.designsystem.*

class ReorderInteractionTest {
    private val instrument
        get() = InstrumentationRegistry.getInstrumentation()

    private fun await(condition: () -> Boolean) {
        val until = SystemClock.uptimeMillis() + 10_000
        while (!condition()) {
            check(SystemClock.uptimeMillis() < until) { "Native reorder timed out" }
            Thread.sleep(25)
        }
    }

    private fun node(description: String): AccessibilityNodeInfo? {
        fun visit(n: AccessibilityNodeInfo?): AccessibilityNodeInfo? {
            if (n == null) return null
            for (i in 0 until n.childCount) visit(n.getChild(i))?.let {
                return it
            }
            if (
                n.contentDescription?.toString() == description || n.text?.toString() == description
            )
                return n
            return null
        }
        return visit(instrument.uiAutomation.rootInActiveWindow)
    }

    private fun tap(description: String) {
        await { node(description) != null }
        val bounds = Rect()
        requireNotNull(node(description)).getBoundsInScreen(bounds)
        val down = SystemClock.uptimeMillis()
        touch(MotionEvent.ACTION_DOWN, bounds.centerX().toFloat(), bounds.centerY().toFloat(), down)
        touch(MotionEvent.ACTION_UP, bounds.centerX().toFloat(), bounds.centerY().toFloat(), down)
    }

    private fun touch(action: Int, x: Float, y: Float, down: Long) {
        val properties =
            MotionEvent.PointerProperties().apply {
                id = 0
                toolType = MotionEvent.TOOL_TYPE_FINGER
            }
        val coordinates =
            MotionEvent.PointerCoords().apply {
                this.x = x
                this.y = y
                pressure = 1f
                size = 1f
            }
        val event =
            MotionEvent.obtain(
                down,
                SystemClock.uptimeMillis(),
                action,
                1,
                arrayOf(properties),
                arrayOf(coordinates),
                0,
                0,
                1f,
                1f,
                0,
                0,
                android.view.InputDevice.SOURCE_TOUCHSCREEN,
                0,
            )
        try {
            instrument.sendPointerSync(event)
        } finally {
            event.recycle()
        }
    }

    @Test
    fun dragAndEdgeScrollKeepEveryIdentityAndAccessibleMenuStillMovesRows() {
        val latest = AtomicReference<List<Pair<String, String>>>(emptyList())
        ActivityScenario.launch(ComponentActivity::class.java).use { activity ->
            activity.onActivity { host ->
                host.setContent {
                    var rows by remember {
                        mutableStateOf((1..80).map { "id-$it" to "Запись $it" })
                    }
                    val observedRows = rows
                    SideEffect { latest.set(observedRows) }
                    ShareTheme {
                        Column(
                            Modifier.fillMaxWidth()
                                .windowInsetsPadding(WindowInsets.safeDrawing)
                                .padding(24.dp)
                        ) {
                            ShareReorderList(rows) { from, to ->
                                val next = rows.toMutableList()
                                val a = next.indexOfFirst { it.first == from }
                                val b = next.indexOfFirst { it.first == to }
                                if (a >= 0 && b >= 0) next.add(b, next.removeAt(a))
                                rows = next
                            }
                        }
                    }
                }
            }
            await { node("Перетащить: Запись 1") != null }
            val bounds = Rect()
            requireNotNull(node("Перетащить: Запись 1")).getBoundsInScreen(bounds)
            val down = SystemClock.uptimeMillis()
            val x = bounds.centerX().toFloat()
            val start = bounds.centerY().toFloat()
            val density = instrument.targetContext.resources.displayMetrics.density
            val listBounds = Rect()
            requireNotNull(node("Порядок записей")).getBoundsInScreen(listBounds)
            val end = listBounds.bottom - 8 * density
            println("Native drag handle before DOWN: $bounds; x=$x start=$start end=$end")
            touch(MotionEvent.ACTION_DOWN, x, start, down)
            Thread.sleep(700)
            for (i in 1..20) {
                touch(MotionEvent.ACTION_MOVE, x, start + (end - start) * i / 20, down)
                Thread.sleep(35)
            }
            Thread.sleep(900)
            touch(MotionEvent.ACTION_MOVE, x, end - 48 * density, down)
            Thread.sleep(100)
            touch(MotionEvent.ACTION_UP, x, end - 48 * density, down)
            try {
                await { latest.get().indexOfFirst { it.first == "id-1" } > 8 }
            } catch (problem: Exception) {
                throw IllegalStateException(
                    "Edge drag stopped at ${latest.get().indexOfFirst { it.first == "id-1" }}; first=${latest.get().take(20)}; start=$start end=$end list=$listBounds",
                    problem,
                )
            }
            assertEquals((1..80).map { "id-$it" }.toSet(), latest.get().map { it.first }.toSet())
            val movedIndex = latest.get().indexOfFirst { it.first == "id-1" }
            assertTrue(
                movedIndex <= 40,
                "Viewport followed the moved key instead of staying in place: $movedIndex",
            )
            tap("Порядок: Запись 1")
            tap("Выше")
            await { latest.get().indexOfFirst { it.first == "id-1" } == movedIndex - 1 }
            assertEquals(80, latest.get().size)
        }
    }
}
