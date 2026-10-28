package ru.dndshare.client

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.character.creation.*
import ru.dndshare.client.model.*

class CharacterRuleParityTest {
    @Test
    fun restMatchesTheActualWebRulesInBothEditions() {
        val file =
            javaClass.classLoader!!
                .getResourceAsStream("character-rules.json")!!
                .bufferedReader()
                .use { it.readText() }
        val cases = WireJson.parseToJsonElement(file).jsonObject.getValue("cases").jsonArray
        assertEquals(127, cases.size)
        for (raw in
            cases.filter { it.jsonObject.text("kind") in setOf("longHp", "spendHp", "slots") }) {
            val case = raw.jsonObject
            val kind = case.text("kind")
            val values = buildJsonObject {
                if (kind == "slots") put("spells", case.getValue("spells"))
                else put("hp", case.getValue("hp"))
            }
            val sheet =
                CharacterSheet(
                    "DND5",
                    1,
                    buildJsonObject { put("values", values) },
                    1,
                    sourceVersion = case.text("version").ifBlank { "2014" },
                )
            val input = buildJsonObject {
                put(
                    "kind",
                    if (kind == "longHp") "long"
                    else if (kind == "spendHp") "short" else case.text("rest"),
                )
                case["recovery"]?.takeUnless { it == JsonNull }?.let { put("recovery", it) }
                if (kind == "spendHp")
                    put(
                        "hitDiceSpent",
                        buildJsonArray {
                            add(
                                buildJsonObject {
                                    put("die", case.getValue("die"))
                                    put("healing", case.getValue("amount"))
                                }
                            )
                        },
                    )
            }
            val result =
                applySheetPatches(sheet.data, restPatches(sheet, input, emptyMap()))
                    .getValue("values")
                    .jsonObject
            assertEquals(
                case["expected"],
                result[if (kind == "slots") "spells" else "hp"],
                case.text("name"),
            )
        }
    }

    @Test
    fun advancementMatchesTheWebForAsiPactAndRacialSpellUnlock() {
        val cases =
            WireJson.parseToJsonElement(
                    javaClass.classLoader!!
                        .getResourceAsStream("character-rules.json")!!
                        .bufferedReader()
                        .use { it.readText() }
                )
                .jsonObject
                .getValue("cases")
                .jsonArray
        for (raw in cases.filter { it.jsonObject.text("kind") == "advancement" }) {
            val case = raw.jsonObject
            val items =
                case
                    .getValue("catalogue")
                    .jsonArray
                    .map { WireJson.decodeFromJsonElement<CatalogueItem>(it) }
                    .associateBy { it.id }
            val sheet =
                CharacterSheet(
                    "DND5",
                    1,
                    buildJsonObject { put("values", case.getValue("values")) },
                    1,
                    sourceVersion = "2014",
                )
            val patches =
                levelAdvancementPatches(
                    LevelAdvancement(sheet, case.getValue("input").jsonObject, items)
                )
            val actual = applySheetPatches(sheet.data, patches)["values"].objectValue()
            for ((key, expected) in case.getValue("expected").jsonObject) {
                if (case.text("name") == "pact-upgrade" && key == "spells")
                    assertEquals(
                        expected.jsonObject["slot_pools"],
                        actual[key].objectValue()["slot_pools"],
                        case.text("name"),
                    )
                else assertEquals(expected, actual[key], "${case.text("name")}: $key")
            }
        }
    }

