package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.data.CacheDao
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun FeatureFormScope.ItemChoice(
    cache: CacheDao,
    key: String,
    types: List<Long>,
    eligibility: (CatalogueItem) -> List<String> = { emptyList() },
) {
    val context = LocalCharacterSheet.current
    var choosing by
        remember(editor.fields.id, key) {
            mutableStateOf(
                key == "item_id" &&
                    data[key].referenceId() == null &&
                    data["autoPick"] == JsonPrimitive(true)
            )
        }
    val id = data[key].referenceId()
    val name =
        context.items[id]?.name
            ?: data.text("selected_name").ifBlank {
                if (id == null) "Выбрать из справочника" else "Предмет $id"
            }
    ShareAction(name, { choosing = true }, Modifier.fillMaxWidth(), icon = Glyph.Book)
    if (id != null)
        ShareTextButton(onClick = { context.openItem(id) }) { Text("Посмотреть в справочнике") }
    if (choosing)
        SheetItemPicker(
            cache,
            editor.baseline,
            types,
            {
                choosing = false
                if (key == "item_id") input("autoPick", JsonPrimitive(false))
            },
            eligibility = eligibility,
        ) { item ->
            val previous = data[key].referenceId()
            if (key == "item_id" && previous != item.id) {
                input("params", JsonObject(data["params"].objectValue() - "magic"))
                if (!canEquipInventoryItem(item)) input("equipped", JsonPrimitive(false))
                input("autoPick", JsonPrimitive(false))
            }
            if (key == "id" && editor.fields.target.startsWith("ability:") && previous != item.id) {
                input("choices", JsonObject(emptyMap()))
                input("count", JsonNull)
            }
            input(key, JsonPrimitive(item.id))
            input("selected_name", JsonPrimitive(item.name))
            choosing = false
        }
}

@Composable
internal fun InventoryFeatureFields(form: FeatureFormScope, cache: CacheDao) {
    val kind = form.editor.fields.target.substringBefore(':')
    if (form.data["fromInventory"] == JsonPrimitive(true))
        Text(
            "Будет перенесено в оружие: ${form.data["count"].number(1)} шт.",
            style = ShareTypography.context,
        )
    if (kind == "inventory-section") form.TextField("name", "Название хранилища")
    else {
        form.ItemChoice(
            cache,
            "item_id",
            if (kind == "weapon") listOf(1L, 19L)
            else inventoryTypeIds(LocalCharacterSheet.current.metadata.types),
            eligibility = { item ->
                if (
                    kind != "weapon" ||
                        item.typeId == 1L ||
                        item.typeId == 19L && item.data["weapon"] is JsonObject
                )
                    emptyList()
                else listOf("У предмета не задано использование как оружия.")
            },
        )
        form.TextField("name", "Своё название (необязательно)")
        if (kind == "inventory" && form.data["item_id"].referenceId() == null) {
            InventoryIconFields(form)
            form.TextField("weight", "Вес одного предмета, фунт.")
        }
        form.Toggle(
            "consumable",
            "Расходуемое",
            LocalCharacterSheet.current.items[form.data["item_id"].referenceId()]
                ?.data
                ?.get("consumable") == JsonPrimitive(true),
        )
        form.TextField("desc", "Описание", multiline = true)
        if (kind == "inventory") {
            form.NumberField("count", "Количество")
            val sections =
                form.editor.baseline.values["items"].objectValue()["sections"].arrayValue()
            if (sections.isNotEmpty())
                form.Choice(
                    "section",
                    "Хранилище",
                    sections.map {
                        it.objectValue().let { row -> row.text("id") to row.text("name") }
                    },
                )
            val owned = LocalCharacterSheet.current.items[form.data["item_id"].referenceId()]
            if (form.data["equipped"] == JsonPrimitive(true) || canEquipInventoryItem(owned))
                form.Toggle("equipped", "Экипировано")
        } else {
            form.Toggle("proficient", "Владение оружием")
            form.Choice(
                "stat_suggest_id",
                "Характеристика",
                listOf("" to "Авто") + dndAbilities.map { it.suggestId.toString() to it.title },
            )
        }
        if (kind == "weapon") WeaponExtraDamageFields(form)
        val params = form.data["params"].objectValue()
        SheetNumberInput("Магический бонус", params.text("magic_bonus")) { value ->
            form.field(listOf("params", "magic_bonus"), JsonPrimitive(value))
        }
        val item = LocalCharacterSheet.current.items[form.data["item_id"].referenceId()]
        if (item?.typeId == 19L) MagicInstanceFields(form, item, cache)
        params
            .filterKeys { it in setOf("length_ft", "capacity", "charges", "weight", "cost") }
            .forEach { (key, value) ->
                if (value is JsonPrimitive && value.booleanOrNull == null)
                    ShareTextInput(
                        value.content,
                        { text ->
                            val updated =
                                text.toDoubleOrNull()?.let { JsonPrimitive(it) }
                                    ?: JsonPrimitive(text)
                            form.field(listOf("params", key), updated)
                        },
                        mapOf(
                                "length_ft" to "Длина, футы",
                                "capacity" to "Вместимость",
                                "charges" to "Заряды",
                                "weight" to "Вес",
                                "cost" to "Стоимость",
                            )[key]
                            .orEmpty(),
                    )
            }
    }
    val values = form.editor.baseline.values
    val uid = form.data.text("uid")
    val existing =
        when (kind) {
            "inventory-section" ->
                values["items"].objectValue()["sections"].arrayValue().any {
                    it.objectValue().text("id") == form.data.text("id")
                }
            "weapon" ->
                form.data["fromInventory"] != JsonPrimitive(true) &&
                    values["weapon"].arrayValue().any { it.objectValue().text("uid") == uid }
            else -> inventoryEntry(values["items"].objectValue(), uid) != null
        }
    if (existing) form.Toggle("remove", "Удалить запись")
}

