package ru.dndshare.client

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

class RollTriggersTest {
    private fun obj(value: String) = WireJson.parseToJsonElement(value).jsonObject

    private val sheet =
        CharacterSheet(
            "DND5",
            1,
            obj(
                """{"values":{"lvl":{"level":5},"weapon":[{"uid":"one","item_id":1,"magic_item_id":2,"params":{"magic":{"remaining":1}}}]}}"""
            ),
            1,
        )
    private val blade =
        CatalogueItem(
            2,
            19,
            "Клинок удачи",
            data =
                obj(
                    """{"attunement":"none","weapon":{"base_item_id":1},"max_use":1,"confirmed_uses":[{"key":"luck","title":"Удача","confirm_label":"Подтвердить","resource_cost":1}],"roll_triggers":[{"key":"luck","event":"any","action":"reroll","scopes":["ability_check"],"use_key":"luck"}]}"""
                ),
        )
    private val request = SheetRollRequest("Проверка", "skill_check", bonus = 3)
    private val items = mapOf(2L to blade)

    private fun record(action: RollTriggerAction) =
        SheetRollRecord(
            "first",
            request,
            SheetRollResult("Проверка", "normal", listOf(1), 1, 3, total = 4),
            PreparedD20Roll(request, "normal", 3, emptyList(), 0, emptyList()),
            listOf(action),
            completedAt = 1,
        )

    @Test
    fun paidRerollRequiresTheOwnedActiveCopyAndRechecksItsStock() {
        val action = rollTriggerCandidates(sheet, items, request, true).single()
        assertEquals("one", action.useUid)
        assertEquals("luck", action.useKey)
        assertTrue(rollTriggerCandidates(sheet, items, request, false).isEmpty())
        assertTrue(
            rollTriggerCandidates(sheet, items, request.copy(kind = "attack"), true).isEmpty()
        )
        val first = record(action)
        assertEquals(action, revalidateRollTrigger(sheet, items, first, action.key, true))
        val depleted =
            sheet.copy(
                data =
                    applySheetPatches(
                        sheet.data,
                        confirmItemUsePatches(sheet, items, "one", "luck"),
                    )
            )
        assertFailsWith<IllegalStateException> {
            revalidateRollTrigger(depleted, items, first, action.key, true)
        }
        assertEquals(
            JsonPrimitive(1),
            inventoryInstances(sheet)
                .single()
                .first["params"]
                .objectValue()["magic"]
                .objectValue()["remaining"],
        )
        assertTrue(first.copy(reroll = true).actions().isEmpty())
    }

    @Test
    fun naturalOneUsesTheKeptNaturalBeforeMinimumAdjustmentsAndNeverChains() {
        val action = RollTriggerAction("halfling", "Везучий", "natural_one")
        val first = record(action)
        assertEquals(
            listOf(action),
            first
                .copy(
                    result =
                        first.result.copy(
                            total = 13,
                            adjustments = listOf(obj("""{"kind":"minimum_natural","value":10}""")),
                        )
                )
                .actions(),
        )
        assertTrue(
            first
                .copy(result = first.result.copy(rolls = listOf(1, 19), selected = 19))
                .actions()
                .isEmpty()
        )
        assertTrue(first.copy(reroll = true).actions().isEmpty())
    }

    @Test
    fun lostMagicCannotOfferARerollEvenWhenAChargeRemains() {
        val entry = inventoryInstances(sheet).single().first
        val lost =
            JsonObject(entry + ("params" to obj("""{"magic":{"remaining":1,"lost":true}}""")))
        val current =
            sheet.copy(
                data =
                    applySheetPatches(
                        sheet.data,
                        listOf(
                            SheetPatch(
                                path = sheetPath("values", "weapon"),
                                value = JsonArray(listOf(lost)),
                            )
                        ),
                    )
            )
        assertTrue(rollTriggerCandidates(current, items, request, true).isEmpty())
    }
}
