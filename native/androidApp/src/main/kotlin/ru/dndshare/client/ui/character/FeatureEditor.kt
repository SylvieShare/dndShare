package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.data.CacheDao
import ru.dndshare.client.model.text
import ru.dndshare.client.ui.designsystem.*

internal data class FeatureFormScope(
    val editor: SheetEditorState,
    val input: (String, JsonElement) -> Unit,
    val readInput: (() -> JsonObject)? = null,
) {
    val data
        get() = readInput?.invoke() ?: editor.fields.input

    val enabled
        get() = !editor.saving && !editor.commandPending

    fun text(key: String) = data.text(key)

    fun set(key: String, value: String) = input(key, JsonPrimitive(value))
}

@Composable
internal fun FeatureEditor(
    editor: SheetEditorState,
    cache: CacheDao,
    close: () -> Unit,
    input: (String, JsonElement) -> Unit,
    submit: () -> Unit,
    participants: List<JsonObject> = emptyList(),
    readInput: (() -> JsonObject)? = null,
) {
    val form = FeatureFormScope(editor, input, readInput)
    val kind = editor.fields.target.substringBefore(':')
    val title =
        when (kind) {
            "journal-entry" -> "Запись дневника"
            "journal-section" -> "Раздел дневника"
            "journal-source" -> "Источник дневника"
            "reorder" -> "Изменить порядок"
            "notes" -> "Заметки"
            "portrait" -> "Портрет персонажа"
            "icon" -> "Иконка персонажа"
            "spell-cast" -> "Сотворение заклинания"
            "item-use" -> "Применение предмета"
            "transfer" -> "Передать предмет"
            "money-transfer" -> "Передать деньги"
            "vtm-health" -> "Здоровье"
            "vtm-blood" -> "Запас крови"
            "vtm-list" ->
                if (editor.fields.target.endsWith("disciplines")) "Дисциплины" else "Предыстории"
            "sources" -> "Источники контента"
            "identity" -> "Имя персонажа"
            "personality" -> personalityFields[editor.fields.target.substringAfter(':')].orEmpty()
            "money" -> "Кошелёк"
            "skill" -> "Навык и спасбросок"
            "utility" -> "Показатель"
            "proficiencies" -> "Владения"
            "inventory" -> "Предмет"
            "inventory-section" -> "Хранилище"
            "weapon" -> "Оружие"
            "spell" -> "Заклинание"
            "spell-tab" -> "Книга заклинаний"
            "spell-slots" -> "Ячейки заклинаний"
            "resource" -> "Ресурс"
            "defense" -> "Защита"
            "action" -> "Действие"
            "ability" -> "Способность"
            "ability-selection" -> "Выбор способностей"
            "rest" -> "Отдых"
            "level" -> "Развитие персонажа"
            else -> editor.fields.target.split(':').last()
        }
    var confirmRemoval by remember(editor.fields.id) { mutableStateOf(false) }
    val inputs = remember(editor.fields.id) { ShareFormInputs() }
    CompositionLocalProvider(
        LocalShareFormInputs provides inputs,
        LocalRichCatalogue provides cache,
    ) {
        ShareFormDialog(
            title,
            close,
            dismissEnabled = !editor.saving,
            actions = {
                ShareTextButton(onClick = close, enabled = !editor.saving) {
                    Text(if (editor.commandPending) "Закрыть" else "Отмена")
                }
                ShareButton(
                    onClick = {
                        inputs.flush()
                        if (form.data["remove"] == JsonPrimitive(true)) confirmRemoval = true
                        else submit()
                    },
                    enabled = !editor.saving && !editor.commandBusy,
                ) {
                    Text(
                        if (editor.saving) "Отправляем…"
                        else if (editor.commandPending) "Повторить"
                        else if (isCommandForm(editor.fields.target)) "Применить" else "Сохранить"
                    )
                }
            },
        ) {
            when (kind) {
                "notes" -> form.TextField("value", "Заметки", multiline = true)
                "journal-entry",
                "journal-section",
                "journal-source" -> JournalFeatureFields(form, cache)
                "spell-cast",
                "item-use",
                "transfer",
                "money-transfer" -> CommandFeatureFields(form, participants)
                "portrait",
                "icon" -> {
                    ru.dndshare.client.ui.media.StagedImageFields(
                        kind == "icon",
                        form.text("originalPath"),
                        form.text("path"),
                        form.enabled,
                        existingUrl =
                            if (kind == "icon") editor.baseline.iconImageUrl
                            else editor.baseline.values["ava"].objectValue().text("url"),
                        images = LocalCharacterSheet.current.images,
                    ) { key, value ->
                        form.set(key, value)
                        if (key == "originalPath") {
                            form.input("uploaded", JsonNull)
                            form.input("remove", JsonPrimitive(false))
                        }
                    }
                    form.Toggle("remove", "Удалить изображение")
                }
                "sources" ->
                    ContentSourceFields(
                        form.data,
                        LocalCharacterSheet.current.metadata.books,
                        form.enabled,
                    ) { settings ->
                        settings.forEach { (key, value) -> form.input(key, value) }
                    }
                "reorder" -> ReorderFields(form)
                "identity" -> IdentityFeatureFields(form, cache)
                "personality" ->
                    personalityFields
                        .filterKeys { it == editor.fields.target.substringAfter(':') }
                        .forEach { (key, label) ->
                            if (key == "person_alignment")
                                form.Choice(key, label, dndAlignments.map { it to it })
                            else
                                form.TextField(
                                    key,
                                    label,
                                    multiline =
                                        key in
                                            setOf(
                                                "person_appearance",
                                                "person_traits",
                                                "person_ideals",
                                                "person_bonds",
                                                "person_flaws",
                                                "person_backstory",
                                                "person_allies",
                                            ),
                                )
                        }
                "money" -> MoneyFeatureFields(form)
                "skill" -> SkillFeatureFields(form)
                "utility" -> UtilityFeatureFields(form)
                "proficiencies" ->
                    (listOf("Оружие", "Доспехи", "Инструменты", "Языки") + form.data.keys)
                        .distinct()
                        .forEach {
                            form.TextField(
                                it,
                                "$it — по одному в строке",
                                multiline = true,
                                rich = false,
                            )
                        }
                "inventory",
                "inventory-section",
                "weapon" -> InventoryFeatureFields(form, cache)
                "spell",
                "spell-tab",
                "spell-slots" -> SpellFeatureFields(form, cache)
                "resource",
                "defense",
                "action",
                "ability" -> EntryFeatureFields(form, cache)
                "ability-selection" -> AbilitySelectionFields(form, cache)
                "rest" -> RestFeatureFields(form)
                "level" -> LevelFeatureFields(form, cache)
                "vtm-health",
                "vtm-blood",
                "vtm-list" -> VtmFeatureFields(form)
                "vtm-text" ->
                    form.TextField(
                        "value",
                        title,
                        multiline =
                            editor.fields.target.split(':').getOrNull(1) in
                                setOf("notes", "clan_weakness"),
                    )
            }
            editor.fields.error?.let {
                Text(it, color = WebPalette.Danger, style = ShareTypography.context)
            }
        }
    }
    if (confirmRemoval)
        ShareAlertDialog(
            onDismissRequest = { confirmRemoval = false },
            title = { Text("Удалить выбранное содержимое?") },
            confirmButton = {
                ShareTextButton(
                    onClick = {
                        confirmRemoval = false
                        submit()
                    }
                ) {
                    Text("Удалить", color = WebPalette.Danger)
                }
            },
            dismissButton = {
                ShareTextButton(onClick = { confirmRemoval = false }) { Text("Отмена") }
            },
        )
}

