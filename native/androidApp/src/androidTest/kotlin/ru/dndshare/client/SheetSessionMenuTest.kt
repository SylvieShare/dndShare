package ru.dndshare.client

import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Row
import androidx.test.core.app.ActivityScenario
import java.util.concurrent.atomic.AtomicInteger
import kotlin.test.*
import org.junit.Test
import ru.dndshare.client.ui.character.*
import ru.dndshare.client.ui.designsystem.*

class SheetSessionMenuTest {
    @get:org.junit.Rule val animations = AnimatorScaleRule()

    @Test
    fun sessionMenuRetainsPlayersEventsAndHorizontalTools() {
        val selected = AtomicInteger()
        ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
            scenario.onActivity { host ->
                host.setContent {
                    ShareTheme {
                        Row {
                            SheetSessionMenu("Пепельная корона", SessionConnection.Connected, 2, 3,
                                { selected.set(1) }, { selected.set(2) }, { selected.set(3) })
                            DndHeaderTools(true, { selected.set(4) }, { selected.set(5) })
                        }
                    }
                }
            }
            TouchRobot.await { TouchRobot.find("Сессия") != null }
            val session = TouchRobot.bounds("Сессия")
            for (label in listOf("Отдых и рассвет", "Меню персонажа")) {
                val box = TouchRobot.bounds(label)
                assertEquals(session.height(), box.height())
                assertEquals(session.centerY(), box.centerY())
                assertTrue(box.left >= session.right)
            }
            for ((label, expected) in listOf("Открыть сессию" to 1, "Игроки" to 2, "События" to 3)) {
                TouchRobot.click("Сессия")
                TouchRobot.await { TouchRobot.find("Пепельная корона") != null }
                TouchRobot.click(label)
                TouchRobot.await { selected.get() == expected && TouchRobot.find("Пепельная корона") == null }
            }
            TouchRobot.click("Отдых и рассвет")
            TouchRobot.await { selected.get() == 4 }
            TouchRobot.click("Меню персонажа")
            TouchRobot.await { selected.get() == 5 }
        }
    }
}
