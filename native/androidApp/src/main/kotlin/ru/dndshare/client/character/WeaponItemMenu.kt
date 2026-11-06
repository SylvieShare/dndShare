package ru.dndshare.client.character

import kotlinx.serialization.json.*
import ru.dndshare.client.model.CatalogueItem
import ru.dndshare.client.model.text

internal fun weaponItemMenuPatches(sheet: CharacterSheet, uid: String, operation: String, input: JsonObject,
    items: Map<Long, CatalogueItem>): List<SheetPatch> {
    val weapons = sheet.values["weapon"].arrayValue()
    val entry = weapons.map { it.objectValue() }.singleOrNull { it.text("uid") == uid } ?: error("Оружие недоступно.")
    if (operation == "weapon-attunement") {
        val item = items[(entry["magic_item_id"] ?: entry["item_id"]).referenceId()]
        val magic = entry["params"].objectValue()["magic"].objectValue()
        require(item?.typeId == 19L && item.data.text("attunement") != "none" && magic["lost"] != JsonPrimitive(true))
        return listOf(sheetFieldPatch(sheet, inventoryInstancePath(sheet, uid) + sheetPath("params", "magic", "attuned"),
            JsonPrimitive(input["attuned"] == JsonPrimitive(true))))
    }
    require(operation == "weapon-to-inventory" && entry["item_id"].referenceId() != null)
    val inventory = normalizeInventorySpaces(sheet.values["items"].objectValue())
    require(inventoryEntry(inventory, uid) == null) { "Экземпляр уже находится в вещах." }
    val sections = inventory["sections"].arrayValue().toMutableList()
    val bag = sections.first().objectValue()
    val owned = JsonObject(entry + ("count" to JsonPrimitive(1)))
    sections[0] = JsonObject(bag + ("items" to JsonArray(bag["items"].arrayValue() + owned)))
    val updated = normalizeInventorySpaces(JsonObject(inventory + ("sections" to JsonArray(sections))))
    return listOf(
        SheetPatch(path = sheetPath("values", "weapon"), value = JsonArray(weapons.filterNot { it.objectValue().text("uid") == uid })),
        SheetPatch(path = sheetPath("values", "items"), value = updated),
    )
}
