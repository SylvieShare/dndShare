package ru.dndshare.client

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.background
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionOnScreen
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import coil3.ImageLoader
import coil3.svg.SvgDecoder
import java.io.File
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger
import kotlin.math.roundToInt
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlinx.serialization.json.jsonObject
import org.junit.Test
import ru.dndshare.client.character.CharacterSheet
import ru.dndshare.client.model.WireJson
import ru.dndshare.client.ui.LayoutFormat
import ru.dndshare.client.ui.character.CharacterSheetHeader
import ru.dndshare.client.ui.character.SheetSection
import ru.dndshare.client.ui.character.sheetSections
import ru.dndshare.client.ui.designsystem.ShareTheme
import ru.dndshare.client.ui.designsystem.WebPalette

class CharacterSheetHeaderTest {
    @Test
    fun identityAndTabletNavigationFitAcrossWindowFormats() {
        val instrument = InstrumentationRegistry.getInstrumentation()
        val images = ImageLoader.Builder(instrument.targetContext)
            .components { add(SvgDecoder.Factory()) }
            .build()
        val sheet = CharacterSheet(
            "DND5", 1,
            WireJson.parseToJsonElement(
                """{"values":{"name":"Лира","race":{"name":"Полуэльф"},"classes":[{"name":"Плут"}]}}"""
            ).jsonObject,
            version = 1,
        )
        val width = mutableIntStateOf(390)
        val bounds = ConcurrentHashMap<Int, Rect>()
        val closes = AtomicInteger()
        try {
            ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
                scenario.onActivity { activity ->
                    activity.setContent {
                        ShareTheme {
                            CompositionLocalProvider(LocalDensity provides Density(1f, 1f)) {
                                val current = width.intValue
                                val format = when {
                                    current < 600 -> LayoutFormat.Phone
                                    current < 1200 -> LayoutFormat.Tablet
                                    else -> LayoutFormat.Wide
                                }
                                Box(Modifier.fillMaxSize().background(WebPalette.Background)
                                    .windowInsetsPadding(WindowInsets.safeDrawing)
                                    .wrapContentSize(Alignment.TopStart, true)) {
                                    Column(Modifier.requiredWidth(current.dp).onGloballyPositioned {
                                        bounds[current] = Rect(
                                            it.positionOnScreen(),
                                            Size(it.size.width.toFloat(), it.size.height.toFloat()),
                                        )
                                    }) {
                                        CharacterSheetHeader(
                                            sheet, format, sheetSections("DND5", format),
                                            SheetSection.Weapons, images, {}, { closes.incrementAndGet() },
                                            actions = {
                                                Text("Сессия", Modifier.width(90.dp), color = WebPalette.TextMuted)
                                            },
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
                for (current in listOf(390, 834, 1390)) {
                    scenario.onActivity { width.intValue = current }
                    TouchRobot.await { bounds.containsKey(current) && TouchRobot.find("Лира") != null }
                    val header = requireNotNull(bounds[current])
                    val icon = TouchRobot.bounds("Иконка персонажа")
                    val name = TouchRobot.bounds("Лира")
                    assertEquals(40, icon.width())
                    assertEquals(40, icon.height())
                    assertTrue(icon.right <= name.left, "The character icon precedes the identity")
                    assertTrue(name.right <= header.right + 1, "Identity stays inside the header")
                    if (current == 834) {
                        TouchRobot.await { TouchRobot.find("Магия") != null }
                        assertTrue(header.height <= 130, "The tablet header contains compact navigation")
                        val first = TouchRobot.bounds("Статы")
                        val last = TouchRobot.bounds("Дневник")
                        assertTrue(first.left >= header.left + 20)
                        assertTrue(last.right <= header.right - 20)
                        var firstTab = requireNotNull(TouchRobot.find("Статы"))
                        while (!firstTab.isClickable && firstTab.parent != null) firstTab = firstTab.parent
                        val area = android.graphics.Rect().also(firstTab::getBoundsInScreen)
                        TouchRobot.await("Navigation icon is rendered") {
                            instrument.uiAutomation.takeScreenshot()?.let { image ->
                                try {
                                    (area.centerX() - 10..area.centerX() + 10 step 2).any { x ->
                                        (area.top + 6..area.top + 24 step 2).any { y ->
                                            android.graphics.Color.red(image.getPixel(x, y)) > 100
                                        }
                                    }
                                } finally { image.recycle() }
                            } ?: false
                        }
                    }
                    if (InstrumentationRegistry.getArguments().getString("captureCharacterHeader") == "true") {
                        instrument.uiAutomation.waitForIdle(350, 5_000)
                        val screenshot = requireNotNull(instrument.uiAutomation.takeScreenshot())
                        val crop = Bitmap.createBitmap(
                            screenshot, header.left.roundToInt(), header.top.roundToInt(),
                            header.width.roundToInt(), header.height.roundToInt(),
                        )
                        try {
                            File(instrument.targetContext.getExternalFilesDir(null), "header-$current.png")
                                .outputStream().use { crop.compress(Bitmap.CompressFormat.PNG, 100, it) }
                        } finally {
                            crop.recycle()
                            screenshot.recycle()
                        }
                    }
                    TouchRobot.click("К списку персонажей")
                }
                assertEquals(3, closes.get())
            }
        } finally {
            images.shutdown()
        }
    }
}