@Composable
internal fun EntryFeatureFields(form: FeatureFormScope, cache: CacheDao) {
    when (form.editor.fields.target.substringBefore(':')) {
        "resource" -> {
            form.TextField("title", "Название")
            form.NumberField("value", "Доступно")
            form.NumberField("total", "Максимум")
            form.Toggle("short_rest", "Восстановление после короткого отдыха")
            form.Toggle("long_rest", "Восстановление после долгого отдыха")
        }
        "defense" -> {
            form.Choice(
                "kind",
                "Тип защиты",
                listOf(
                    "resistance" to "Сопротивление",
                    "immunity" to "Невосприимчивость",
                    "vulnerability" to "Уязвимость",
                ),
            )
            form.Choice(
                "damage_type",
                "Тип урона",
                LocalCharacterSheet.current.metadata.suggests["12"].orEmpty().map {
                    it.id.toString() to it.value
                },
            )
        }
        "action" -> {
            form.TextField("title", "Название")
            form.TextField("description", "Описание", multiline = true)
            form.Choice("action_type", "Действие", featureActionTypes.map { it.key to it.value })
            if (form.text("action_type") == "timed") {
                val time = form.data["time"].objectValue()
                ShareSelect(
                    "Единица времени",
                    time.text("kind").ifBlank { "minutes" },
                    listOf(
                        "rounds" to "Раунды",
                        "minutes" to "Минуты",
                        "hours" to "Часы",
                        "days" to "Дни",
                    ),
                    enabled = form.enabled,
                ) {
                    form.field(listOf("time", "kind"), JsonPrimitive(it))
                }
                ShareTextInput(
                    time["value"]?.jsonPrimitive?.content ?: "1",
                    {
                        form.field(listOf("time", "value"), JsonPrimitive(it))
                    },
                    "Время выполнения",
                    enabled = form.enabled,
                )
            }
            ShareTextInput(
                form.data["requirements"].arrayValue().joinToString("\n") {
                    it.jsonPrimitive.content
                },
                {
                    form.input("requirements", JsonArray(it.lines().map(::JsonPrimitive)))
                },
                "Условия — по одному на строку",
                enabled = form.enabled,
                multiline = true,
            )
        }
        "ability" -> {
            form.ItemChoice(
                cache,
                "id",
                when (form.data.text("bucket")) {
                    "abilities_feats" -> listOf(7L)
                    "abilities_race" -> listOf(3L)
                    "abilities_story" -> listOf(18L)
                    else -> listOf(4L)
                },
            )
            form.NumberField("count", "Оставшиеся использования")
            LocalCharacterSheet.current.items[form.data["id"].referenceId()]?.let {
                AbilityChoiceFields(form, it, cache)
            }
        }
    }
    if (form.data["index"].number(-1) >= 0) form.Toggle("remove", "Удалить запись")
}
