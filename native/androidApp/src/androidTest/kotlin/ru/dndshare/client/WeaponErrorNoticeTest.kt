package ru.dndshare.client

import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.ui.Modifier
import androidx.test.core.app.ActivityScenario
import java.util.concurrent.atomic.AtomicInteger
import kotlin.test.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.ui.character.*
import ru.dndshare.client.ui.designsystem.*

class WeaponErrorNoticeTest {
    @Test
    fun expiredErrorStaysReadableUntilExplicitRetryOrDismiss() {
        val closed = AtomicInteger()
        val retried = AtomicInteger()
        ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
            scenario.onActivity { host ->
                host.setContent {
                    ShareTheme {
                        Box(Modifier.windowInsetsPadding(WindowInsets.safeDrawing)) {
                            SheetDiceNotificationCard(
                                SheetDiceNotice(
                                    "error",
                                    SheetRollRequest("Урон", "damage", formula = "0"),
                                    "auto",
                                    null,
                                    false,
                                    "Недостаточно ресурса",
                                    emptyList(),
                                    System.currentTimeMillis() - 10_000,
                                ),
                                false,
                                false,
                                { closed.incrementAndGet() },
                                { retried.incrementAndGet() },
                                {},
                                {},
                            )
                        }
                    }
                }
            }
            TouchRobot.await { TouchRobot.find("Недостаточно ресурса") != null }
            android.os.SystemClock.sleep(250)
            assertEquals(0, closed.get())
            TouchRobot.click("Повторить")
            assertEquals(1, retried.get())
            TouchRobot.click("Закрыть уведомление")
            assertEquals(1, closed.get())
        }
    }
}
