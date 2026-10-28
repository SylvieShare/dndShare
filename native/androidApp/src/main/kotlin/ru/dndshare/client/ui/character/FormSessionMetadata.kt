package ru.dndshare.client.ui.character

import java.util.UUID
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

internal fun sessionMetadata(
    sessionUuid: String?,
    type: String,
    action: String,
    data: JsonObject,
): List<JsonObject> {
    if (sessionUuid == null) return emptyList()
    return listOf(
        buildJsonObject {
            put(
                "events",
                buildJsonArray {
                    add(
                        buildJsonObject {
                            put("sessionUuid", sessionUuid)
                            put("type", type)
                            put("action", action.take(255))
                            put("data", data)
                            put("visibility", "public")
                            put("clientActionId", UUID.randomUUID().toString())
                        }
                    )
                },
            )
        }
    )
}

internal fun formSessionMetadata(
    form: SheetFormFields,
    before: CharacterSheet,
    patches: List<SheetPatch>,
    items: Map<Long, CatalogueItem>,
    sessionUuid: String?,
): List<JsonObject> {
    if (sessionUuid == null) return emptyList()
    if (form.target.startsWith("inventory-section:") && form.input["remove"] == JsonPrimitive(true))
        return itemMechanicMetadata(
            before,
            form.input.text("id"),
            "inventory-section-delete",
            form.input,
            items,
            sessionUuid,
        )
    if (form.input["fromInventory"] == JsonPrimitive(true)) return emptyList()
    val after = before.copy(data = applySheetPatches(before.data, patches))
    return when (form.target.substringBefore(':')) {
        "rest" -> {
            val kind = form.input.text("kind")
            val title =
                when (kind) {
                    "long" -> "Длинный отдых"
                    "short" -> "Короткий отдых"
                    else -> "Рассвет"
                }
            val old = resourceControls(before, items, true).associateBy { it.key }
            val recovered =
                resourceControls(after, items, true)
                    .filter { it.value > (old[it.key]?.value ?: it.value) }
                    .map { JsonPrimitive(it.title) }
            sessionMetadata(
                sessionUuid,
                "rest_completed",
                title,
                buildJsonObject {
                    put("kind", kind)
                    put(
                        "hpRecovered",
                        maxOf(
                            0,
                            after.values["hp"].objectValue()["current"].number() -
                                before.values["hp"].objectValue()["current"].number(),
                        ),
                    )
                    put("resourcesRecovered", JsonArray(recovered))
                    form.input["hitDiceSpent"]?.let { put("hitDiceSpent", it) }
                },
            )
        }
        "hp" ->
            form.input["hpOperations"].arrayValue().flatMap { raw ->
                val operation = raw.objectValue()
                val kind = operation.text("kind")
                if (kind !in setOf("damage", "heal")) return@flatMap emptyList()
                val previous = operation["before"].objectValue()
                val next = operation["after"].objectValue()
                val absorbed = maxOf(0, previous["temp"].number() - next["temp"].number())
                val applied =
                    if (kind == "damage")
                        previous["current"].number() - next["current"].number() + absorbed
                    else next["current"].number() - previous["current"].number()
                if (applied <= 0) emptyList()
                else
                    sessionMetadata(
                        sessionUuid,
                        "hp_changed",
                        if (kind == "damage") "Получен урон: $applied"
                        else "Восстановлено хитов: $applied",
                        JsonObject(
                            operation +
                                mapOf(
                                    "applied" to JsonPrimitive(applied),
                                    "absorbed" to JsonPrimitive(absorbed),
                                )
                        ),
                    )
            }
        "inventory",
        "weapon",
        "spell",
        "ability" -> {
            val adding =
                when (form.target.substringBefore(':')) {
                    "ability" -> form.input["index"].number(-1) < 0
                    else -> form.target.endsWith(":new") || form.target.endsWith("|new")
                }
            if (!adding || form.input["remove"] == JsonPrimitive(true)) return emptyList()
            val id = (form.input["item_id"] ?: form.input["id"]).referenceId()
            val item = items[id]
            val title = form.input.text("name").ifBlank { item?.name.orEmpty() }
            val kind =
                when (form.target.substringBefore(':')) {
                    "spell" -> "spell"
                    "ability" ->
                        if (form.input.text("bucket") == "abilities_feats") "feature" else "ability"
                    else -> "item"
                }
            val action =
                when (kind) {
                    "spell" -> "Добавлено заклинание"
                    "feature" -> "Добавлена черта"
                    "ability" -> "Добавлена способность"
                    else -> "Добавлен предмет"
                }
            sessionMetadata(
                sessionUuid,
                "entry_added",
                "$action: $title",
                buildJsonObject {
                    put("kind", kind)
                    id?.let { put("itemId", it) }
                    put("count", form.input["count"].number(1).coerceAtLeast(1))
                    if (form.target.startsWith("weapon")) put("category", "weapon")
                    if (id != null)
                        put(
                            "source",
                            buildJsonObject {
                                put("itemId", id)
                                put("name", title)
                            },
                        )
                },
            )
        }
        else -> emptyList()
    }
}
