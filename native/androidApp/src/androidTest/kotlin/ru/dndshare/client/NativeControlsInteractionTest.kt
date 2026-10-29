package ru.dndshare.client

import android.os.Bundle
import android.view.accessibility.AccessibilityNodeInfo
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.test.core.app.ActivityScenario
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import kotlin.test.*
import org.junit.Test
import ru.dndshare.client.ui.designsystem.*

class NativeControlsInteractionTest {
    @get:org.junit.Rule val animatorScale = AnimatorScaleRule()

    @Test
    fun bufferedInputsSteppersAndSelectionsRetainNativeEditingAndOneCallback() {
        val result = AtomicReference("")
        val switches = AtomicInteger()
        ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
            scenario.onActivity { activity ->
                activity.setContent {
                    ShareTheme {
                        var name by remember { mutableStateOf("Draft") }
                        var count by remember { mutableStateOf("12") }
                        var checked by remember { mutableStateOf(false) }
                        var choice by remember { mutableStateOf(false) }
                        var range by remember { mutableFloatStateOf(.25f) }
                        var mode by remember { mutableStateOf("auto") }
                        val inputs = remember { ShareFormInputs() }
                        CompositionLocalProvider(LocalShareFormInputs provides inputs) {
                            ShareFormDialog(
                                "Поля",
                                {},
                                actions = {
                                    ShareButton(
                                        onClick = {
                                            inputs.flush()
                                            result.set("$name|$count|$checked|$choice|$range|$mode")
                                        }
                                    ) {
                                        Text("Применить")
                                    }
                                },
                            ) {
                                ShareTextInput(name, { name = it }, "Имя")
                                ShareSegmentedInput(
                                    "Режим",
                                    mode,
                                    listOf(
                                        "auto" to "Авто",
                                        "normal" to "Обычно",
                                        "advantage" to "Преимущество",
                                        "disadvantage" to "Помеха",
                                    ),
                                ) {
                                    mode = it
                                }
                                ShareNumberInput("Количество", count) { count = it }
                                ShareTextButton(
                                    onClick = {
                                        count = ((count.toLongOrNull() ?: 0) + 5).toString()
                                    }
                                ) {
                                    Text("Прибавить пять")
                                }
                                ShareToggle("Переключатель", checked) {
                                    checked = it
                                    switches.incrementAndGet()
                                }
                                ShareCheckbox(
                                    choice,
                                    { choice = it },
                                    Modifier.semantics { contentDescription = "Выбор" },
                                )
                                ShareSlider(
                                    range,
                                    { range = it },
                                    Modifier.semantics { contentDescription = "Диапазон" },
                                )
                                ShareToggle("Отключено", false, enabled = false) {
                                    error("Disabled toggle changed")
                                }
                            }
                        }
                    }
                }
            }
            TouchRobot.setText("Имя", "Native name")
            TouchRobot.setText("Количество", "35")
            TouchRobot.click("Увеличить: Количество")
            TouchRobot.await {
                TouchRobot.findNode { it.isEditable && it.text?.toString() == "36" } != null
            }
            TouchRobot.click("Прибавить пять")
            TouchRobot.await {
                TouchRobot.findNode { it.isEditable && it.text?.toString() == "41" } != null
            }
            TouchRobot.click("Увеличить: Количество")
            TouchRobot.click("Переключатель")
            TouchRobot.click("Выбор")
            TouchRobot.click("Преимущество")
            val slider = requireNotNull(TouchRobot.control("Диапазон") { it.rangeInfo != null })
            assertTrue(
                slider.performAction(
                    AccessibilityNodeInfo.AccessibilityAction.ACTION_SET_PROGRESS.id,
                    Bundle().apply {
                        putFloat(AccessibilityNodeInfo.ACTION_ARGUMENT_PROGRESS_VALUE, .75f)
                    },
                )
            )
            var disabled = requireNotNull(TouchRobot.find("Отключено"))
            while (!disabled.isCheckable && disabled.parent != null) disabled = disabled.parent
            assertTrue(disabled.isCheckable, "The labelled row exposes switch semantics")
            assertFalse(disabled.isEnabled)
            TouchRobot.click("Применить")
            TouchRobot.await { result.get().startsWith("Native name|42|true|true|") }
            assertEquals("Native name|42|true|true|0.75|advantage", result.get())
            assertEquals(1, switches.get())
        }
    }

    @Test
    fun customActionMenuHandsFocusToTheNextDialogAndClosesOnce() {
        val selected = AtomicInteger()
        val confirmed = AtomicInteger()
        val menuWidth = AtomicInteger()
        ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
            scenario.onActivity { activity ->
                activity.setContent {
                    ShareTheme {
                        var menu by remember { mutableStateOf(false) }
                        var confirm by remember { mutableStateOf(false) }
                        Box(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing)) {
                            Box {
                                ShareButton({ menu = true }) { Text("Меню теста") }
                                ShareDropdownMenu(menu, { menu = false }) {
                                    ShareDropdownMenuItem(
                                        { Text("Выбрать") },
                                        {
                                            menu = false
                                            selected.incrementAndGet()
                                            confirm = true
                                        },
                                        modifier =
                                            Modifier.onGloballyPositioned {
                                                menuWidth.set(it.size.width)
                                            },
                                    )
                                }
                            }
                            if (confirm)
                                ShareAlertDialog(
                                    { confirm = false },
                                    title = { Text("Подтверждение") },
                                    confirmButton = {
                                        ShareButton({
                                            confirmed.incrementAndGet()
                                            confirm = false
                                        }) {
                                            Text("Готово")
                                        }
                                    },
                                )
                        }
                    }
                }
            }
            TouchRobot.click("Меню теста")
            TouchRobot.await { menuWidth.get() > 0 }
            val density =
                androidx.test.platform.app.InstrumentationRegistry.getInstrumentation()
                    .targetContext
                    .resources
                    .displayMetrics
                    .density
            assertTrue(
                menuWidth.get() < 220 * density,
                "A short menu fits its content instead of filling the phone",
            )
            TouchRobot.click("Выбрать")
            TouchRobot.click("Готово")
            TouchRobot.await { confirmed.get() == 1 && TouchRobot.find("Подтверждение") == null }
            assertEquals(1, selected.get())
        }
    }
}
