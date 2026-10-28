package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.data.CacheDao
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun StatusInstanceFields(form: FeatureFormScope, cache: CacheDao) {
    val context = LocalCharacterSheet.current
    val rows =
        normalizedStatusRows(form.editor.baseline.values["states"].arrayValue()) +
            form.data["addedStatuses"].arrayValue().map { it.objectValue() }
    var expanded by rememberSaveable(form.editor.fields.id) { mutableStateOf<String?>(null) }
    var choosing by remember { mutableStateOf(false) }
    Text("Активные эффекты", style = ShareTypography.group)
    var visible = 0
    for (row in rows) {
        val uid = row.text("uid")
        val edit = form.data["statusEdits"].objectValue()[uid].objectValue()
        if (edit["remove"] == JsonPrimitive(true)) continue
        visible++
        val item = context.items[row["effect_id"].referenceId()]
        val title = item?.name ?: "Эффект"
        val source = row["source"].objectValue()
        Text(title, style = ShareTypography.group)
        val details = buildList {
            val level = row["params"].objectValue()["level"].number()
            if (level > 0) add("Уровень $level")
            source.text("label").takeIf(String::isNotBlank)?.let(::add)
            if (source.text("kind") == "manual") add("Добавлен вручную")
            if (row["concentration"] == JsonPrimitive(true)) add("Концентрация")
            if (row["requires_concentration"] == JsonPrimitive(true))
                add("Концентрация отправителя")
        }
        if (details.isNotEmpty())
            Text(
                details.joinToString(" · "),
                style = ShareTypography.context,
                color = WebPalette.TextMuted,
            )
        Row {
            TextButton(
                onClick = { expanded = if (expanded == uid) null else uid },
                enabled = form.enabled,
            ) {
                Text("Изменить длительность")
            }
            TextButton(
                onClick = { form.field(listOf("statusEdits", uid, "remove"), JsonPrimitive(true)) },
                enabled = form.enabled,
            ) {
                Text("Убрать эффект", color = WebPalette.Danger)
            }
        }
        if (expanded == uid) {
            fun duration(): JsonObject =
                (form.data["statusEdits"].objectValue()[uid].objectValue()["duration"]
                        ?: row["duration"])
                    .objectValue()
            fun change(key: String, value: JsonElement) =
                form.field(
                    listOf("statusEdits", uid, "duration"),
                    JsonObject(duration() + (key to value)),
                )
            val value = duration()
            ShareSelect(
                "Длительность: $title",
                value.text("kind").ifBlank { "manual" },
                statusDurationOptions,
                form.enabled,
            ) {
                change("kind", JsonPrimitive(it))
            }
            if (value.text("kind") in setOf("rounds", "minutes", "hours", "days"))
                SheetNumberInput("Количество", value.text("value"), form.enabled) {
                    change("value", JsonPrimitive(it))
                }
            if (value.text("kind") == "custom")
                ShareTextInput(
                    value.text("text"),
                    { change("text", JsonPrimitive(it)) },
                    "Условие окончания",
                    enabled = form.enabled,
                )
        }
    }
    if (visible == 0)
        Text("Активных эффектов нет", style = ShareTypography.context, color = WebPalette.TextMuted)
    ShareAction("Добавить эффект", { choosing = true }, enabled = form.enabled)
    if (choosing)
        SheetItemPicker(
            cache,
            context.sheet,
            listOf(15L),
            { choosing = false },
            eligibility = { item ->
                if (
                    item.data.text("stacking") != "multiple" &&
                        rows.any {
                            it["effect_id"].referenceId() == item.id &&
                                form.data["statusEdits"]
                                    .objectValue()[it.text("uid")]
                                    .objectValue()["remove"] != JsonPrimitive(true)
                        }
                )
                    listOf("Этот эффект уже действует.")
                else emptyList()
            },
        ) { item ->
            val created = createStatusInstance(item, buildJsonObject { put("kind", "manual") })
            form.input(
                "addedStatuses",
                JsonArray(form.data["addedStatuses"].arrayValue() + created),
            )
            choosing = false
        }
}
