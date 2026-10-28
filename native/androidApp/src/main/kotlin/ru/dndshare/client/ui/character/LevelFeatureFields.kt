package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.character.creation.*
import ru.dndshare.client.data.CacheDao
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun LevelFeatureFields(form: FeatureFormScope, cache: CacheDao) {
    val context = LocalCharacterSheet.current
    val sheet = form.editor.baseline
    val plan = LevelAdvancement(sheet, form.data, context.items, context.metadata)
    val projected = advancementPreview(plan)
    form.NumberField("exp", "Опыт")
    form.Toggle("advance", "Повысить уровень ${plan.total} → ${(plan.total+1).coerceAtMost(20)}")
    if (form.data["advance"] != JsonPrimitive(true)) return
    if (plan.total >= 20) {
        Text("Достигнут 20 уровень.")
        return
    }
    var picker by remember { mutableStateOf<String?>(null) }
    Text("Класс", style = ShareTypography.group)
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        plan.oldClasses.forEach { row ->
            ShareChoiceChip(
                row["id"].referenceId() == plan.classId,
                {
                    form.input("classId", row.getValue("id"))
                    form.input("subclassId", JsonNull)
                    form.input("choices", JsonObject(emptyMap()))
                    form.input("selections", JsonObject(emptyMap()))
                    form.input("spells", JsonNull)
                },
                label = { Text("${row.text("name")} ${row["level"].number()+1}") },
                enabled = form.enabled,
            )
        }
        ShareTextButton(onClick = { picker = "class" }, enabled = form.enabled) {
            Text(if (plan.oldClasses.isEmpty()) "Выбрать класс" else "Мультикласс")
        }
    }
    plan.charClass?.let {
        Text("${it.name} · уровень ${plan.classLevel}", style = ShareTypography.card)
    }
    if (plan.charClass != null) {
        ShareTextButton(onClick = { picker = "subclass" }, enabled = form.enabled) {
            Text(plan.subclass?.name ?: "Выбрать подкласс")
        }
        form.Choice(
            "hpMethod",
            "Хиты",
            listOf("average" to "Среднее ${plan.face/2+1}", "roll" to "Бросок d${plan.face}"),
        )
        if (form.text("hpMethod") == "roll") {
            form.NumberField("hpRoll", "Результат кости (1–${plan.face})")
            ShareTextButton(
                onClick = {
                    form.input(
                        "hpRoll",
                        JsonPrimitive(kotlin.random.Random.nextInt(1, plan.face + 1)),
                    )
                },
                enabled = form.enabled,
            ) {
                Text("Бросить d${plan.face}")
            }
        }
        Text(
            "Хиты +${plan.hpGain.coerceAtLeast(1)} · кость хитов d${plan.face}",
            style = ShareTypography.group,
        )
        if (plan.hasAsi) {
            form.Choice(
                "asiMode",
                "Повышение характеристик",
                listOf("stats" to "+2 / +1 и +1", "feat" to "Черта", "skip" to "Пропустить"),
            )
            if (form.text("asiMode") == "feat") {
                ShareTextButton(onClick = { picker = "feat" }, enabled = form.enabled) {
                    Text(plan.feat?.name ?: "Выбрать черту")
                }
                plan.feat?.let { AdvancementChoices(form, it, cache) }
            } else if (form.text("asiMode") != "skip") {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    creationStats.zip(statTitles).forEach { (stat, title) ->
                        val amount = form.data["asi"].objectValue()[stat].number()
                        ShareTextButton(
                            onClick = {
                                val map = form.data["asi"].objectValue()
                                form.input(
                                    "asi",
                                    JsonObject(map + (stat to JsonPrimitive((amount + 1) % 3))),
                                )
                            },
                            enabled = form.enabled,
                        ) {
                            Text("$title +$amount")
                        }
                    }
                }
            }
        }
        if (plan.newFeatures.isNotEmpty()) Text("Новые способности", style = ShareTypography.card)
        plan.newFeatures.forEach { feature ->
            Text(feature.name, style = ShareTypography.group)
            AdvancementChoices(form, feature, cache)
        }
        val parents =
            (ownedFeatures(sheet, context.items).map { it.item } + plan.newFeatures)
                .distinctBy { it.id }
                .filter { it.data["ability_selection"] is JsonObject }
        parents.forEach { parent ->
            val count = abilitySelectionCount(parent, projected)
            val current = form.data["selections"].objectValue()[parent.id.toString()]
            LaunchedEffect(parent.id, plan.classId, plan.classLevel) {
                if (current == null) {
                    val old =
                        sheet.values["abilities_class"]
                            .arrayValue()
                            .filter {
                                context.items[it.referenceId()]
                                    ?.data
                                    ?.get("selection_parent_id")
                                    .referenceId() == parent.id
                            }
                            .mapNotNull { it.referenceId() }
                            .map(::JsonPrimitive)
                    form.input(
                        "selections",
                        JsonObject(
                            form.data["selections"].objectValue() +
                                (parent.id.toString() to JsonArray(old))
                        ),
                    )
                }
            }
            Text("${parent.name} · выберите $count", style = ShareTypography.group)
            val selected = current.arrayValue()
            context.items.values
                .filter {
                    it.data["selection_parent_id"].referenceId() == parent.id &&
                        it.data["level"].number(1) <= ownerLevel(parent.data, projected)
                }
                .sortedBy { it.name }
                .forEach { child ->
                    val chosen = selected.any { it.referenceId() == child.id }
                    val errors = selectedAbilityEligibility(child, parent, projected)
                    ShareChoiceChip(
                        chosen,
                        {
                            val next =
                                if (chosen) selected.filterNot { it.referenceId() == child.id }
                                else if (selected.size < count) selected + JsonPrimitive(child.id)
                                else selected
                            form.input(
                                "selections",
                                JsonObject(
                                    form.data["selections"].objectValue() +
                                        (parent.id.toString() to JsonArray(next))
                                ),
                            )
                        },
                        label = { Text(child.name) },
                        enabled =
                            form.enabled && (chosen || errors.isEmpty() && selected.size < count),
                    )
                    if (errors.isNotEmpty())
                        Text(
                            errors.joinToString(" · "),
                            style = ShareTypography.context,
                            color = WebPalette.TextMuted,
                        )
                    if (chosen) AdvancementChoices(form, child, cache)
                }
        }
        if (plan.oldClass == null && plan.oldClasses.isNotEmpty()) {
            val rule = plan.charClass?.nameEn.orEmpty().trim().lowercase()
            if (rule in listOf("bard", "ranger", "rogue")) {
                val allowed =
                    plan.charClass
                        ?.data
                        ?.get("skill_choice")
                        .objectValue()["from"]
                        .arrayValue()
                        .mapNotNull { it.referenceId() }
                form.Choice(
                    "multiclassSkill",
                    "Навык мультикласса",
                    context.metadata.suggests["15"]
                        .orEmpty()
                        .filter { rule == "bard" || allowed.isEmpty() || it.id in allowed }
                        .map { it.id.toString() to it.value },
                )
                if (rule == "bard")
                    form.Choice(
                        "multiclassTool",
                        "Музыкальный инструмент",
                        context.metadata.suggests["5"].orEmpty().map {
                            it.id.toString() to it.value
                        },
                    )
            }
        }
        LevelSpellFields(form, plan, cache)
    }
    picker?.let { kind ->
        SheetItemPicker(
            cache,
            sheet,
            listOf(
                when (kind) {
                    "class" -> 9L
                    "subclass" -> 17L
                    else -> 7L
                }
            ),
            { picker = null },
            eligibility = { candidate ->
                when (kind) {
                    "subclass" ->
                        if (
                            candidate.data["class"].referenceId() == plan.classId ||
                                candidate.id in
                                    plan.charClass
                                        ?.data
                                        ?.get("subclasses")
                                        .arrayValue()
                                        .mapNotNull { it.referenceId() }
                        )
                            emptyList()
                        else listOf("Подкласс относится к другому классу.")
                    "class" -> emptyList()
                    else ->
                        featRequirements(
                            candidate,
                            creationStats.associateWith(sheet::statScore),
                            plan.total + 1,
                            AdvancementSpellSelection(plan).rules != null,
                            context.metadata.suggests["3"]
                                .orEmpty()
                                .filter { suggest ->
                                    sheet.values["proficiencies"]
                                        .objectValue()["Доспехи"]
                                        .arrayValue()
                                        .any {
                                            it.jsonPrimitive.content.equals(suggest.value, true)
                                        }
                                }
                                .map { it.id }
                                .toSet(),
                        )
                }
            },
        ) { item ->
            form.input(
                when (kind) {
                    "class" -> "classId"
                    "subclass" -> "subclassId"
                    else -> "featId"
                },
                JsonPrimitive(item.id),
            )
            picker = null
            if (kind == "class") {
                form.input("subclassId", JsonNull)
                form.input("spells", JsonNull)
                form.input("choices", JsonObject(emptyMap()))
                form.input("selections", JsonObject(emptyMap()))
                form.input("spells", JsonNull)
            }
        }
    }
}

