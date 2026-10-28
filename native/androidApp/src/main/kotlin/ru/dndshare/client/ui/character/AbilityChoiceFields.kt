package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.character.creation.*
import ru.dndshare.client.data.CacheDao
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun AbilityChoiceFields(
    form: FeatureFormScope,
    item: CatalogueItem,
    cache: CacheDao,
    evaluation: CharacterSheet? = null,
) {
    val context = LocalCharacterSheet.current
    for (choice in itemChoices(item)) {
        val key = choice.text("key")
        val selected =
            form.data["choices"].objectValue()[key].arrayValue().map { it.jsonPrimitive.content }
        val source =
            choice.text("source").ifBlank {
                when {
                    choice["from_suggest_id"] != null -> "suggest"
                    choice["from_item_type_id"] != null -> "item"
                    else -> "inline"
                }
            }
        val count = choice["count"].number(1).coerceAtLeast(1)
        Text(
            "${choice.text("label").ifBlank { item.name }} · ${selected.size}/$count",
            style = ShareTypography.group,
        )
        fun change(next: List<String>) =
            form.input(
                "choices",
                changeCharacterChoice(
                    item,
                    form.data["choices"].objectValue(),
                    key,
                    JsonArray(next.map(::JsonPrimitive)),
                ),
            )
        val options =
            characterChoiceOptions(
                choice,
                form.data["choices"].objectValue(),
                context.items,
                context.metadata,
            )
        val baselineEntry =
            form.editor.baseline.values[form.data.text("bucket")]
                .arrayValue()
                .getOrNull(form.data["index"].number(-1))
                .objectValue()
        val current =
            if (baselineEntry.isNotEmpty() || evaluation == null) baselineEntry
            else
                ownedFeatures(evaluation, context.items)
                    .firstOrNull {
                        it.item.id == item.id &&
                            (form.data.text("uid").isBlank() ||
                                it.entry.text("uid") == form.data.text("uid"))
                    }
                    ?.entry ?: JsonObject(emptyMap())
        val rankSheet = choiceEvaluationSheet(evaluation ?: context.sheet, current, key)
        val occupied = occupiedCharacterChoices(item, choice, evaluation ?: context.sheet, current)
        val reasons = options.associate { option ->
            option.first to
                (if (option.first in occupied) "Этот вариант уже выбран другим экземпляром черты."
                else
                    characterChoiceErrors(
                            choice,
                            option.first,
                            rankSheet,
                            context.items,
                            context.metadata,
                        )
                        .firstOrNull()
                        .orEmpty())
        }
        if (source == "item") {
            selected.forEach { id ->
                TextButton(onClick = { change(selected - id) }, enabled = form.enabled) {
                    Text("${context.items[id.toLongOrNull()]?.name ?: id} ×")
                }
            }
            var choosing by remember(item.id, key) { mutableStateOf(false) }
            val dependencies = choiceDependencies(choice)
            ShareAction(
                "Выбрать ${choice.text("label").ifBlank { "запись" }}",
                { choosing = true },
                enabled =
                    form.enabled &&
                        (selected.size < count || count == 1) &&
                        dependencies.all {
                            form.data["choices"].objectValue()[it].arrayValue().isNotEmpty()
                        },
            )
            if (choosing)
                SheetItemPicker(
                    cache,
                    context.sheet,
                    listOfNotNull(choice["from_item_type_id"].referenceId()),
                    { choosing = false },
                    eligibility = { candidate ->
                        val filter = choiceFilter(choice, form.data["choices"].objectValue())
                        buildList {
                            if (!itemChoiceMatches(candidate, filter))
                                add("Не соответствует условиям выбора.")
                            if (candidate.id.toString() in selected) add("Уже выбрано.")
                            if (candidate.id.toString() in occupied)
                                add("Этот вариант уже выбран другим экземпляром черты.")
                            addAll(
                                characterChoiceErrors(
                                    choice,
                                    candidate.id.toString(),
                                    rankSheet,
                                    context.items,
                                    context.metadata,
                                )
                            )
                        }
                    },
                ) { picked ->
                    change(
                        if (count == 1) listOf(picked.id.toString())
                        else selected + picked.id.toString()
                    )
                    choosing = false
                }
        } else
            FlowRow {
                options.forEach { (id, title) ->
                    FilterChip(
                        id in selected,
                        {
                            change(
                                if (id in selected) selected - id
                                else if (count == 1) listOf(id)
                                else if (selected.size < count) selected + id else selected
                            )
                        },
                        label = { Text(title) },
                        enabled =
                            form.enabled &&
                                (id in selected ||
                                    ((selected.size < count || count == 1) &&
                                        reasons[id].isNullOrBlank())),
                    )
                }
            }
    }
    val asi = item.data["asi_choice"].objectValue()
    val key = asi.text("choice_key").ifBlank { "ability" }
    if (asi.isNotEmpty() && itemChoices(item).none { it.text("key") == key }) {
        val selected =
            form.data["choices"].objectValue()[key].arrayValue().mapNotNull { it.referenceId() }
        Text("Прибавка характеристики +${asi["bonus"].number()}", style = ShareTypography.group)
        FlowRow {
            dndAbilities.forEach { ability ->
                FilterChip(
                    ability.suggestId in selected,
                    {
                        val next =
                            if (ability.suggestId in selected) selected - ability.suggestId
                            else if (selected.size < asi["count"].number(1))
                                selected + ability.suggestId
                            else selected
                        form.input(
                            "choices",
                            changeCharacterChoice(
                                item,
                                form.data["choices"].objectValue(),
                                key,
                                JsonArray(next.map(::JsonPrimitive)),
                            ),
                        )
                    },
                    label = { Text(ability.title) },
                    enabled = form.enabled,
                )
            }
        }
    }
}

