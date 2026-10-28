package ru.dndshare.client

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.Shader
import android.os.SystemClock
import android.view.accessibility.AccessibilityNodeInfo
import android.view.MotionEvent
import android.view.InputDevice
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import coil3.ImageLoader
import java.io.File
import kotlin.test.*
import org.junit.Test
import ru.dndshare.client.ui.*

class RichImageViewerTest {
    private val instrument
        get() = InstrumentationRegistry.getInstrumentation()

    private fun node(label: String): AccessibilityNodeInfo? {
        fun find(value: AccessibilityNodeInfo?): AccessibilityNodeInfo? {
            if (value == null) return null
            for (i in 0 until value.childCount) find(value.getChild(i))?.let {
                return it
            }
            return value.takeIf {
                it.text?.toString() == label || it.contentDescription?.toString() == label
            }
        }
        return find(instrument.uiAutomation.rootInActiveWindow)
    }

    private fun wait(label: String): AccessibilityNodeInfo {
        val end = SystemClock.uptimeMillis() + 15_000
        while (SystemClock.uptimeMillis() < end) {
            val found = node(label)
            val bounds = Rect()
            found?.getBoundsInScreen(bounds)
            if (found != null && !bounds.isEmpty) return found
            Thread.sleep(100)
        }
        val labels = mutableListOf<String>()
        fun collect(value: AccessibilityNodeInfo?) {
            if (value == null) return
            if (!value.text.isNullOrEmpty() || !value.contentDescription.isNullOrEmpty()) labels += "${value.text}/${value.contentDescription}"
            for (index in 0 until value.childCount) collect(value.getChild(index))
        }
        collect(instrument.uiAutomation.rootInActiveWindow)
        error("Image viewer must show $label; visible: $labels")
    }

    private fun click(label: String) {
        val bounds = Rect()
        wait(label).getBoundsInScreen(bounds)
        val now = SystemClock.uptimeMillis()
        for (action in listOf(MotionEvent.ACTION_DOWN, MotionEvent.ACTION_UP)) {
            val event = MotionEvent.obtain(now, SystemClock.uptimeMillis(), action, bounds.centerX().toFloat(), bounds.centerY().toFloat(), 0)
            try { event.source = InputDevice.SOURCE_TOUCHSCREEN; assertTrue(instrument.uiAutomation.injectInputEvent(event, true)) }
            finally { event.recycle() }
        }
    }

    @Test
    fun aRealImageOpensZoomsWithChangedPixelsResetsAndCloses() {
        val context = instrument.targetContext
        val file = File(context.cacheDir, "rich-viewer.png")
        val bitmap = Bitmap.createBitmap(1280, 800, Bitmap.Config.ARGB_8888)
        Canvas(bitmap)
            .drawRect(
                0f,
                0f,
                1280f,
                800f,
                Paint().apply {
                    shader =
                        LinearGradient(
                            0f,
                            0f,
                            1280f,
                            0f,
                            Color.RED,
                            Color.BLUE,
                            Shader.TileMode.CLAMP,
                        )
                },
            )
        file.outputStream().use { assertTrue(bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)) }
        bitmap.recycle()
        val images = ImageLoader.Builder(context).build()
        try {
            ActivityScenario.launch(ComponentActivity::class.java).use { activity ->
                activity.onActivity { host ->
                    host.setContent {
                        CompositionLocalProvider(
                            LocalRichInteractions provides RichInteractions(images = images)
                        ) {
                            Box(Modifier.fillMaxWidth().windowInsetsPadding(WindowInsets.safeDrawing).height(400.dp)) {
                                RichDescription(
                                    "<p><img src=\"${file.toURI()}\" alt=\"Пример\"></p>",
                                    openItem = {},
                                )
                            }
                        }
                    }
                }
                // The real app supplies safeDrawing. Wait for the decoded image's actual frame;
                // its early 48px accessibility target can exist before the bitmap is measured.
                val decoded = Rect()
                val decodeDeadline = SystemClock.uptimeMillis() + 10_000
                do {
                    wait("Пример").getBoundsInScreen(decoded)
                    if (decoded.height() > 100) break
                    Thread.sleep(100)
                } while (SystemClock.uptimeMillis() < decodeDeadline)
                assertTrue(decoded.height() > 100, "The thumbnail must finish measuring before a real tap: $decoded")
                click("Пример")
                wait("100%")
                val bounds = Rect()
                wait("Пример").getBoundsInScreen(bounds)
                val first = assertNotNull(instrument.uiAutomation.takeScreenshot())
                click("Увеличить изображение")
                wait("150%")
                val second = assertNotNull(instrument.uiAutomation.takeScreenshot())
                try {
                    val x = (bounds.left + bounds.width() / 3).coerceIn(0, first.width - 1)
                    val y = bounds.centerY().coerceIn(0, first.height - 1)
                    assertNotEquals(
                        first.getPixel(x, y),
                        second.getPixel(x, y),
                        "Zoom must transform the rendered image, not only its percentage label",
                    )
                } finally {
                    first.recycle()
                    second.recycle()
                }
                click("Сбросить масштаб изображения")
                wait("100%")
                click("Закрыть изображение")
                val end = SystemClock.uptimeMillis() + 10_000
                while (
                    node("Закрыть изображение") != null && SystemClock.uptimeMillis() < end
                ) Thread.sleep(100)
                assertNull(node("Закрыть изображение"))
            }
        } finally {
            images.shutdown()
            file.delete()
        }
    }
}
