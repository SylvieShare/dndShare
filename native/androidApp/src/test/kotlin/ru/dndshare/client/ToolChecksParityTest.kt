package ru.dndshare.client

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

class ToolChecksParityTest {
    @Test
    fun toolChecksMatchTheActualWebMathForManualAndDerivedProficiency() {
        val cases =
            WireJson.parseToJsonElement(
                    javaClass.classLoader!!
                        .getResourceAsStream("character-rules.json")!!
                        .bufferedReader()
                        .use { it.readText() }
                )
                .jsonObject["cases"]
                .arrayValue()
                .map { it.objectValue() }
                .filter { it.text("kind") == "toolCheck" }
        assertEquals(6, cases.size)
        for (case in cases) {
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
            val request =
                toolRollRequest(sheet, "tool", case["ability"].number().toLong(), items, meta)
            val expected = case["expected"].objectValue()
            assertEquals(expected["rank"].number(), request.proficiencyRank, case.text("name"))
            assertEquals(expected["bonus"].number(), request.bonus, case.text("name"))
            assertEquals(
                expected["modes"],
                JsonArray(
                    rollEffects(DndDerivedValues(sheet, items, meta), request)
                        .first
                        .map(::JsonPrimitive)
                ),
                case.text("name"),
            )
            assertEquals("ability_check", request.kind)
            assertEquals("tool", request.targetUid)
        }
    }
}
