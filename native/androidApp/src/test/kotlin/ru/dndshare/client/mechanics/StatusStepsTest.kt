package ru.dndshare.client.mechanics

import kotlinx.serialization.json.*
import kotlin.test.assertEquals
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

class StatusStepsTest {
    @Test
    fun theSamePoisonAndRepeatedSavesAsTheWeb() {
        val cases = javaClass.getResource("/game-mechanics/status-steps.json")!!.readText()
        for (row in WireJson.parseToJsonElement(cases).jsonArray.map(JsonElement::jsonObject)) {
            val step = row.text("step")
            val params = buildJsonObject {
                row["phase"]?.let { put("damage_phase", it) }
                put("damage_dice", row["dice"].number(3))
                row["storedDC"]?.let { put("save_dc", it) }
            }
            val state = buildJsonObject { put("uid", "test"); put("effect_id", 21); put("params", params) }
            val sheet = CharacterSheet("DND5", 1, buildJsonObject {
                put("values", buildJsonObject {
                    put("states", JsonArray(listOf(state)))
                    put("hp", buildJsonObject { put("current", 15); put("temp", 2) })
                    put("defenses", JsonArray(row["defenses"].arrayValue().map {
                        buildJsonObject { put("kind", it); put("damage_type", 2) }
                    }))
                })
            }, 1)
            val item = CatalogueItem(21, 15, "Эффект", data = buildJsonObject {
                if (step == "repeat") put("repeat_save", buildJsonObject { put("ability", 3); row["dc"]?.let { put("dc", it) } })
                else put("ongoing_damage", buildJsonObject {
                    put("dice_count", 3); put("dice", "d6"); put("damage_type", 2); put("decrease_on_save", 1); put("save_dc", 12)
                })
            })
            val items = mapOf(21L to item)
            val status = requireNotNull(statusMechanic(sheet, items, "test"))
            val actual = buildJsonObject {
                if (step == "repeat" && status.repeatDC == null) { put("available", false); return@buildJsonObject }
                val binding = status.bind(step)
                val total = row["total"].number()
                val states = if (step == "damage") {
                    val changes = statusDamagePatches(sheet, items, binding, total)
                    val updated = sheet.copy(data = applySheetPatches(sheet.data, changes))
                    val hp = updated.values["hp"].objectValue()
                    put("hp", hp.getValue("current")); put("temp", hp.getValue("temp"))
                    updated.values["states"].arrayValue()
                } else statusSaveOutcomes(sheet, items, binding).resolve(total)
                if (states.isEmpty() || step == "repeat") put("ended", states.isEmpty())
                else {
                    val after = states.single().jsonObject["params"].objectValue()
                    put("phase", after.getValue("damage_phase")); put("dice", after.getValue("damage_dice"))
                }
            }
            assertEquals(row["expect"], actual, row.toString())
        }
    }
}
