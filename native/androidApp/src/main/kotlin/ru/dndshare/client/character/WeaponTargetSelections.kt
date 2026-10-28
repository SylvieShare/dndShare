package ru.dndshare.client.character

import kotlinx.serialization.json.*
import ru.dndshare.client.model.*

/** Commit target choice before calculating its advantage and damage effects. */
fun weaponTargetSelectionPatches(
    sheet: CharacterSheet,
    uid: String,
    options: WeaponRollOptions,
    items: Map<Long, CatalogueItem>,
    metadata: HandbookMetadata,
): List<SheetPatch> {
    val entry =
        inventoryInstances(sheet).firstOrNull { it.first.text("uid") == uid }?.first
            ?: error("Оружие больше не существует.")
    val actions = weaponDamageActions(sheet, entry, items, metadata)
    val selected =
        selectedWeaponDamageRules(actions, options.actionKeys).map { it.text("key") }.toSet()
    var working = sheet
    return buildList {
        for (rule in actions) {
            val target = rule["target_choice"] as? JsonObject ?: continue
            val checked = rule.text("key") in selected
            if (checked == (target["selected"] == JsonPrimitive(true))) continue
            val patches =
                selectedTargetPatch(
                    working,
                    items,
                    target.text("uid"),
                    "select",
                    buildJsonObject {
                        put("id", target.text("id"))
                        put("selected", checked)
                    },
                )
            addAll(patches)
            working = working.copy(data = applySheetPatches(working.data, patches))
        }
    }
}