@Composable
internal fun AbilitySelectionFields(form: FeatureFormScope, cache: CacheDao) {
    val context = LocalCharacterSheet.current
    val parent = context.items[form.data["parentId"].referenceId()] ?: return
    val entries = form.data["entries"].arrayValue()
    val projected = abilitySelectionDraft(form.editor.baseline, parent.id, entries, context.items)
    Text(
        "${parent.name}: ${entries.size}/${abilitySelectionCount(parent, form.editor.baseline)} · замен: ${abilityReplacementCount(parent,form.editor.baseline)}",
        style = ShareTypography.group,
    )
    entries.forEachIndexed { index, raw ->
        val entry = raw.objectValue()
        val item = context.items[entry.referenceId()]
        Text(item?.name ?: "Способность", style = ShareTypography.card)
        if (item != null)
            AbilityChoiceFields(
                FeatureFormScope(
                    form.editor,
                    { key, value -> form.row(listOf("entries"), index, key, value) },
                    { form.data["entries"].arrayValue().getOrNull(index).objectValue() },
                ),
                item,
                cache,
                projected,
            )
        TextButton(
            onClick = { form.rows(listOf("entries")) { it.filterIndexed { i, _ -> i != index } } },
            enabled = form.enabled,
        ) {
            Text("Убрать из выбора")
        }
    }
    var choosing by remember { mutableStateOf(false) }
    ShareAction(
        "Выбрать способность",
        { choosing = true },
        enabled =
            form.enabled && entries.size < abilitySelectionCount(parent, form.editor.baseline),
    )
    if (choosing)
        SheetItemPicker(
            cache,
            form.editor.baseline,
            listOf(4L),
            { choosing = false },
            eligibility = { item ->
                selectedAbilityEligibility(item, parent, projected) +
                    if (entries.any { it.referenceId() == item.id }) listOf("Уже выбрано.")
                    else emptyList()
            },
        ) { item ->
            form.rows(listOf("entries")) { it + buildJsonObject { put("id", item.id) } }
            choosing = false
        }
}
