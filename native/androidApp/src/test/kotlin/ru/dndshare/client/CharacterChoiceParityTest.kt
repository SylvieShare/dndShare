package ru.dndshare.client

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.character.creation.itemChoiceMatches
import ru.dndshare.client.model.*

class CharacterChoiceParityTest {
    private fun cases() =
        WireJson.parseToJsonElement(
                javaClass.classLoader!!
                    .getResourceAsStream("character-rules.json")!!
                    .bufferedReader()
                    .use { it.readText() }
            )
            .jsonObject["cases"]
            .arrayValue()
            .map { it.objectValue() }

    @Test
    fun expertiseEligibilityAndDynamicFiltersMatchActualWebFunctions() {
        val cases = cases().filter { it.text("kind") in setOf("characterChoice", "choiceFilter") }
        assertEquals(9, cases.size)
        for (case in cases) {
            if (case.text("kind") == "choiceFilter") {
                val filter =
                    choiceFilter(case["choice"].objectValue(), case["selections"].objectValue())
                assertEquals(
                    case["expected"].takeUnless { it == JsonNull },
                    filter,
                    case.text("name"),
                )
                val item = WireJson.decodeFromJsonElement<CatalogueItem>(case.getValue("candidate"))
                assertEquals(
                    case["matches"],
                    JsonPrimitive(itemChoiceMatches(item, filter)),
                    case.text("name"),
                )
                continue
            }
            val sheet =
                CharacterSheet(
                    "DND5",
                    1,
                    buildJsonObject { put("values", case.getValue("values")) },
                    1,
                )
            val items =
                case["catalogue"]
                    .arrayValue()
                    .map { WireJson.decodeFromJsonElement<CatalogueItem>(it) }
                    .associateBy { it.id }
            val meta =
                HandbookMetadata(
                    suggests =
                        case["suggests"].objectValue().mapValues { (_, raw) ->
                            raw.arrayValue().map { WireJson.decodeFromJsonElement<Suggest>(it) }
                        }
                )
            assertEquals(
                case["rank"].number(),
                characterChoiceRank(case.text("value"), sheet, items, meta),
                case.text("name"),
            )
            val errors =
                characterChoiceErrors(
                    case["choice"].objectValue(),
                    case.text("value"),
                    sheet,
                    items,
                    meta,
                )
            assertEquals(
                case["expected"].objectValue()["eligible"],
                JsonPrimitive(errors.isEmpty()),
                case.text("name"),
            )
            assertEquals(
                case["expected"].objectValue().text("reason"),
                errors.firstOrNull().orEmpty(),
                case.text("name"),
            )
        }
    }
}
