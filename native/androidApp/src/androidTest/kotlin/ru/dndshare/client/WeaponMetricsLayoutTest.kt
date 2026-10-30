package ru.dndshare.client

import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ActivityScenario
import kotlin.test.*
import kotlinx.serialization.json.JsonObject
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.CatalogueItem
import ru.dndshare.client.ui.character.WeaponMetricsTable
import ru.dndshare.client.ui.designsystem.*

class WeaponMetricsLayoutTest {
    @Test
    fun labelledTableAdaptsToCardWidthAndLargeText() {
        val weapon =
            WeaponReadout(
                JsonObject(emptyMap()),
                CatalogueItem(1, 1, "Посох"),
                1,
                true,
                7,
                4,
                3,
                listOf(WeaponDamagePart(1, 6, "Дробящий", color = "#fbbf24")),
                listOf(WeaponDamagePart(1, 8, "Дробящий", color = "#fbbf24")),
                listOf("Универсальное", "Метательное"),
                "20/60",
                20,
                0,
            )
        ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
            for ((width, scale) in listOf(282 to 1f, 340 to 1f, 550 to 1f, 282 to 1.5f)) {
                scenario.onActivity { host ->
                    host.setContent {
                        CompositionLocalProvider(LocalDensity provides Density(1f, scale)) {
                            ShareTheme {
                                Box(
                                    Modifier.fillMaxSize()
                                        .background(WebPalette.Surface)
                                        .windowInsetsPadding(WindowInsets.safeDrawing)
                                        .padding(20.dp)
                                ) {
                                    WeaponMetricsTable(
                                        "Посох",
                                        weapon,
                                        Modifier.width(width.dp).semantics {
                                            contentDescription = "Таблица оружия"
                                        },
                                    )
                                }
                            }
                        }
                    }
                }
                TouchRobot.await("table at $width dp") {
                    TouchRobot.find("Свойства") != null && TouchRobot.bounds("Таблица оружия").width() == width
                }
                val table = TouchRobot.bounds("Таблица оружия")
                val attack = TouchRobot.bounds("Атака")
                val damage = TouchRobot.bounds("Урон")
                val properties = TouchRobot.bounds("Свойства")
                assertEquals(attack.top, damage.top)
                if (width < 380 * scale) assertTrue(properties.top > damage.bottom)
                else assertEquals(attack.top, properties.top)
                listOf("к6: 6", "к8: 8", "Универсальное · Метательное").forEach { label ->
                    val item = TouchRobot.bounds(label)
                    assertTrue(
                        table.contains(item),
                        "$label clipped at width $width, text scale $scale: $item outside $table",
                    )
                    assertTrue(item.height() > 0)
                }
            }
        }
    }
}
