package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import java.util.UUID
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.text
import ru.dndshare.client.ui.designsystem.*

internal fun initialStatInput(target: String, sheet: CharacterSheet): JsonObject {
    val stat = sheet.values[target].objectValue()
    return JsonObject(
        stat + ("bonuses" to (stat["value"].objectValue()["bonuses"] ?: JsonArray(emptyList())))
    )
}

internal fun statFormPatches(form: SheetFormFields, sheet: CharacterSheet): List<SheetPatch> {
    val value =
        form.number.toIntOrNull()?.takeIf { it >= 0 }
            ?: error("Введите целое неотрицательное значение характеристики.")
    val original = sheet.values[form.target].objectValue()
    val input = form.input
    val modes = setOf("auto", "normal", "advantage", "disadvantage")
    fun mode(raw: JsonElement?): JsonPrimitive {
        val text = (raw as? JsonPrimitive)?.content.orEmpty().ifBlank { "auto" }
        require(text in modes) { "Неизвестный режим броска." }
        return JsonPrimitive(text)
    }
    val stat = original.toMutableMap()
    stat["value"] =
        JsonObject(
            original["value"].objectValue() +
                mapOf(
                    "base" to JsonPrimitive(value),
                    "bonuses" to
                        validatedBonuses(
                            input["bonuses"] ?: original["value"].objectValue()["bonuses"]
                        ),
                )
        )
    input["save_up"]?.let { stat["save_up"] = JsonPrimitive(it == JsonPrimitive(true)) }
    input["save_bonuses"]?.let { stat["save_bonuses"] = validatedBonuses(it) }
    for (key in listOf("check_roll_mode", "save_roll_mode")) input[key]?.let {
        stat[key] = mode(it)
    }
    input["skills"]?.let { skills ->
        stat["skills"] =
            JsonObject(
                skills.objectValue().mapValues { (_, raw) ->
                    val row = raw.objectValue()
                    JsonObject(
                        row +
                            mapOf(
                                "up" to JsonPrimitive(inputInteger(row, "up", max = 2)),
                                "bonuses" to validatedBonuses(row["bonuses"]),
                                "roll_mode" to mode(row["roll_mode"]),
                            )
                    )
                }
            )
    }
    return listOf(SheetPatch(path = sheetPath("values", form.target), value = JsonObject(stat)))
}

internal val rollModeOptions =
    listOf(
        "auto" to "Автоматически",
        "normal" to "Обычно",
        "advantage" to "Преимущество",
        "disadvantage" to "Помеха",
    )

/** A field lens always reads the current form, including during a native IME flush. */
private fun FeatureFormScope.nested(path: List<String>): FeatureFormScope {
    fun latest(): JsonObject {
        var value: JsonElement = data
        path.forEach { value = value.objectValue()[it] ?: JsonObject(emptyMap()) }
        return value.objectValue()
    }
    return FeatureFormScope(editor, { key, value -> field(path + key, value) }, ::latest)
}

private fun FeatureFormScope.bonusesAt(key: String): FeatureFormScope =
    FeatureFormScope(
        editor,
        { name, value -> input(if (name == "bonuses") key else name, value) },
        { JsonObject(data + ("bonuses" to (data[key] ?: JsonArray(emptyList())))) },
    )