    @Test
    fun creationMatchesWebStatsHealthSkillsAndProficiencies() {
        val file =
            javaClass.classLoader!!
                .getResourceAsStream("character-rules.json")!!
                .bufferedReader()
                .use { it.readText() }
        val cases = WireJson.parseToJsonElement(file).jsonObject.getValue("cases").jsonArray
        for (raw in cases.filter { it.jsonObject.text("kind") == "creation" }) {
            val case = raw.jsonObject
            val catalogue =
                case.getValue("catalogue").jsonArray.map {
                    WireJson.decodeFromJsonElement<CatalogueItem>(it)
                }
            val metadata =
                HandbookMetadata(
                    suggests =
                        listOf(3L, 4L, 5L, 6L).associate { type ->
                            type.toString() to (1L..4L).map { Suggest(it, type, "label-$type-$it") }
                        }
                )
            val draft =
                CreationDraft(
                    name = "Тестовый герой",
                    version = case.text("version"),
                    method = "point",
                    selected = mapOf("race" to 81L, "charClass" to 91L, "background" to 111L),
                    choices = mapOf("classSkills" to listOf("2")),
                    scores = creationStats.zip(listOf(15, 14, 13, 12, 10, 8)).toMap(),
                    backgroundAsi =
                        if (case.text("version") == "2024") mapOf("DEX" to 2, "CON" to 1)
                        else emptyMap(),
                )
            val actual =
                assembleCharacter(
                        CreationContext(draft, catalogue, metadata, JsonObject(emptyMap()))
                    )
                    .getValue("values")
                    .jsonObject
            for ((key, expected) in case.getValue("expected").jsonObject) assertEquals(
                expected,
                actual[key],
                "${case.text("name")}: $key",
            )
        }
    }

    @Test
    fun weaponsMatchActualWebForFinesseMagicProficienciesThrowingAndCriticals() {
        val fixtures =
            WireJson.parseToJsonElement(
                    javaClass.classLoader!!
                        .getResourceAsStream("character-rules.json")!!
                        .bufferedReader()
                        .use { it.readText() }
                )
                .jsonObject
                .getValue("cases")
                .jsonArray
                .filter { it.jsonObject.text("kind") == "weapon" }
        assertEquals(8, fixtures.size)
        for (raw in fixtures) {
            val case = raw.jsonObject
            val items =
                case
                    .getValue("catalogue")
                    .jsonArray
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
            val result =
                requireNotNull(
                    weaponReadout(
                        sheet,
                        case.getValue("entry").jsonObject,
                        items,
                        metadata,
                        case["thrown"] == JsonPrimitive(true),
                    )
                )
            val expected = case.getValue("expected").jsonObject
            assertEquals(expected["attack"].number(), result.attack, "${case.text("name")}: attack")
            assertEquals(
                expected["damageBonus"].number(),
                result.damageBonus,
                "${case.text("name")}: modifier",
            )
            assertEquals(
                expected.text("expression"),
                result.expression(),
                "${case.text("name")}: damage",
            )
            assertEquals(
                expected.text("critical"),
                result.expression(critical = true),
                "${case.text("name")}: critical",
            )
            assertEquals(
                expected["threshold"].number(),
                result.criticalThreshold,
                "${case.text("name")}: threshold",
            )
            assertEquals(
                expected["ability"].referenceId(),
                result.ability,
                "${case.text("name")}: ability",
            )
        }
    }

    @Test
    fun diceTypesAliasesMultiplicationAndChargeStocksMatchTheWeb() {
        val cases =
            WireJson.parseToJsonElement(
                    javaClass.classLoader!!
                        .getResourceAsStream("character-rules.json")!!
                        .bufferedReader()
                        .use { it.readText() }
                )
                .jsonObject
                .getValue("cases")
                .jsonArray
                .map { it.jsonObject }
        assertEquals(6, cases.count { it.text("kind") == "dice" })
        assertEquals(4, cases.count { it.text("kind") == "stocks" })
        for (case in cases) when (case.text("kind")) {
            "dice" -> {
                var draw = 0
                val actual = rollDice(case.text("formula")) { sides -> (++draw % sides) + 1 }
                val result = buildJsonObject {
                    put("parts", JsonArray(actual.parts))
                    put("byType", JsonArray(actual.byType))
                    put("total", actual.total)
                    put("expression", actual.formula)
                }
                assertEquals(case["expected"], result, case.text("name"))
            }
            "stocks" -> {
                val item =
                    CatalogueItem(
                        id = 2001,
                        typeId = 19,
                        name = "Артефакт",
                        data = case.getValue("data").jsonObject,
                    )
                assertEquals(
                    case["expected"],
                    initializeMagicCharges(
                        item,
                        case.getValue("previous").jsonObject,
                        case.getValue("proposed").jsonObject,
                    ),
                    case.text("name"),
                )
            }
        }
    }
}
