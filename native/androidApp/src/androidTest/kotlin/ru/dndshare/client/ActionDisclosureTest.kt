package ru.dndshare.client

import android.os.Bundle
import android.os.SystemClock
import android.view.accessibility.AccessibilityNodeInfo
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import kotlin.test.*
import org.junit.Test
import ru.dndshare.client.ui.designsystem.*

class ActionDisclosureTest {
    private val instrument
        get() = InstrumentationRegistry.getInstrumentation()

    private fun node(label: String): AccessibilityNodeInfo? {
        fun find(value: AccessibilityNodeInfo?): AccessibilityNodeInfo? {
            if (value == null) return null
            for (index in 0 until value.childCount) find(value.getChild(index))?.let {
                return it
            }
            return value.takeIf {
                it.text?.toString() == label || it.contentDescription?.toString() == label
            }
        }
        return find(instrument.uiAutomation.rootInActiveWindow)
    }

    private fun wait(condition: () -> Boolean) {
        val end = SystemClock.uptimeMillis() + 10_000
        while (!condition() && SystemClock.uptimeMillis() < end) Thread.sleep(50)
        assertTrue(condition(), "Disclosure must settle in the requested state")
    }

    @Test
    fun collapseReopenRetainsTheNativeBodyInput() {
        val expanded = mutableStateOf(false)
        ActivityScenario.launch(ComponentActivity::class.java).use { activity ->
            activity.onActivity { host ->
                host.setContent {
                    Box(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing)) {
                        ShareActionDisclosure(
                            "Действие",
                            "Пример",
                            expanded.value,
                            { expanded.value = it },
                        ) {
                            var input by rememberSaveable { mutableStateOf("Draft") }
                            ShareTextInput(input, { input = it }, "Сохранённый ввод")
                        }
                    }
                }
            }
            activity.onActivity { expanded.value = true }
            wait { node("Draft") != null }
            assertTrue(
                requireNotNull(node("Draft"))
                    .performAction(
                        AccessibilityNodeInfo.ACTION_SET_TEXT,
                        Bundle().apply {
                            putCharSequence(
                                AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                                "Changed",
                            )
                        },
                    )
            )
            wait { node("Changed") != null }
            activity.onActivity { expanded.value = false }
            wait { node("Changed") == null }
            activity.onActivity { expanded.value = true }
            wait { node("Changed") != null }
        }
    }
}
