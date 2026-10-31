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
    val reorderWeapons: suspend (List<String>) -> String? = { "Изменение порядка недоступно." },
)

val LocalCharacterSheet =
    compositionLocalOf<SheetContext> { error("Character sheet context is required") }

val LocalSheetEditorPreview = compositionLocalOf<SheetEditorState?> { null }

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
