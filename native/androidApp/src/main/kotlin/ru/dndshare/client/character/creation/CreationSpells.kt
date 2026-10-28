package ru.dndshare.client.character.creation

import java.util.UUID
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

fun creationSpellbook(
    context: CreationContext,
    values: JsonObject,
    stableIds: Boolean = false,
    feats: List<CreationFeatSelection> = emptyList(),
): JsonObject {
    val charClass = context.item("charClass")
    val casting =
        context.classData
            .lastOrNull { it["spellcasting"] is JsonObject }
            ?.get("spellcasting")
            .objectValue()
    val starts = casting.isNotEmpty() && casting["start_level"].number(1) <= 1
    val classKey = "class:${charClass?.id}"
    val selected = context.selectedItems("spells")
    val mode =
        casting.text("selection_mode").ifBlank {
            if (casting["prepares"] == JsonPrimitive(true)) "prepared" else "known"
        }
    val tabs =
        if (starts && charClass != null)
            listOf(
                buildJsonObject {
                    put("key", classKey)
                    put("name", charClass.name)
                    put("class_item_id", charClass.id)
                    put("casting_ability", casting["ability"] ?: JsonPrimitive(""))
                    put("mode", mode)
                    put("attack_bonus", 0)
                    put("save_bonus", 0)
                    put(
                        "spells",
                        JsonArray(
                            selected.map { item ->
                                buildJsonObject {
                                    put(
                                        "key",
                                        if (stableIds) "preview-spell:" + item.id
                                        else "spell:${UUID.randomUUID()}",
                                    )
                                    put("id", item.id)
                                    put(
                                        "prepared",
                                        mode != "known" &&
                                            !(context.draft.version == "2024" &&
                                                mode == "spellbook") &&
                                            item.data["lvl"].number() > 0,
                                    )
                                }
                            }
                        ),
                    )
                }
            )
        else emptyList()
    val grants = mutableListOf<JsonElement>()
    for (selection in feats) for (choice in
        itemChoices(selection.item).filter { it["grant_spells"] == JsonPrimitive(true) }) {
        for (selected in selection.choices[choice.text("key")].arrayValue()) {
            val id = selected.referenceId() ?: continue
            grants.add(
                buildJsonObject {
                    put("key", "feat:" + selection.item.id + ":spell:" + id)
                    put("id", id)
                    put(
                        "source",
                        buildJsonObject {
                            put("kind", "feat")
                            put("item_id", selection.item.id)
                            put("label", selection.item.name)
                        },
                    )
                }
            )
        }
    }
    for (item in listOfNotNull(charClass, context.item("subclass"))) for (raw in
        item.data["granted_spells"].arrayValue()) {
        val row = raw.objectValue()
        if (row["level"].number(1) > 1) continue
        val id = row["spell"].referenceId() ?: continue
        grants.add(
            buildJsonObject {
                put("key", "class:${item.id}:spell:$id")
                put("id", id)
                put("tab_key", classKey)
                put(
                    "source",
                    buildJsonObject {
                        put("kind", "class")
                        put("item_id", item.id)
                        put("label", item.name)
                    },
                )
            }
        )
    }
    val sheet = CharacterSheet("DND5", 0, buildJsonObject { put("values", values) }, 0)
    val synced = syncAbilitySpellGrants(sheet, context.items, grants)
    return buildJsonObject {
        put("schema_version", 2)
        put(
            "slot_pools",
            spellSlotPools(values["classes"].arrayValue().map { it.objectValue() }, context.items),
        )
        put("tabs", JsonArray(tabs))
        put("grants", synced)
    }
}
