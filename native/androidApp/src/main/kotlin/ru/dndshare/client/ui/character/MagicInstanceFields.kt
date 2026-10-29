package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.data.CacheDao
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun MagicInstanceFields(form: FeatureFormScope, item: CatalogueItem, cache: CacheDao) {
    val context = LocalCharacterSheet.current
    val params = form.data["params"].objectValue()
    val state = params["magic"].objectValue()
    var choosing by remember(item.id) { mutableStateOf<MagicEquipmentKind?>(null) }
    for (kind in MagicEquipmentKind.entries) {
        if (item.data[kind.field] !is JsonObject) continue
        val base = magicEquipmentBase(item, params, kind)
        val name = context.items[base]?.name ?: "Выбрать основу"
        Text(kind.title, style = ShareTypography.group)
        ShareTextButton(onClick = { choosing = kind }, enabled = form.enabled) { Text(name) }
    }
    choosing?.let { kind ->
        SheetItemPicker(
            cache,
            form.editor.baseline,
            listOf(kind.typeId),
            { choosing = null },
            eligibility = { base ->
                if (eligibleMagicEquipmentBase(item, base, kind)) emptyList()
                else listOf("Эта основа не подходит предмету.")
            },
        ) { base ->
            form.field(listOf("params", kind.parameter), JsonPrimitive(base.id))
            choosing = null
        }
    }
    if (item.data.text("attunement") != "none")
        ShareToggle("Настройка", state["attuned"] == JsonPrimitive(true), enabled = form.enabled) {
            form.field(listOf("params", "magic", "attuned"), JsonPrimitive(it))
        }
    val original =
        inventoryInstances(form.editor.baseline)
            .firstOrNull { it.first.text("uid") == form.data.text("uid") }
            ?.first
            .objectValue()
    val originalItem = (original["magic_item_id"] ?: original["item_id"]).referenceId()
    val originalState =
        if (originalItem == item.id) original["params"].objectValue()["magic"].objectValue()
        else JsonObject(emptyMap())
    for (stock in initialChargeStocks(item.data)) {
        val existing = initialChargeValue(originalState, stock.key)
        val path =
            listOf("params", "magic") +
                if (stock.key.isBlank()) listOf("max_use") else listOf("resource_maxima", stock.key)
        Text(stock.title, style = ShareTypography.group)
        if (existing != null) {
            Text("Начальный запас: $existing", style = ShareTypography.context)
            val countPath =
                listOf("params", "magic") +
                    if (stock.key.isBlank()) listOf("remaining")
                    else listOf("resource_counts", stock.key)
            val count =
                if (stock.key.isBlank()) state["remaining"]
                else state["resource_counts"].objectValue()[stock.key]
            SheetNumberInput(
                "Осталось",
                (count ?: JsonPrimitive(existing)).jsonPrimitive.content,
                form.enabled,
            ) {
                form.field(countPath, JsonPrimitive(it))
            }
        } else if (stock.rule.text("mode") == "fixed") {
            Text(
                "Начальный запас: ${stock.rule["value"].number()}",
                style = ShareTypography.context,
            )
        } else {
            val value =
                if (stock.key.isBlank()) state["max_use"]
                else state["resource_maxima"].objectValue()[stock.key]
            SheetNumberInput(
                "Начальный запас",
                (value as? JsonPrimitive)?.content.orEmpty(),
                form.enabled,
            ) {
                form.field(path, JsonPrimitive(it))
            }
            var error by remember(item.id, stock.key) { mutableStateOf<String?>(null) }
            ShareTextButton(
                onClick = {
                    try {
                        val total = rollDice(stock.rule.text("formula")).total
                        require(total in 0..100) { "Начальный запас должен быть от 0 до 100." }
                        form.field(path, JsonPrimitive(total))
                        error = null
                    } catch (problem: Exception) {
                        error = problem.message
                    }
                },
                enabled = form.enabled,
            ) {
                Text("Бросить ${stock.rule.text("formula")}")
            }
            error?.let { Text(it, color = WebPalette.Danger, style = ShareTypography.context) }
        }
    }
    if (
        item.data["manual_size"] == JsonPrimitive(true) && initialChargeStocks(item.data).isEmpty()
    ) {
        SheetNumberInput(
            "Максимум зарядов",
            (state["max_use"] ?: item.data["max_use"])?.jsonPrimitive?.content.orEmpty(),
            form.enabled,
        ) {
            form.field(listOf("params", "magic", "max_use"), JsonPrimitive(it))
        }
    }
}
