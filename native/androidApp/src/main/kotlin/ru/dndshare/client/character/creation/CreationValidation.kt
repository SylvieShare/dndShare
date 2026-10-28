package ru.dndshare.client.character.creation

import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

fun creationErrors(context: CreationContext, step: Int): List<String> = buildList {
    val draft = context.draft
    if (step == 0 && draft.editionId <= 0) add("Выберите редакцию правил.")
    if (draft.template == "VTM20") {
        if (draft.name.isBlank()) add("Введите имя персонажа.")
        return@buildList
    }
    if (step == 1 && context.item("race") == null) add("Выберите происхождение.")
    if (step == 1 && context.children("subrace").isNotEmpty() && context.item("subrace") == null)
        add("Выберите разновидность происхождения.")
    if (
        step == 1 &&
            context.raceData.any { it["variants"].arrayValue().isNotEmpty() } &&
            draft.raceVariant.isBlank()
    )
        add("Выберите вариант происхождения.")
    if (step == 2 && context.item("charClass") == null) add("Выберите класс.")
    if (
        step == 2 &&
            context.item("charClass")?.data?.get("subclass_level").number(3) == 1 &&
            context.children("subclass").isNotEmpty() &&
            context.item("subclass") == null
    )
        add("Выберите подкласс.")
    if (step == 3 && context.item("background") == null) add("Выберите предысторию.")
    if (step == 4) {
        if (creationScores(draft).size != 6) add("Распределите все шесть характеристик.")
        if (draft.method == "point" && pointBuyRemaining(draft) < 0)
            add("Превышен бюджет 27 очков.")
        if (
            draft.version == "2024" &&
                draft.backgroundAsi.values.filter { it > 0 }.sorted() !in
                    listOf(listOf(1, 2), listOf(1, 1, 1))
        )
            add("Распределите прибавки предыстории: +2/+1 или +1/+1/+1.")
    }
    if (step == 5 && draft.name.isBlank()) add("Введите имя персонажа.")
    if (step == 2) {
        val preview = creationEvaluation(context)
        for (child in
            context.features(false).filter {
                it.data["selection_parent_id"].referenceId() != null
            }) {
            val parent = context.items[child.data["selection_parent_id"].referenceId()] ?: continue
            selectedAbilityEligibility(child, parent, preview).forEach {
                add(child.name + ": " + it)
            }
        }
    }
    if (step == 4) {
        if (context.draft.version == "2024") {
            val origin =
                context.item("background")?.data?.get("origin_feat_id").referenceId()
                    ?: context.picked("originFeat").firstOrNull()?.toLongOrNull()
            if (
                origin != null &&
                    context.picked("feats").any { it.toLongOrNull() == origin } &&
                    context.items[origin]?.data?.get("repeatable") != JsonPrimitive(true)
            )
                add("Черта предыстории уже выбрана от происхождения. Выберите другую черту.")
        }
        val preview = creationEvaluation(context)
        val armor =
            context.metadata.suggests["3"]
                .orEmpty()
                .filter { s ->
                    preview.values["proficiencies"].objectValue()["Доспехи"].arrayValue().any {
                        it.jsonPrimitive.content.equals(s.value, true)
                    }
                }
                .map { it.id }
                .toSet()
        for (feat in creationFeats(context)) featRequirements(
                feat,
                creationStats.associateWith(preview::statScore),
                1,
                preview.values["spells"] is JsonObject,
                armor,
                if (context.draft.version == "2024") "origin" else null,
            )
            .forEach { add(feat.name + ": " + it) }
    }
    creationChoices(context, step).forEach { row ->
        val picked = context.picked(row.key)
        if (
            picked.size != row.count ||
                picked.distinct().size != picked.size ||
                picked.any { value ->
                    row.options.none { it.first == value } || value in row.invalidOptions
                }
        )
            add("${row.title}: выберите ${row.count}.")
    }
}
