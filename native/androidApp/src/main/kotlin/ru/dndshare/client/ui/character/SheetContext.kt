package ru.dndshare.client.ui.character

import androidx.compose.runtime.compositionLocalOf
import coil3.ImageLoader
import kotlinx.serialization.json.*
import ru.dndshare.client.character.CharacterSheet
import ru.dndshare.client.character.DndDerivedValues
import ru.dndshare.client.data.CacheDao
import ru.dndshare.client.data.CatalogueRepository
import ru.dndshare.client.model.*

data class SheetContext(val sheet: CharacterSheet, val metadata: HandbookMetadata,
    val items: Map<Long, CatalogueItem>, val images: ImageLoader, val canEdit: Boolean,
    val edit: (String) -> Unit, val cache: CacheDao, val openItem: (Long) -> Unit,
    val mechanics: DndDerivedValues, val uuid: String, val repository: CatalogueRepository)

val LocalCharacterSheet = compositionLocalOf<SheetContext> { error("Character sheet context is required") }

fun referencedItems(value: JsonElement): List<Long> = buildSet {
    fun collect(node: JsonElement) {
        when (node) {
            is JsonObject -> node.forEach { (key, child) ->
                if (key in setOf("item_id", "id", "class_item_id", "magic_item_id", "effect_id", "armor_base_item_id", "weapon_base_item_id")) (child as? JsonPrimitive)?.longOrNull?.takeIf { it > 0 }?.let(::add)
                collect(child)
            }
            is JsonArray -> node.forEach(::collect)
            else -> Unit
        }
    }
    collect(value)
}.toList().sorted()
