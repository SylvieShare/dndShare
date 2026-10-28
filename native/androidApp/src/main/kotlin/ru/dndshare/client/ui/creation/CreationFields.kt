package ru.dndshare.client.ui.creation

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.unit.dp
import coil3.ImageLoader
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.character.creation.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.character.ContentSourceFields
import ru.dndshare.client.ui.designsystem.*
import ru.dndshare.client.ui.designsystem.richtext.ShareRichTextInput

@Composable
internal fun CreationStep(
    step: Int,
    ui: CreationUiState,
    model: CharacterCreationViewModel,
    images: ImageLoader,
) {
    val context = ui.context
    val draft = ui.draft
    when (step) {
        0 -> {
            Text("Система", style = ShareTypography.section)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(true, {}, label = { Text("D&D 5e") })
                if (ui.templates.any { it.name == "VTM20" })
                    FilterChip(
                        false,
                        { model.system("VTM20", "V20") },
                        label = { Text("Vampire V20") },
                    )
            }
            Text("Редакция", style = ShareTypography.group)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ui.sources
                    .firstOrNull { it.name == "DND5e" }
                    ?.versions
                    ?.filter { it.version in listOf("2014", "2024") }
                    ?.forEach { edition ->
                        FilterChip(
                            draft.version == edition.version,
                            { model.edition(edition.version) },
                            label = { Text(edition.version) },
                        )
                    }
            }
            ContentSourceFields(
                draft.contentSources,
                ui.metadata.books,
                allowLegacyControl = false,
            ) { settings ->
                model.update { it.copy(contentSources = settings) }
            }
            Text(
                "Черновик сохраняется на устройстве. Создать персонажа можно и до заполнения всех выборов.",
                style = ShareTypography.context,
            )
        }
        1 -> {
            CreationSelection(
                "Происхождение",
                context.catalogue.filter { it.typeId == 8L },
                context.item("race"),
                images,
                ui.catalogue,
            ) {
                model.choose("race", it)
            }
            if (context.children("subrace").isNotEmpty())
                CreationSelection(
                    "Разновидность происхождения",
                    context.children("subrace"),
                    context.item("subrace"),
                    images,
                    ui.catalogue,
                ) {
                    model.choose("subrace", it)
                }
            val variants =
                context.raceData.flatMap { it["variants"].arrayValue() }.map { it.objectValue() }
            if (variants.isNotEmpty())
                CreationChoiceRows(
                    listOf(
                        CreationChoice(
                            "variant",
                            "Вариант происхождения",
                            1,
                            variants.map {
                                it.text("value") to it.text("label").ifBlank { it.text("name") }
                            },
                        )
                    ),
                    draft.copy(choices = draft.choices + ("variant" to listOf(draft.raceVariant))),
                ) { _, value, _ ->
                    model.variant(value)
                }
            CreationChoiceRows(creationChoices(context, 1), draft, model::pick)
        }
        2 -> {
            CreationSelection(
                "Класс",
                context.catalogue.filter { it.typeId == 9L },
                context.item("charClass"),
                images,
                ui.catalogue,
            ) {
                model.choose("charClass", it)
            }
            if (
                context.item("charClass")?.data?.get("subclass_level").number(3) == 1 &&
                    context.children("subclass").isNotEmpty()
            )
                CreationSelection(
                    "Подкласс",
                    context.children("subclass"),
                    context.item("subclass"),
                    images,
                    ui.catalogue,
                ) {
                    model.choose("subclass", it)
                }
            CreationChoiceRows(creationChoices(context, 2), draft, model::pick)
            CreationEquipmentFields(ui, model)
        }
        3 -> {
            CreationSelection(
                "Предыстория",
                context.catalogue.filter { it.typeId == 11L },
                context.item("background"),
                images,
                ui.catalogue,
            ) {
                model.choose("background", it)
            }
            if (draft.version == "2024")
                CreationChoiceRows(
                    listOf(
                        CreationChoice(
                            "backgroundGold",
                            "Снаряжение предыстории",
                            1,
                            listOf("no" to "Комплект", "yes" to "Стартовые деньги"),
                        )
                    ),
                    draft,
                    model::pick,
                )
            CreationChoiceRows(creationChoices(context, 3), draft, model::pick)
        }
        4 -> CreationStats(ui, model)
        5 -> {
            key(ui.inputRevision) {
                ShareTextInput(
                    draft.name,
                    { model.update { old -> old.copy(name = it) } },
                    "Имя персонажа",
                )
            }
            ShareAction("Случайное имя", model::randomName)
            val fields =
                linkedMapOf(
                    "alignment" to "Мировоззрение",
                    "age" to "Возраст",
                    "height" to "Рост",
                    "weight" to "Вес",
                    "eyes" to "Глаза",
                    "skin" to "Кожа",
                    "hair" to "Волосы",
                    "appearance" to "Внешность",
                    "traits" to "Черты характера",
                    "ideals" to "Идеалы",
                    "bonds" to "Привязанности",
                    "flaws" to "Слабости",
                    "backstory" to "История",
                    "allies" to "Союзники",
                )
            CreationMediaFields(ui, model)
            fields.forEach { (key, label) ->
                val change: (String) -> Unit = { text ->
                    model.update { it.copy(persona = it.persona + (key to text)) }
                }
                if (key == "alignment")
                    ShareSelect(
                        label,
                        draft.persona[key].orEmpty(),
                        dndAlignments.map { it to it },
                    ) {
                        change(it)
                    }
                else if (
                    key in
                        setOf(
                            "appearance",
                            "traits",
                            "ideals",
                            "bonds",
                            "flaws",
                            "backstory",
                            "allies",
                        )
                )
                    ShareRichTextInput(draft.persona[key].orEmpty(), change, label)
                else ShareTextInput(draft.persona[key].orEmpty(), change, label)
            }
        }
        6 -> CreationShop(ui, model)
    }
}

@Composable
internal fun CreationMediaFields(ui: CreationUiState, model: CharacterCreationViewModel) {
    for (kind in listOf("portrait", "icon")) {
        Text(if (kind == "portrait") "Портрет" else "Иконка", style = ShareTypography.group)
        ru.dndshare.client.ui.media.StagedImageFields(
            kind == "icon",
            ui.draft.media["$kind:originalPath"].orEmpty(),
            ui.draft.media["$kind:path"].orEmpty(),
            !ui.busy,
        ) { key, value ->
            model.update {
                it.copy(
                    media = it.media + ("$kind:$key" to value),
                    portraitUpload = if (kind == "portrait") null else it.portraitUpload,
                    iconUploadId = if (kind == "icon") null else it.iconUploadId,
                )
            }
        }
    }
}
