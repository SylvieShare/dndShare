package ru.dndshare.client.ui.character

import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

data class CharacterCommandSpec(
    val route: String,
    val intent: JsonObject,
    val changesDocument: Boolean = true,
)

internal fun isCommandForm(target: String) =
    target.substringBefore(':') in
        setOf(
            "spell-cast",
            "item-use",
            "transfer",
            "money-transfer",
            "journal-entry",
            "journal-section",
            "journal-source",
        )

internal fun initialCommandInput(
    target: String,
    sheet: CharacterSheet,
    items: Map<Long, CatalogueItem>,
    sessionUuid: String?,
): JsonObject {
    val kind = target.substringBefore(':')
    val key = target.substringAfter(':', "")
    return when (kind) {
        "spell-cast" -> {
            val reference =
                findSpellReference(sheet, key) ?: error("Заклинания больше нет в книге.")
            val item =
                items[reference["id"].referenceId()]
                    ?: error("Заклинание недоступно в локальном справочнике.")
            val options = spellSlotOptions(sheet, item, reference)
            val first = options.firstOrNull().objectValue()
            val choices = spellApplicationOptions(item)
            buildJsonObject {
                put("id", item.id)
                put("entryKey", key)
                put("castLevel", first["level"].number(item.data["lvl"].number()))
                put("pool", first.text("pool").ifBlank { "long_rest" })
                put(
                    "spendSlot",
                    item.data["lvl"].number() > 0 && reference["slotless"] != JsonPrimitive(true),
                )
                put("targets", JsonArray(emptyList()))
                put("dmCount", 0)
                put("optionKey", choices.singleOrNull().objectValue().text("key"))
                put("sessionUuid", sessionUuid.orEmpty())
                put("createdCount", 0)
                put("createAll", true)
                put("creationKey", "")
            }
        }
        "item-use",
        "transfer" -> {
            val parts = key.split('|', limit = 2)
            val source = parts.first()
            val uid = parts.getOrElse(1) { "" }
            require(source in setOf("weapon", "items", "spells"))
            val entry =
                if (source == "spells") findSpellReference(sheet, uid)
                else inventoryInstances(sheet).firstOrNull { it.first.text("uid") == uid }?.first
            requireNotNull(entry) { "Предмет больше не существует." }
            val id = (entry["magic_item_id"] ?: entry["item_id"] ?: entry["id"]).referenceId()
            val item = items[id]
            val choices = item?.data?.get("usable").objectValue()["choices"].arrayValue()
            buildJsonObject {
                put("source", source)
                put("entryUid", uid)
                put("item_id", id?.let(::JsonPrimitive) ?: JsonNull)
                put("optionKey", choices.singleOrNull().objectValue().text("key"))
                put("purpose", "transfer")
                put("sessionUuid", sessionUuid.orEmpty())
                put("recipientCharUuid", "")
            }
        }
        "money-transfer" -> {
            val money = sheet.values["money"].objectValue()
            val order = money["order"].arrayValue()
            val first =
                order.firstOrNull {
                    money["amounts"].objectValue()[it.jsonPrimitive.content].number() > 0
                } ?: order.firstOrNull() ?: JsonPrimitive(1)
            buildJsonObject {
                put("currencyId", first)
                put("amount", 1)
                put("recipientCharUuid", "")
                put("sessionUuid", sessionUuid.orEmpty())
            }
        }
        "journal-entry",
        "journal-section",
        "journal-source" -> JsonObject(emptyMap())
        else -> error("Неизвестное действие.")
    }
}

internal fun commandSpec(
    form: SheetFormFields,
    sheet: CharacterSheet,
    items: Map<Long, CatalogueItem>,
    metadata: HandbookMetadata = HandbookMetadata(),
): CharacterCommandSpec {
    val input = form.input
    return when (form.target.substringBefore(':')) {
        "journal-entry",
        "journal-section",
        "journal-source" -> journalFormCommand(form, input.text("characterUuid"))
        "spell-cast" ->
            CharacterCommandSpec(
                "spell-cast",
                spellCastIntent(
                    sheet,
                    input,
                    items,
                    input.text("sessionUuid").takeIf(String::isNotBlank),
                    metadata,
                ),
            )
        "item-use" -> {
            require(input.text("source") in setOf("items", "weapon"))
            CharacterCommandSpec(
                "usable-use",
                buildJsonObject {
                    put("source", input.text("source"))
                    put("entryUid", input.text("entryUid"))
                    put("optionKey", input.text("optionKey"))
                },
            )
        }
        "transfer" -> {
            require(input.text("recipientCharUuid").isNotBlank()) { "Выберите получателя." }
            require(input.text("sessionUuid").isNotBlank()) {
                "Персонаж не состоит в выбранной сессии."
            }
            CharacterCommandSpec(
                "item-transfers",
                JsonObject(
                    input.filterKeys {
                        it in
                            setOf(
                                "source",
                                "entryUid",
                                "optionKey",
                                "purpose",
                                "sessionUuid",
                                "recipientCharUuid",
                            )
                    }
                ),
            )
        }
        "money-transfer" -> {
            require(input.text("recipientCharUuid").isNotBlank()) { "Выберите получателя." }
            require(input.text("sessionUuid").isNotBlank()) { "Выберите сессию." }
            CharacterCommandSpec(
                "money-transfers",
                buildJsonObject {
                    put("sessionUuid", input.text("sessionUuid"))
                    put("recipientCharUuid", input.text("recipientCharUuid"))
                    put("currencyId", inputInteger(input, "currencyId", min = 1))
                    put("amount", inputInteger(input, "amount", min = 1))
                },
            )
        }
        else -> error("Неизвестное действие.")
    }
}
