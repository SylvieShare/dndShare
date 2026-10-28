package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun CommandFeatureFields(form: FeatureFormScope, participants: List<JsonObject>) {
    val context = LocalCharacterSheet.current
    val peers = participants.mapNotNull { row ->
        val uuid = row.text("charUuid")
        if (uuid.isBlank() || uuid == context.uuid) return@mapNotNull null
        val values = row["data"].objectValue()["values"].objectValue()
        val name =
            values.text(if (row.text("templateName") == "VTM20") "char_name" else "name").ifBlank {
                "Персонаж"
            }
        uuid to name
    }
    val kind = form.editor.fields.target.substringBefore(':')
    if (kind == "spell-cast") {
        val item = context.items[form.data["id"].referenceId()]
        val reference =
            findSpellReference(form.editor.baseline, form.text("entryKey")).objectValue()
        val base = item?.data?.get("lvl").number()
        if (base > 0 && reference["slotless"] != JsonPrimitive(true)) {
            form.Choice(
                "castLevel",
                "Круг заклинания",
                (base..9).map { it.toString() to it.toString() },
            )
            form.Toggle("spendSlot", "Потратить ячейку")
            val options =
                item
                    ?.let { spellSlotOptions(context.sheet, it, reference) }
                    .orEmpty()
                    .filter { it["level"].number() == form.text("castLevel").toIntOrNull() }
            LaunchedEffect(
                form.editor.fields.id,
                form.text("castLevel"),
                options.map { it.text("pool") },
            ) {
                if (options.isNotEmpty() && options.none { it.text("pool") == form.text("pool") })
                    form.set("pool", options.first().text("pool"))
            }
            if (form.data["spendSlot"] == JsonPrimitive(true)) {
                if (options.isEmpty())
                    Text("Нет доступной ячейки выбранного круга.", color = WebPalette.Warning)
                form.Choice(
                    "pool",
                    "Источник ячейки",
                    options
                        .map {
                            it.text("pool") to
                                if (it.text("pool") == "short_rest") "Магия договора"
                                else "Обычные ячейки"
                        }
                        .distinct(),
                )
            }
        }
        val creations = item?.data?.get("item_creation").arrayValue().map { it.objectValue() }
        if (creations.isNotEmpty())
            ShareSelect(
                "Результат сотворения",
                form.text("creationKey"),
                listOf("" to "Сотворить без создания предметов") +
                    creations.map {
                        it.text("key") to it.text("title").ifBlank { "Создание предметов" }
                    },
                form.enabled,
            ) {
                form.set("creationKey", it)
                form.input("createAll", JsonPrimitive(true))
                form.set("createdCount", "1")
            }
        val creating = creations.firstOrNull { it.text("key") == form.text("creationKey") }
        if (creating != null) {
            val cast = form.text("castLevel").toIntOrNull() ?: base
            creating["outputs"].arrayValue().forEach { raw ->
                val output = raw.objectValue()
                val name = context.items[output["item"].referenceId()]?.name ?: "Предмет"
                val count =
                    output["count"].number(1) +
                        (cast - base).coerceAtLeast(0) /
                            output["scaling_step"].number(1).coerceAtLeast(1) *
                            output["per_slot"].number().coerceAtLeast(0)
                Text("$name × $count", style = ShareTypography.group)
            }
            if (creating["choose_count"] == JsonPrimitive(true)) {
                form.Toggle("createAll", "Создать весь объём")
                if (form.data["createAll"] == JsonPrimitive(false))
                    form.NumberField("createdCount", "Количество")
            }
            Text(
                "Созданные предметы появятся в инвентаре персонажа.",
                style = ShareTypography.context,
            )
        }
        val options = item?.let(::spellApplicationOptions).orEmpty()
        if (options.isNotEmpty() && creating == null)
            form.Choice(
                "optionKey",
                "Вариант применения",
                options.map {
                    it.text("key") to
                        it.text("label")
                            .ifBlank { it.text("name") }
                            .ifBlank {
                                context.items[it["effect"].referenceId()]?.name
                                    ?: "Применить эффект"
                            }
                },
            )
        val automatic =
            item?.data?.get("heal") is JsonObject ||
                item?.data?.get("usable") is JsonObject ||
                item?.data?.get("status_effects").arrayValue().isNotEmpty()
        val targets = form.data["targets"].arrayValue().map { it.jsonPrimitive.content }
        if (automatic && creating == null) {
            Text("Цели применения", style = ShareTypography.group)
            FlowRow {
                (listOf("self" to "На себя") +
                        if (
                            item?.data?.get("application_targets").objectValue()["self_only"] ==
                                JsonPrimitive(true)
                        )
                            emptyList()
                        else peers)
                    .forEach { (id, name) ->
                        FilterChip(
                            id in targets,
                            {
                                form.input(
                                    "targets",
                                    JsonArray(
                                        (if (id in targets) targets - id else targets + id).map(
                                            ::JsonPrimitive
                                        )
                                    ),
                                )
                            },
                            label = { Text(name) },
                            enabled = form.enabled,
                        )
                    }
            }
            Text(
                "Оставьте цели пустыми, чтобы только сотворить заклинание и отметить расход.",
                style = ShareTypography.context,
            )
            if (
                form.text("sessionUuid").isNotBlank() &&
                    item?.data?.get("application_targets").objectValue()["self_only"] !=
                        JsonPrimitive(true)
            )
                form.NumberField("dmCount", "Целей мастера")
        }
    } else {
        if (kind == "transfer" || kind == "money-transfer") {
            form.Choice(
                "recipientCharUuid",
                "Получатель",
                peers + if (kind == "transfer") listOf("dm" to "Мастер") else emptyList(),
            )
        }
        if (kind == "money-transfer") {
            val money = context.sheet.values["money"].objectValue()
            form.Choice(
                "currencyId",
                "Валюта",
                money["order"].arrayValue().map { id ->
                    val key = id.jsonPrimitive.content
                    key to
                        (context.metadata.suggests["17"]
                            ?.firstOrNull { it.id.toString() == key }
                            ?.value ?: "Монеты")
                },
            )
            val balance = money["amounts"].objectValue()[form.text("currencyId")].number()
            Text("Доступно: $balance", style = ShareTypography.group)
            form.NumberField("amount", "Количество")
        } else {
            val item = context.items[form.data["item_id"].referenceId()]
            val choices =
                item?.data?.get("usable").objectValue()["choices"].arrayValue().map {
                    it.objectValue()
                }
            if (choices.isNotEmpty())
                form.Choice(
                    "optionKey",
                    "Вариант применения",
                    choices.map { it.text("key") to it.text("label").ifBlank { it.text("name") } },
                )
            if (kind == "transfer" && item?.data?.get("usable") is JsonObject)
                form.Choice(
                    "purpose",
                    "Действие",
                    listOf("transfer" to "Передать предмет", "use" to "Применить к получателю"),
                )
        }
    }
}
