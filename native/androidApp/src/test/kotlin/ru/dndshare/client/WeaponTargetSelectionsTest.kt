package ru.dndshare.client

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

class WeaponTargetSelectionsTest {
    private fun obj(text: String) = WireJson.parseToJsonElement(text).jsonObject

    @Test
    fun targetChoiceChangesTheSameRollsAdvantageAndCanBeReversed() {
        val sheet =
            CharacterSheet(
                "DND5",
                1,
                obj(
                    """{"values":{"lvl":{"level":5},"DEX":{"value":{"base":16}},"weapon":[{"uid":"bow","item_id":1,"magic_item_id":2,"params":{"magic":{"selected_target":{"id":"target","name":"Противник","status":"active","selected":false,"dawns_left":2}}}}]}}"""
                ),
                1,
            )
        val bow =
            CatalogueItem(
                1,
                1,
                "Лук",
                data =
                    obj(
                        """{"is_long_range":true,"attacks":[{"count":1,"dice_id":"d8","type":1}]}"""
                    ),
            )
        val magic =
            CatalogueItem(
                2,
                19,
                "Лук цели",
                data =
                    obj(
                        """{"attunement":"none","weapon":{"base_item_id":1},"selected_target":{"title":"Цель","duration_dawns":7,"cooldown_dawns":7,"attack_advantage":true,"other_weapons_disadvantage":true,"damage":{"dice":"d6","dice_count":2,"damage_type":1}}}"""
                    ),
            )
        val items = mapOf(1L to bow, 2L to magic)
        val metadata = HandbookMetadata(suggests = mapOf("12" to listOf(Suggest(1, 12, "Колющий"))))
        val key =
            weaponDamageActions(sheet, inventoryInstances(sheet).single().first, items, metadata)
                .single { it["target_choice"] is JsonObject }
                .text("key")
        val options = WeaponRollOptions(actionKeys = listOf(key))
        val next =
            sheet.copy(
                data =
                    applySheetPatches(
                        sheet.data,
                        weaponTargetSelectionPatches(sheet, "bow", options, items, metadata),
                    )
            )
        val request =
            SheetRollRequest(
                "Атака",
                "attack",
                ability = 2,
                weaponAttack = true,
                weaponKind = "ranged",
                targetUid = "bow",
            )
        assertEquals(
            "advantage",
            automaticRollMode(
                "auto",
                rollEffects(DndDerivedValues(next, items, metadata), request).first,
            ),
        )
        val restored =
            next.copy(
                data =
                    applySheetPatches(
                        next.data,
                        weaponTargetSelectionPatches(
                            next,
                            "bow",
                            options.copy(actionKeys = emptyList()),
                            items,
                            metadata,
                        ),
                    )
            )
        assertEquals(
            "normal",
            automaticRollMode(
                "auto",
                rollEffects(DndDerivedValues(restored, items, metadata), request).first,
            ),
        )
        assertEquals(sheet.data, restored.data)
    }
}
