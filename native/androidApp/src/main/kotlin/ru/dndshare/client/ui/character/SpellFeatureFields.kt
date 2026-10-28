package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.data.CacheDao
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun SpellFeatureFields(form: FeatureFormScope, cache: CacheDao) {
    when (form.editor.fields.target.substringBefore(':')) {
        "spell-tab" -> {
            val context = LocalCharacterSheet.current
            val classes = context.sheet.values["classes"].arrayValue().map { it.objectValue() }
            val current = form.data["class_item_id"].referenceId()
            ShareSelect(
                "Источник магии",
                current?.toString().orEmpty(),
                listOf("" to "Своя книга") +
                    classes.mapNotNull { row ->
                        row.referenceId()?.let { id ->
                            id.toString() to (context.items[id]?.name ?: row.label())
                        }
                    },
                form.enabled,
            ) { raw ->
                val id = raw.toLongOrNull()
                form.input("class_item_id", id?.let(::JsonPrimitive) ?: JsonNull)
                if (id != null) {
                    val entry = classes.first { it.referenceId() == id }
                    val rules =
                        spellcastingRules(
                            context.items[entry["subclass"].referenceId()],
                            entry["level"].number(1),
                        ) ?: spellcastingRules(context.items[id], entry["level"].number(1))
                    form.set("name", context.items[id]?.name ?: entry.label())
                    form.input(
                        "casting_ability",
                        rules?.ability?.takeIf { it in 1..6 }?.let(::JsonPrimitive)
                            ?: JsonPrimitive(""),
                    )
                    form.set("mode", rules?.mode ?: "known")
                }
            }
            key(current) { form.TextField("name", "Название книги") }
            form.Choice(
                "casting_ability",
                "Характеристика",
                listOf("" to "Не выбрана") +
                    dndAbilities.map { it.suggestId.toString() to it.title },
            )
            form.Choice(
                "mode",
                "Режим",
                listOf("known" to "Известные", "prepared" to "Подготовка", "spellbook" to "Книга"),
            )
            form.NumberField("attack_bonus", "Бонус атаки")
            form.NumberField("save_bonus", "Бонус сложности")
            if (!form.editor.fields.target.endsWith("new"))
                form.Toggle("remove", "Удалить книгу с её заклинаниями")
        }
        "spell" -> {
            val context = LocalCharacterSheet.current
            ShareSelect(
                "Книга",
                form.text("tab"),
                context.sheet.values["spells"].objectValue()["tabs"].arrayValue().map {
                    it.objectValue().let { tab -> tab.text("key") to tab.text("name") }
                },
                form.enabled,
            ) {
                form.set("tab", it)
            }
            val tab =
                form.editor.baseline.values["spells"]
                    .objectValue()["tabs"]
                    .arrayValue()
                    .map { it.objectValue() }
                    .firstOrNull { it.text("key") == form.data.text("tab") }
            form.ItemChoice(
                cache,
                "id",
                listOf(5L),
                eligibility = { candidate ->
                    if (tab == null) listOf("Выберите книгу.")
                    else
                        spellBookEligibility(
                            form.editor.baseline,
                            tab,
                            candidate,
                            context.items,
                            form.text("key"),
                        )
                },
            )
            val item = LocalCharacterSheet.current.items[form.data["id"].referenceId()]
            if (tab?.text("mode") != "known" && item?.data?.get("lvl").number() > 0)
                form.Toggle("prepared", "Подготовлено")
            tab?.let { spellBookRules(context.sheet, it, context.items)?.preparedLimit }
                ?.let { limit -> Text("Лимит подготовки: $limit", style = ShareTypography.context) }
            if (!form.editor.fields.target.endsWith("new")) form.Toggle("remove", "Убрать из книги")
        }
        "spell-slots" ->
            for (pool in listOf("long_rest", "short_rest")) {
                Text(
                    if (pool == "long_rest") "Ячейки заклинаний" else "Магия договора",
                    style = ShareTypography.group,
                )
                val rows = form.data[pool].arrayValue()
                key(rows.size) {
                    rows.forEachIndexed { index, raw ->
                        val row = raw.objectValue()
                        fun change(key: String, text: String) =
                            form.row(listOf(pool), index, key, JsonPrimitive(text))
                        SheetNumberInput("Уровень", row.text("level")) { change("level", it) }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Column(Modifier.weight(1f)) {
                                SheetNumberInput("Всего", row.text("total")) { change("total", it) }
                            }
                            Column(Modifier.weight(1f)) {
                                SheetNumberInput("Потрачено", row.text("used")) {
                                    change("used", it)
                                }
                            }
                        }
                        ShareTextButton(
                            onClick = {
                                form.input(
                                    pool,
                                    JsonArray(
                                        form.data[pool].arrayValue().filterIndexed { i, _ ->
                                            i != index
                                        }
                                    ),
                                )
                            }
                        ) {
                            Text("Убрать уровень", color = WebPalette.Danger)
                        }
                    }
                }
                ShareTextButton(
                    onClick = {
                        form.input(
                            pool,
                            JsonArray(
                                form.data[pool].arrayValue() +
                                    buildJsonObject {
                                        put("level", rows.size + 1)
                                        put("total", 1)
                                        put("used", 0)
                                    }
                            ),
                        )
                    }
                ) {
                    Text("Добавить уровень ячеек")
                }
            }
    }
}
