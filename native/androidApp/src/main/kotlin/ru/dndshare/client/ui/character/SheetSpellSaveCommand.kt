package ru.dndshare.client.ui.character

import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

internal suspend fun performSpellSave(
    uuid: String,
    key: String,
    input: JsonObject,
    sheet: CharacterSheet,
    content: SheetContentState,
    session: String?,
    commands: CharacterCommandQueue?,
    concentration: JsonObject? = null,
) {
    val options = WireJson.decodeFromJsonElement<SpellRollOptions>(input)
    require(session != null) { "Запросить спасбросок можно в активной сессии." }
    require(!spellCastingBlocked(sheet, content.items, content.metadata)) {
        "Сотворение заклинаний сейчас недоступно."
    }
    val readout = spellReadout(sheet, key, content.items, content.metadata)
    require(options.castLevel in readout.item.data["lvl"].number()..9)
    val rule =
        spellRuleOptions(readout.item).firstOrNull { it.key == options.optionKey }?.rule
            ?: readout.item.data["damage"].objectValue()
    val save =
        spellSavingThrow(rule, readout, sheet) ?: error("Для этого эффекта не указан спасбросок.")
    requireNotNull(commands)
        .send(
            "session-event/$session",
            buildJsonObject {
                put("type", "spell_used")
                put("action", "Спасбросок: ${readout.item.name}")
                put("actorCharUuid", uuid)
                put("visibility", "public")
                put(
                    "data",
                    buildJsonObject {
                        put(
                            "source",
                            buildJsonObject {
                                put("itemId", readout.item.id)
                                put("name", readout.item.name)
                            },
                        )
                        if (
                            concentration?.get("spellId").referenceId() == readout.item.id &&
                                concentration?.text("id").orEmpty().isNotBlank()
                        )
                            put("castId", concentration!!.getValue("id"))
                        put("entryKey", key)
                        put("castLevel", options.castLevel)
                        put("savingThrow", save)
                    },
                )
            },
            changesDocument = false,
        )
}
