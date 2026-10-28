package ru.dndshare.client

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

class SpellMathParityTest {
    @Test
    fun scaledTypedDamageHealingAndGrantedAbilitiesMatchTheActualWebCalculator() {
        val source =
            javaClass.classLoader!!
                .getResourceAsStream("character-rules.json")!!
                .bufferedReader()
                .use { it.readText() }
        val cases =
            WireJson.parseToJsonElement(source)
                .jsonObject["cases"]
                .arrayValue()
                .map { it.objectValue() }
                .filter { it.text("kind") == "spellMath" }
        assertEquals(11, cases.size)
        for (case in cases) {
            val items =
                case["catalogue"]
                    .arrayValue()
                    .map { WireJson.decodeFromJsonElement<CatalogueItem>(it) }
                    .associateBy { it.id }
            val metadata =
                WireJson.decodeFromJsonElement<HandbookMetadata>(case.getValue("metadata"))
            val sheet =
                CharacterSheet(
                    "DND5",
                    1,
                    buildJsonObject { put("values", case.getValue("values")) },
                    1,
                )
            val readout = spellReadout(sheet, "spell", items, metadata)
            val options = WireJson.decodeFromJsonElement<SpellRollOptions>(case.getValue("options"))
            val rule = spellRuleOptions(readout.item).first { it.key == options.optionKey }
            val terms = spellRollTerms(sheet, readout, rule, options, items, metadata)
            val actual = buildJsonObject {
                put("ability", readout.ability)
                put("modifier", readout.modifier)
                put("attack", readout.attack)
                put("save", readout.save)
                put(
                    "terms",
                    JsonArray(
                        terms.map {
                            buildJsonObject {
                                put("expression", it.expression)
                                put("label", it.label)
                                put("color", it.color)
                            }
                        }
                    ),
                )
            }
            assertEquals(case["expected"], actual, case.text("name"))
        }
    }
}
