package ru.dndshare.client.ui.character

import androidx.compose.runtime.compositionLocalOf
import coil3.ImageLoader
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

data class SheetContext(
    val sheet: CharacterSheet,
    val metadata: HandbookMetadata,
    val items: Map<Long, CatalogueItem>,
    val images: ImageLoader,
    val canEdit: Boolean,
    val edit: (String) -> Unit,
    val openItem: (Long) -> Unit,
    val mechanics: DndDerivedValues,
    val journal: SheetJournalState,
    val adjustResource: (String, Int) -> Unit = { _, _ -> },
    val uuid: String = "",
    val sessionUuid: String? = null,
    val sessionName: String = "",
    val concentration: JsonObject? = null,
    val roll: (ru.dndshare.client.character.SheetRollRequest) -> Unit = {},
    val itemMechanic: suspend (String, String, JsonObject) -> String? = { _, _, _ ->
        "Изменение недоступно."
    },
    val openSpell: ((String, Long) -> Unit)? = null,
    val icons: InventoryIconsState = InventoryIconsState(),
    val reloadIcons: () -> Unit = {},
    val canUndo: Boolean = false,
    val canRedo: Boolean = false,
    val history: (Boolean) -> Unit = {},
    val deathSave: suspend (String, Int) -> String? = { _, _ -> "Изменение недоступно." },
    val rollBusy: Boolean = false,
    val rerollForUse: (String, String) -> SheetRerollOffer? = { _, _ -> null },
    val reroll: (SheetRerollOffer) -> Unit = {},
    val resolvedItemIds: Set<Long>? = null,
    val fetchingContent: Boolean = false,
    val refreshContent: () -> Unit = {},
    val openEquipment: (Long, String) -> Unit = { id, _ -> openItem(id) },
    val weaponMenuTarget: String? = null,
    val dismissWeaponMenu: () -> Unit = {},
    val rollWeapon: (String, String, WeaponRollOptions) -> Unit = { _, _, _ -> },
    val weaponAction: (String, String, JsonObject) -> Unit = { _, _, _ -> },
    val reorderWeapons: suspend (List<String>) -> String? = { "Изменение порядка недоступно." },
)

internal fun CharacterSheetViewModel.sheetContext(
    ui: CharacterSheetUiState, sheet: CharacterSheet, mechanics: DndDerivedValues, images: ImageLoader, canEdit: Boolean,
): SheetContext =
    SheetContext(
        sheet,
        ui.content.metadata,
        ui.content.items,
        images,
        canEdit,
        edit = {
            if (canEdit || it in listOf("menu", "rest", "journal-refresh"))
                this.edit(it)
        },
        openItem = this::openItem,
        openEquipment = this::openEquipment,
        mechanics = mechanics,
        journal = ui.journal,
        adjustResource = this::adjustResource,
        uuid = this.uuid,
        icons = ui.content.icons,
        canUndo =
            ui.snapshot?.draft?.undo?.isNotEmpty() == true,
        canRedo =
            ui.snapshot?.draft?.redo?.isNotEmpty() == true,
        history = this::history,
        deathSave = this.health::deathSave,
        reloadIcons = this::reloadInventoryIcons,
        sessionUuid = ui.remote.sessionUuid,
        sessionName =
            ui.remote.sessions
                .firstOrNull {
                    it.uuid == ui.remote.sessionUuid
                }
                ?.name
                .orEmpty(),
        concentration = ui.campaign.concentration,
        roll = this.rolls::open,
        weaponMenuTarget = ui.navigation.overlay,
        dismissWeaponMenu = this::dismissOverlay,
        rollWeapon = this::confirmWeaponRoll,
        weaponAction = this::performWeaponAction,
        itemMechanic = this.itemMechanics::perform,
        openSpell = this::openSpell,
        rollBusy = ui.roll.busy,
        rerollForUse = this.rolls::rerollForUse,
        reroll = this.rolls::reroll,
        resolvedItemIds = ui.content.resolvedIds,
        fetchingContent = ui.content.fetching,
        refreshContent = this::refreshContent,
        reorderWeapons = this::reorderWeapons,
    )

val LocalCharacterSheet =
    compositionLocalOf<SheetContext> { error("Character sheet context is required") }


fun referencedItems(value: JsonElement): List<Long> = buildSet {
    fun collect(node: JsonElement) {
        when (node) {
            is JsonObject ->
                node.forEach { (key, child) ->
                    if (
                        key in
                            setOf(
                                "item_id",
                                "itemId",
                                "id",
                                "class_item_id",
                                "magic_item_id",
                                "effect_id",
                                "armor_base_item_id",
                                "weapon_base_item_id",
                            )
                    )
                        (child as? JsonPrimitive)?.longOrNull?.takeIf { it > 0 }?.let(::add)
                    if (key == "choices")
                        child.objectValue().values.forEach { selected ->
                            selected
                                .arrayValue()
                                .mapNotNull { it.referenceId() }
                                .filter { it > 0 }
                                .forEach(::add)
                        }
                    collect(child)
                }
            is JsonArray -> node.forEach(::collect)
            else -> Unit
        }
    }
    collect(value)
}
    .toList()
    .sorted()

data class SheetRerollOffer(
    val recordId: String,
    val key: String,
    val title: String,
    val useTargetUid: String = "",
    val useEventId: String = "",
)
