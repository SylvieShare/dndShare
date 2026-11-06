package ru.dndshare.client.character

import kotlinx.serialization.json.*
import ru.dndshare.client.model.*

data class WeaponMenuHit(val event: JsonObject, val step: JsonObject, val start: WeaponUsePlan?)

internal fun weaponMenuHit(
    sheet: CharacterSheet, uid: String, options: WeaponRollOptions, items: Map<Long, CatalogueItem>, metadata: HandbookMetadata,
): WeaponMenuHit? {
    if (options.useKey.isBlank() && options.useEventId.isBlank()) return null
    val start = options.useKey.takeIf { it.isNotBlank() }?.let { startWeaponUse(sheet, uid, it, items, metadata) }
    val event = start?.event ?: weaponUseState(sheet, uid)
    require(event.text("status") == "active" && (start != null || event.text("id") == options.useEventId)) {
        "Применение изменилось. Откройте меню заново."
    }
    val step = event["steps"].arrayValue().map { it.objectValue() }.singleOrNull {
        it.text("kind") == "weapon_damage" && it.text("status") == "pending" &&
            (start != null || it.text("key") == options.hitStep)
    } ?: error("Выберите один доступный шаг урона оружием.")
    return WeaponMenuHit(event, step, start)
}

internal fun WeaponDamagePlan.resultPatches(sheet: CharacterSheet, uid: String, critical: Boolean, result: SheetRollResult): List<SheetPatch> {
    val chosen = hit ?: return patches
    val paid = sheet.copy(data = applySheetPatches(sheet.data, patches))
    val completed = completeWeaponUseStep(chosen.event, chosen.step.text("key"), result, critical)
    return patches + weaponUsePatch(paid, uid, completed)
}