@Composable
internal fun FeatureFormScope.TextField(
    key: String,
    label: String,
    multiline: Boolean = false,
    rich: Boolean = multiline,
) {
    if (rich) CharacterRichInput(text(key), { set(key, it) }, label, enabled = enabled)
    else
        ShareTextInput(text(key), { set(key, it) }, label, enabled = enabled, multiline = multiline)
}

@Composable
internal fun FeatureFormScope.NumberField(key: String, label: String) =
    SheetNumberInput(label, text(key), enabled) { set(key, it) }

@Composable
internal fun FeatureFormScope.Toggle(key: String, label: String, default: Boolean = false) =
    ShareToggle(label, (data[key] as? JsonPrimitive)?.booleanOrNull ?: default, enabled) {
        input(key, JsonPrimitive(it))
    }

@Composable
internal fun FeatureFormScope.Choice(
    key: String,
    label: String,
    options: List<Pair<String, String>>,
) {
    Text(label, style = ShareTypography.group)
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        options.forEach { (value, title) ->
            ShareChoiceChip(
                text(key) == value,
                { set(key, value) },
                label = { Text(title) },
                enabled = enabled,
            )
        }
    }
}

@Composable
private fun SkillFeatureFields(form: FeatureFormScope) {
    if (form.editor.fields.target.endsWith(":save")) form.Toggle("up", "Владение спасброском")
    else {
        form.TextField("override_title", "Своё название")
        form.Choice(
            "up",
            "Владение",
            listOf("0" to "Без владения", "1" to "Владение", "2" to "Компетентность"),
        )
    }
    form.Choice(
        "roll_mode",
        "Режим броска",
        listOf(
            "auto" to "Автоматически",
            "normal" to "Обычно",
            "advantage" to "Преимущество",
            "disadvantage" to "Помеха",
        ),
    )
    BonusFields(form)
}

