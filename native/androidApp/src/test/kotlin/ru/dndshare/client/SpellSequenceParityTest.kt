package ru.dndshare.client

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

class SpellSequenceParityTest {
    @Test
    fun eventFreezesTheSameCastRulesAndProjectilesAsWeb() {
        val raw =
            javaClass.classLoader!!
                .getResourceAsStream("character-rules.json")!!
                .bufferedReader()
                .use { it.readText() }
        val cases =
            WireJson.parseToJsonElement(raw)
                .jsonObject["cases"]
                .arrayValue()
                .map { it.objectValue() }
                .filter { it.text("kind") == "spellSequence" }
        assertEquals(3, cases.size)
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
            val metadata =
                WireJson.decodeFromJsonElement<HandbookMetadata>(case.getValue("metadata"))
            val options = WireJson.decodeFromJsonElement<SpellRollOptions>(case.getValue("options"))
            val request = spellRollRequest(sheet, "spell", options, items, metadata)
            val result =
                rollSheet(request, DndDerivedValues(sheet, items, metadata), natural = listOf(12))
            assertEquals(
                case["expected"],
                diceEventData(request, result)["sequence"],
                case.text("name"),
            )
            assertNull(items[5L]?.data?.get("hits"))
        }
    }

    @Test
    fun onlyDamageOfTheHeldSpellLinksToItsCast() {
        val request = SheetRollRequest("Урон", "damage", sourceItemId = 5, spellKey = "book:spell")
        val event = buildJsonObject { put("entryKey", "book:spell") }
        val held = buildJsonObject {
            put("id", "cast")
            put("spellId", 5)
        }
        assertEquals(JsonPrimitive("cast"), spellConcentrationData(request, event, held)["castId"])
        assertEquals(event, spellConcentrationData(request.copy(sourceItemId = 6), event, held))
        assertEquals(event, spellConcentrationData(request.copy(kind = "attack"), event, held))
        assertEquals(event, spellConcentrationData(request.copy(kind = "heal"), event, held))
        assertEquals(event, spellConcentrationData(request, event, null))
    }
}
