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

@OptIn(androidx.compose.ui.ExperimentalComposeUiApi::class)
class WeaponMetricsLayoutTest {
    @Test
    fun cellsFitEachWeaponsContentAndKeepAttackCentered() {
        val base =
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
        val simple =
            base.copy(
                parts = listOf(WeaponDamagePart(1, 6, "Колющий", color = "#94a3b8")),
                twoHanded = emptyList(),
                damageBonus = 0,
                properties = listOf("Метательное"),
            )
        val cases =
            listOf(
                Case(282, 1f, base, false),
                Case(340, 1f, base, null),
                Case(550, 1f, base, true),
                Case(282, 1.5f, base, false),
                Case(282, 1f, simple, true),
                Case(282, 1f, simple.copy(properties = emptyList()), false),
                Case(282, 1f, simple.copy(parts = List(6) { simple.parts.first() }), false),
            )
        ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
            cases.forEachIndexed { index, case ->
                val title = "Таблица оружия $index"
                scenario.onActivity { host ->
                    host.setContent {
                        CompositionLocalProvider(LocalDensity provides Density(1f, case.scale)) {
                            ShareTheme {
                                Box(
                                    Modifier.fillMaxSize()
                                        .background(WebPalette.Surface)
                                        .windowInsetsPadding(WindowInsets.safeDrawing)
                                        .padding(20.dp)
                                ) {
                                    WeaponMetricsTable(
                                        "Посох",
                                        case.weapon,
                                        Modifier.width(case.width.dp).semantics {
                                            contentDescription = title
                                            testTagsAsResourceId = true
                                        },
                                        propertyDescriptions =
                                            mapOf(
                                                "Универсальное" to
                                                    "<p>Можно использовать двумя руками.</p>",
                                                "Метательное" to "<p>Можно метнуть.</p>",
                                            ),
                                    )
                                }
                            }
                        }
                    }
                }
                TouchRobot.await(title) {
                    TouchRobot.find(title) != null && TouchRobot.bounds(title).width() == case.width
                }
                val table = TouchRobot.bounds(title)
                val attack =
                    android.graphics.Rect().also {
                        requireNotNull(
                                TouchRobot.findNode {
                                    it.viewIdResourceName == "weapon-attack-cell"
                                }
                            )
                            .getBoundsInScreen(it)
                    }
                assertEquals(attack.width(), attack.height(), "Attack cell must be square")
                val value = TouchRobot.bounds("Атака: Посох")
                assertTrue(
                    kotlin.math.abs(attack.exactCenterX() - value.exactCenterX()) <= 1f,
                    "Attack horizontal centre, case $index",
                )
                assertTrue(
                    kotlin.math.abs(attack.exactCenterY() - value.exactCenterY()) <= 1f,
                    "Attack vertical centre, case $index",
                )
                if (case.weapon.properties.isEmpty()) assertNull(TouchRobot.find("Свойства"))
                else {
                    val properties = TouchRobot.bounds("Свойства")
                    assertTrue(properties.top > TouchRobot.bounds("Урон").bottom)
                    case.weapon.properties.forEach { label ->
                        val item = TouchRobot.bounds(label)
                        assertTrue(item.left >= table.left && item.right <= table.right)
                        assertTrue(table.contains(item.centerX(), item.centerY()))
                    }
                    val property = case.weapon.properties.first()
                    val description =
                        if (property == "Универсальное") "Можно использовать двумя руками."
                        else "Можно метнуть."
                    TouchRobot.click(property)
                    TouchRobot.await("description opens") {
                        TouchRobot.findNode { it.text?.toString()?.trim() == description } != null
                    }
                    TouchRobot.click("Понятно")
                    TouchRobot.await("description closes") {
                        TouchRobot.find(title) != null &&
                            TouchRobot.find("к6: 6") != null &&
                            TouchRobot.findNode { it.text?.toString()?.trim() == description } ==
                                null
                    }
                }
                val die = TouchRobot.bounds("к6: 6")
                assertTrue(table.contains(die) && die.height() > 0, "Damage must fit, case $index")
            }
        }
    }

    private data class Case(
        val width: Int,
        val scale: Float,
        val weapon: WeaponReadout,
        val inline: Boolean?,
    )
}
