package ru.dndshare.client.ui.character

import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.character.creation.itemChoices
import ru.dndshare.client.model.*

/** Follow only links reachable from current owners; old cycles must not retain unrelated rows. */
internal fun sheetContentDependencies(
    sheet: CharacterSheet?,
    rows: Map<Long, CatalogueItem>,
    roots: List<Long>,
): List<Long> {
    val found = roots.toMutableSet()
    val queue = ArrayDeque(roots)
    val features = sheet?.let { ownedFeatures(it, rows) }.orEmpty().groupBy { it.item.id }
    while (queue.isNotEmpty()) {
        val item = rows[queue.removeFirst()] ?: continue
        val links = buildList {
            add(item.data["armor_base"].objectValue()["base_item_id"].referenceId())
            add(item.data["weapon"].objectValue()["base_item_id"].referenceId())
            add(item.data["on_end_effect"].referenceId())
            addAll(statusEffectLinks(item).map(::statusEffectId))
            addAll(
                item.data["granted_spells"].arrayValue().map {
                    it.objectValue()["spell"].referenceId()
                }
            )
            for (option in item.data["item_creation"].arrayValue()) addAll(
                option.objectValue()["outputs"].arrayValue().map {
                    it.objectValue()["item"].referenceId()
                }
            )
            for (feature in features[item.id].orEmpty()) for (choice in
                itemChoices(item).filter { it.text("source") == "item" }) {
                addAll(
                    feature.entry["choices"].objectValue()[choice.text("key")].arrayValue().map {
                        it.referenceId()
                    }
                )
            }
        }
        for (id in links.filterNotNull().filter { it > 0 }) if (found.add(id)) queue.addLast(id)
    }
    return (found - roots.toSet()).sorted()
}
