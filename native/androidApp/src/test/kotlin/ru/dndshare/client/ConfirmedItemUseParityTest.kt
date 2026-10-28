package ru.dndshare.client

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

class ConfirmedItemUseParityTest {
    private fun obj(value: String) = WireJson.parseToJsonElement(value).jsonObject

    private fun normalized(raw: JsonElement): JsonElement =
        when (raw) {
            is JsonArray -> JsonArray(raw.map(::normalized))
            is JsonObject ->
                JsonObject(
                    raw.filterKeys { it !in setOf("created_at", "resolved_at", "undone_at") }
                        .mapValues { (key, value) ->
                            normalized(
                                if (key == "last_charge_check")
                                    JsonObject(
                                        value.objectValue() + ("id" to JsonPrimitive("check"))
                                    )
                                else value
                            )
                        }
                )
            else -> raw
        }

    @Test
    fun explicitUseChargeLossUndoAndDawnMatchWebWithoutTouchingTheOtherCopy() {
        val raw =
            javaClass.classLoader!!
                .getResourceAsStream("character-rules.json")!!
                .bufferedReader()
                .use { it.readText() }
        val cases =
            obj(raw)["cases"]
                .arrayValue()
                .map { it.objectValue() }
                .filter { it.text("kind") == "confirmedUse" }
        assertEquals(9, cases.size)
        for (case in cases) {
            val items =
                case["catalogue"]
                    .arrayValue()
                    .map { WireJson.decodeFromJsonElement<CatalogueItem>(it) }
                    .associateBy { it.id }
            var sheet =
                CharacterSheet(
                    "DND5",
                    1,
                    buildJsonObject { put("values", case.getValue("values")) },
                    1,
                )
            fun apply(patches: List<SheetPatch>) {
                sheet = sheet.copy(data = applySheetPatches(sheet.data, patches))
            }
            val scenario = case.text("scenario")
            if (scenario == "dawn") apply(advanceItemUseCooldowns(sheet, items))
            else {
                val use =
                    confirmedItemUses(sheet, items, "one").firstOrNull {
                        it.key == case.text("useKey")
                    }
                if (use?.error?.isBlank() == true)
                    apply(confirmItemUsePatches(sheet, items, "one", use.key))
                else
                    assertFailsWith<IllegalArgumentException> {
                        confirmItemUsePatches(sheet, items, "one", case.text("useKey"))
                    }
                if (scenario in setOf("last-charge", "safe-charge", "undo")) {
                    val id = lastChargeCheck(sheet, "one").text("id")
                    assertFailsWith<IllegalArgumentException> {
                        resolveLastChargePatches(sheet, "one", "stale", 1)
                    }
                    apply(
                        resolveLastChargePatches(
                            sheet,
                            "one",
                            id,
                            if (scenario == "safe-charge") 20 else 1,
                        )
                    )
                    assertFailsWith<IllegalArgumentException> {
                        resolveLastChargePatches(sheet, "one", id, 1)
                    }
                    if (scenario == "undo") {
                        apply(undoLastChargePatches(sheet, "one", id))
                        assertFailsWith<IllegalArgumentException> {
                            undoLastChargePatches(sheet, "one", id)
                        }
                    }
                }
            }
            assertEquals(case["expected"], normalized(sheet.values), case.text("name"))
            if (scenario == "last-charge") {
                assertTrue(
                    resourceControls(sheet, items, true).none { it.owner?.entryKey == "one" }
                )
                val restored =
                    sheet.copy(
                        data =
                            applySheetPatches(
                                sheet.data,
                                restPatches(sheet, obj("""{"kind":"dawn"}"""), items),
                            )
                    )
                assertEquals(lastChargeCheck(sheet, "one"), lastChargeCheck(restored, "one"))
                val entry =
                    inventoryInstances(restored).first { it.first.text("uid") == "one" }.first
                assertEquals(
                    JsonPrimitive(0),
                    entry["params"]
                        .objectValue()["magic"]
                        .objectValue()["resource_counts"]
                        .objectValue()["wishes"],
                )
            }
        }
    }
}