@Composable
internal fun AdvancementChoices(form: FeatureFormScope, item: CatalogueItem, cache: CacheDao) {
    val context = LocalCharacterSheet.current
    val projected =
        advancementPreview(
            LevelAdvancement(form.editor.baseline, form.data, context.items, context.metadata)
        )
    AbilityChoiceFields(
        FeatureFormScope(
            form.editor,
            { key, value ->
                if (key == "choices") form.field(listOf("choices", item.id.toString()), value)
            },
            {
                buildJsonObject {
                    put("id", item.id)
                    if (item.typeId == 7L) put("uid", "preview-feat:${item.id}")
                    put(
                        "choices",
                        form.data["choices"].objectValue()[item.id.toString()]
                            ?: JsonObject(emptyMap()),
                    )
                }
            },
        ),
        item,
        cache,
        projected,
    )
}

internal fun levelFormPatches(
    sheet: CharacterSheet,
    input: JsonObject,
    items: Map<Long, CatalogueItem>,
    metadata: HandbookMetadata = HandbookMetadata(),
): List<SheetPatch> =
    if (input["advance"] == JsonPrimitive(true))
        levelAdvancementPatches(LevelAdvancement(sheet, input, items, metadata))
    else
        listOf(
            SheetPatch(
                path = sheetPath("values", "lvl"),
                value =
                    JsonObject(
                        sheet.values["lvl"].objectValue() +
                            ("exp" to JsonPrimitive(inputInteger(input, "exp")))
                    ),
            )
        )
