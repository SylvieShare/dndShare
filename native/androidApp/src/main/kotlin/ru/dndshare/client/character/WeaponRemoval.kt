package ru.dndshare.client.character

import kotlinx.serialization.json.*
import ru.dndshare.client.model.*

/** Remove one owned instance and only statuses targeting that instance, atomically. */
fun weaponRemovalPatches(sheet: CharacterSheet, uid: String): List<SheetPatch> {
    val weapons = sheet.values["weapon"].arrayValue()
    require(weapons.any { it.objectValue().text("uid") == uid }) { "Оружие больше недоступно." }
    val states = sheet.values["states"].arrayValue()
    val remaining = states.filterNot {
        it.objectValue()["params"].objectValue().text("weapon_uid") == uid
    }
    return buildList {
        add(
            SheetPatch(
                path = sheetPath("values", "weapon"),
                value = JsonArray(weapons.filterNot { it.objectValue().text("uid") == uid }),
            )
        )
        if (remaining != states)
            add(SheetPatch(path = sheetPath("values", "states"), value = JsonArray(remaining)))
    }
}
