package ru.dndshare.client

import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInWindow
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ActivityScenario
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import kotlin.test.*
import org.junit.Test
import ru.dndshare.client.ui.*
import ru.dndshare.client.ui.designsystem.*

class HeaderConnectionLayoutTest {
    @get:org.junit.Rule val animations = AnimatorScaleRule()

    @Test
    fun indicatorMovesHeaderWidgetsAndExposesRetryWithoutAStatusRow() {
        val state = mutableStateOf(HeaderConnectionState())
        val marker = AtomicReference(0f)
        val retries = AtomicInteger()
        ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
            scenario.onActivity { host ->
                host.setContent {
                    ShareTheme {
                        Box(Modifier.width(390.dp)) {
                            ShareWorkspaceHeader(
                                actions = {
                                    Row {
                                        Text(
                                            "Session",
                                            Modifier.onGloballyPositioned {
                                                marker.set(it.positionInWindow().x)
                                            },
                                        )
                                        HeaderConnectionWidget(
                                            state.value,
                                            {
                                                retries.incrementAndGet()
                                                state.value = HeaderConnectionState()
                                            },
                                        )
                                    }
                                }
                            ) {
                                Text("Character", Modifier.weight(1f))
                            }
                        }
                    }
                }
            }
            TouchRobot.await { marker.get() > 0 }
            val initial = marker.get()
            scenario.onActivity {
                state.value = HeaderConnectionState(busy = true, message = "Connecting")
            }
            TouchRobot.await {
                TouchRobot.find("Connecting") != null && marker.get() < initial - 40
            }
            scenario.onActivity { state.value = HeaderConnectionState(error = "Offline") }
            TouchRobot.click("Offline")
            TouchRobot.click("Повторить")
            TouchRobot.await { retries.get() == 1 && kotlin.math.abs(marker.get() - initial) < 2 }
            assertEquals(1, retries.get())
        }
    }

    @Test
    fun applicationHeaderRendersBusyAndFailureAndRetries() {
        val state = mutableStateOf(ru.dndshare.client.app.AppState(synchronizing = true))
        val count = AtomicInteger()
        ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
            scenario.onActivity { host ->
                host.setContent {
                    ShareTheme {
                        AppHeader(
                            LayoutFormat.Phone,
                            AppPage.Characters,
                            state.value,
                            {},
                            retry = {
                                count.incrementAndGet()
                                state.value = state.value.copy(synchronizing = false, error = null)
                            },
                        )
                    }
                }
            }
            TouchRobot.await { TouchRobot.find("Обновляем данные…") != null }
            assertNull(
                TouchRobot.findNode { it.text?.toString() == "Обновляем данные…" },
                "Busy is an indicator, not a status row",
            )
            scenario.onActivity {
                state.value = state.value.copy(synchronizing = false, error = "Connection failed")
            }
            TouchRobot.click("Connection failed")
            TouchRobot.click("Повторить")
            TouchRobot.await { count.get() == 1 && TouchRobot.find("Connection failed") == null }
        }
    }
}