@Composable
internal fun StatFormFields(
    form: FeatureFormScope,
    number: (SheetNumberField, String) -> Unit,
    mechanics: DndDerivedValues,
    metadata: ru.dndshare.client.model.HandbookMetadata,
) {
    val ability = dndAbilities.first { it.id == form.editor.fields.target }
    ShareFormSection("Значение") {
        SheetNumberInput("Основное значение", form.editor.fields.number, form.enabled) {
            number(SheetNumberField.Current, it)
        }
        BonusFields(form)
    }
    ShareFormSection("Проверка характеристики") {
        ShareSegmentedInput(
            "Режим проверки",
            form.text("check_roll_mode").ifBlank { "auto" },
            rollModeOptions.map { if (it.first == "auto") it.first to "Авто" else it },
            form.enabled,
        ) {
            form.set("check_roll_mode", it)
        }
    }
    ShareFormSection("Спасбросок") {
        form.Toggle("save_up", "Владение спасброском")
        val sources =
            mechanics.rules(
                "save_proficiency",
                RuleContext(kind = "saving_throw", ability = ability.suggestId),
            )
        if (sources.isNotEmpty())
            Text(
                "Источник: ${sources.map { it.sourceLabel }.distinct().joinToString()}",
                style = ShareTypography.context,
            )
        BonusFields(form.bonusesAt("save_bonuses"))
        ShareSegmentedInput(
            "Режим спасброска",
            form.text("save_roll_mode").ifBlank { "auto" },
            rollModeOptions.map { if (it.first == "auto") it.first to "Авто" else it },
            form.enabled,
        ) {
            form.set("save_roll_mode", it)
        }
    }
    ShareFormSection("Навыки") {
        var opened by rememberSaveable(form.editor.fields.id) { mutableStateOf<String?>(null) }
        val skills = form.data["skills"].objectValue()
        val ids = (ability.skills.map(Long::toString) + skills.keys).distinct()
        ids.forEach { id ->
            val skill = form.nested(listOf("skills", id))
            val title =
                skill.text("override_title").ifBlank {
                    metadata.suggests["15"]?.firstOrNull { it.id.toString() == id }?.value
                        ?: skillNames[id.toIntOrNull()]
                        ?: "Навык"
                }
            Surface(
                onClick = { opened = if (opened == id) null else id },
                enabled = form.enabled,
                color = WebPalette.Raised,
                shape = RoundedCornerShape(DesignTokens.Radius.Input),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Row(
                    Modifier.heightIn(min = 36.dp).padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(title, Modifier.weight(1f), style = ShareTypography.group)
                    Text(
                        when (skill.data["up"].number()) {
                            2 -> "Компетентность"
                            1 -> "Владение"
                            else -> "Без владения"
                        },
                        style = ShareTypography.context,
                        color = WebPalette.TextMuted,
                    )
                    AppGlyph(Glyph.Chevron, Modifier.size(14.dp), WebPalette.TextMuted)
                }
            }
            if (opened == id) {
                skill.TextField("override_title", "Своё название")
                ShareSelect(
                    "Владение",
                    skill.text("up").ifBlank { "0" },
                    listOf("0" to "Без владения", "1" to "Владение", "2" to "Компетентность"),
                    form.enabled,
                ) {
                    skill.set("up", it)
                }
                ShareSegmentedInput(
                    "Режим броска",
                    skill.text("roll_mode").ifBlank { "auto" },
                    rollModeOptions.map { if (it.first == "auto") it.first to "Авто" else it },
                    form.enabled,
                ) {
                    skill.set("roll_mode", it)
                }
                BonusFields(skill)
                if (id.toLongOrNull() == null)
                    ShareTextButton(
                        onClick = {
                            form.input("skills", JsonObject(form.data["skills"].objectValue() - id))
                            opened = null
                        }
                    ) {
                        Text("Удалить навык", color = WebPalette.Danger)
                    }
            }
        }
        var revision by rememberSaveable(form.editor.fields.id) { mutableIntStateOf(0) }
        key(revision) { form.TextField("_newSkill", "Название нового навыка") }
        ShareTextButton(
            onClick = {
                val name = form.text("_newSkill").trim()
                if (name.isNotEmpty()) {
                    val id = "c${UUID.randomUUID()}"
                    form.field(
                        listOf("skills", id),
                        buildJsonObject {
                            put("up", 0)
                            put("override_title", name)
                            put("bonuses", JsonArray(emptyList()))
                        },
                    )
                    form.set("_newSkill", "")
                    revision++
                    opened = id
                }
            },
            enabled = form.enabled,
        ) {
            Text("Добавить навык")
        }
    }
}