@Composable
private fun UtilityFeatureFields(form: FeatureFormScope) {
    val key = form.editor.fields.target.substringAfter(':')
    if (key != "armor")
        form.NumberField(if (key == "prof_bonus") "v" else "base", "Основное значение")
    else
        Text(
            "Базовый КД определяется доспехом, щитом, ловкостью и действующими способностями.",
            style = ShareTypography.context,
        )
    if (key == "prof_bonus") form.Toggle("auto", "Рассчитывать по уровню")
    if (key == "initiative") form.Toggle("use_dex", "Учитывать ловкость")
    BonusFields(form)
}

@Composable
internal fun BonusFields(form: FeatureFormScope) {
    val bonuses = form.data["bonuses"].arrayValue()
    if (bonuses.isNotEmpty()) Text("Бонусы", style = ShareTypography.context)
    key(bonuses.size) {
        bonuses.forEachIndexed { index, raw ->
            val row = raw.objectValue()
            if (row["readonly"] == JsonPrimitive(true))
                Text(
                    "${row.label()} ${signed(row["value"].number())}",
                    style = ShareTypography.context,
                )
            else {
                fun change(key: String, value: String) =
                    form.row(listOf("bonuses"), index, key, JsonPrimitive(value))
                ShareTextInput(
                    row.text("title").ifBlank { row.text("name") },
                    { change("title", it) },
                    "Название бонуса",
                )
                SheetNumberInput("Значение", row.text("value")) { change("value", it) }
                ShareTextButton(
                    onClick = {
                        form.input(
                            "bonuses",
                            JsonArray(
                                form.data["bonuses"].arrayValue().filterIndexed { i, _ ->
                                    i != index
                                }
                            ),
                        )
                    }
                ) {
                    Text("Убрать бонус", color = WebPalette.Danger)
                }
            }
        }
    }
    ShareDashedAction(
        "Добавить бонус",
        onClick = {
            form.input(
                "bonuses",
                JsonArray(
                    form.data["bonuses"].arrayValue() +
                        buildJsonObject {
                            put("title", "Бонус")
                            put("value", 0)
                        }
                ),
            )
        },
        enabled = form.enabled,
        compact = true,
    )
}
