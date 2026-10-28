package ru.dndshare.client.character

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import ru.dndshare.client.model.*

fun weaponAttackRequest(
    sheet: CharacterSheet,
    uid: String,
    options: WeaponRollOptions,
    items: Map<Long, CatalogueItem>,
    metadata: HandbookMetadata,
): SheetRollRequest {
    val encoded = WireJson.parseToJsonElement(WireJson.encodeToString(options)).jsonObject
    val entry =
        inventoryInstances(sheet).firstOrNull { it.first.text("uid") == uid }?.first
            ?: error("Оружие больше не существует.")
    val actions = weaponDamageActions(sheet, entry, items, metadata)
    val thrown =
        selectedWeaponDamageRules(actions, options.actionKeys).any {
            it.text("attack_mode") == "thrown"
        }
    val weapon =
        weaponReadout(sheet, entry, items, metadata, thrown) ?: error("Дождитесь загрузки оружия.")
    val improvised = thrown && !naturalThrownWeapon(weapon.item, weapon.properties)
    return SheetRollRequest(
        "Атака: ${weapon.item.name}",
        "attack",
        weapon.ability,
        bonus = weapon.attack,
        manualMode = options.mode,
        weaponAttack = true,
        weaponKind =
            if (thrown || weapon.item.data["is_long_range"] == JsonPrimitive(true)) "ranged"
            else "melee",
        improvised = improvised,
        targetUid = uid,
        sourceItemId = weapon.item.id.takeIf { it > 0 },
        sourceName = weapon.item.name,
        criticalThreshold = weapon.criticalThreshold,
        proficiencyRank = if (weapon.proficient) 1 else 0,
        excludedBonuses = options.excludedBonuses,
        weaponOptions = encoded,
    )
}
