package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import java.util.UUID
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.data.CacheDao
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun IdentityFeatureFields(form: FeatureFormScope, cache: CacheDao) {
    val context = LocalCharacterSheet.current
    form.TextField("name", "Имя")
    if (form.editor.baseline.templateName != "DND5") return
    var picker by rememberSaveable(form.editor.fields.id) { mutableStateOf<String?>(null) }
    fun rows() = form.data["classes"].arrayValue().map { it.objectValue() }
    fun updateRows(change: (List<JsonObject>) -> List<JsonObject>) {
        form.input("classes", JsonArray(change(rows())))
        form.input("_classesChanged", JsonPrimitive(true))
    }
    fun row(key: String) = rows().firstOrNull { it.text("_key") == key }.objectValue()
    fun updateRow(key: String, change: (JsonObject) -> JsonObject) = updateRows { list ->
        list.map { if (it.text("_key") == key) change(it) else it }
    }
    for ((key, title) in listOf("race" to "Раса", "subrace" to "Происхождение")) {
        Text(title, style = ShareTypography.group)
        Row {
            ShareTextButton(
                { picker = key },
                enabled =
                    form.enabled && (key == "race" || form.data["race"].referenceId() != null),
            ) {
                Text(
                    form.data[key].objectValue().label().ifBlank {
                        if (key == "race") "Выбрать расу" else "Без происхождения"
                    }
                )
            }
            if (form.data[key].referenceId() != null)
                ShareTextButton(
                    {
                        form.input(key, JsonNull)
                        if (key == "race") form.input("subrace", JsonNull)
                    },
                    enabled = form.enabled,
                ) {
                    Text("Очистить")
                }
        }
    }
    ShareTextButton(
        {
            form.input(
                "_classesOpen",
                JsonPrimitive(form.data["_classesOpen"] != JsonPrimitive(true)),
            )
        },
        enabled = form.enabled,
    ) {
        Text("Редактировать классы")
    }
    if (form.data["_classesOpen"] == JsonPrimitive(true)) {
        Text(
            "Ручная правка меняет классы, подклассы и их уровни. Для обычного повышения используйте блок уровня. Полученные способности, хиты и заклинания здесь не пересчитываются.",
            style = ShareTypography.context,
            color = WebPalette.TextMuted,
        )
        rows().forEachIndexed { index, current ->
            val key = current.text("_key")
            key(key) {
                ShareTile(Modifier.fillMaxWidth(), framed = false) {
                    Row {
                        Text("Класс ${index+1}", Modifier.weight(1f), style = ShareTypography.group)
                        IconButton(
                            { updateRows { list -> list.filterNot { it.text("_key") == key } } },
                            enabled = form.enabled,
                        ) {
                            AppGlyph(Glyph.Trash)
                        }
                    }
                    ShareTextButton({ picker = "class:$key" }, enabled = form.enabled) {
                        Text(current.text("name").ifBlank { "Выбрать класс" })
                    }
                    Row {
                        ShareTextButton(
                            { picker = "subclass:$key" },
                            enabled = form.enabled && current["id"].referenceId() != null,
                        ) {
                            Text(
                                current["subclass"].objectValue().label().ifBlank {
                                    "Без подкласса"
                                }
                            )
                        }
                        if (current["subclass"].referenceId() != null)
                            ShareTextButton(
                                { updateRow(key) { JsonObject(it + ("subclass" to JsonNull)) } },
                                enabled = form.enabled,
                            ) {
                                Text("Очистить")
                            }
                    }
                    FeatureFormScope(
                            form.editor,
                            { field, value ->
                                updateRow(key) { JsonObject(it + (field to value)) }
                            },
                            { row(key) },
                        )
                        .NumberField("level", "Уровень класса")
                }
            }
        }
        ShareDashedAction(
            "+ Добавить класс",
            {
                updateRows {
                    it +
                        buildJsonObject {
                            put("_key", UUID.randomUUID().toString())
                            put("id", JsonNull)
                            put("name", "")
                            put("level", 1)
                            put("subclass", JsonNull)
                        }
                }
            },
            enabled = form.enabled,
        )
        Text(
            "Общий уровень: ${rows().sumOf { it["level"].number() }}",
            style = ShareTypography.group,
        )
    }
    picker?.let { target ->
        val kind = target.substringBefore(':')
        val owner = target.substringAfter(':', "")
        val parentId =
            if (kind == "subrace") form.data["race"].referenceId()
            else row(owner)["id"].referenceId()
        SheetItemPicker(
            cache,
            form.editor.baseline,
            listOf(
                when (kind) {
                    "race" -> 8L
                    "subrace" -> 16L
                    "class" -> 9L
                    else -> 17L
                }
            ),
            { picker = null },
            eligibility = { candidate ->
                when {
                    kind in listOf("subrace", "subclass") &&
                        !identityChildMatches(context.items[parentId], candidate, kind, parentId) ->
                        listOf("Выбор относится к другому происхождению или классу.")
                    kind == "class" &&
                        rows().any {
                            it.text("_key") != owner && it["id"].referenceId() == candidate.id
                        } -> listOf("Этот класс уже добавлен.")
                    else -> emptyList()
                }
            },
        ) { selected ->
            val ref = buildJsonObject {
                put("id", selected.id)
                put("name", selected.name)
            }
            when (kind) {
                "race" -> {
                    if (form.data["race"].referenceId() != selected.id)
                        form.input("subrace", JsonNull)
                    form.input("race", ref)
                }
                "subrace" -> form.input("subrace", ref)
                "class" ->
                    updateRow(owner) {
                        if (it["id"].referenceId() == selected.id) it
                        else
                            JsonObject(
                                it +
                                    mapOf(
                                        "id" to JsonPrimitive(selected.id),
                                        "name" to JsonPrimitive(selected.name),
                                        "subclass" to JsonNull,
                                    )
                            )
                    }
                else -> updateRow(owner) { JsonObject(it + ("subclass" to ref)) }
            }
            picker = null
        }
    }
}
