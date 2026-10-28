package ru.dndshare.client.ui.creation

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import kotlin.random.Random
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.character.creation.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun CreationEquipmentFields(ui: CreationUiState, model: CharacterCreationViewModel) {
    val context = ui.context
    val draft = ui.draft
    val plan = remember(context) { equipmentPlan(context) } ?: return
    if (draft.version == "2014")
        Row {
            Text("Закупиться позже в магазине", Modifier.weight(1f), style = ShareTypography.group)
            Switch(
                draft.buyEquipment,
                { enabled ->
                    model.update { current ->
                        val rule = ui.rules["wealth"].objectValue()[plan.key].objectValue()
                        val dice = List(rule["dice"].number()) { Random.nextInt(1, 5) }
                        current.copy(
                            buyEquipment = enabled,
                            wealth =
                                current.wealth
                                    ?: buildJsonObject {
                                        put("rolls", JsonArray(dice.map(::JsonPrimitive)))
                                        put("multiplier", rule["multiplier"].number(1))
                                        put("gold", dice.sum() * rule["multiplier"].number(1))
                                    },
                        )
                    }
                },
            )
        }
    if (draft.buyEquipment && draft.version == "2014") {
        Text(
            "Стартовые деньги: ${draft.wealth?.get("gold").number()} зм. Комплекты класса и предыстории заменяются покупками.",
            style = ShareTypography.context,
        )
        return
    }
    Text("Стартовое снаряжение", style = ShareTypography.section)
    for (entry in plan.fixed) Text(
        "${entry.text("name")} ×${entry["count"].number(1)}",
        style = ShareTypography.group,
    )
    EquipmentPicks("__fixed", plan.fixedPicks, ui, model)
    for (group in plan.groups) {
        ShareSection(group.label.ifBlank { "Комплект" }) {
            val selected = draft.equipmentChoices[group.id].objectValue().text("optionId")
            for (branch in group.branches) {
                val active = branch.id == selected || group.branches.size == 1
                ShareTile(
                    framed = false,
                    accent = if (active) WebPalette.Accent else null,
                    onClick = {
                        model.update {
                            it.copy(
                                equipmentChoices =
                                    JsonObject(
                                        it.equipmentChoices +
                                            (group.id to
                                                buildJsonObject {
                                                    put("optionId", branch.id)
                                                    put("picks", JsonObject(emptyMap()))
                                                })
                                    )
                            )
                        }
                    },
                ) {
                    Row {
                        RadioButton(
                            active,
                            onClick = {
                                model.update {
                                    it.copy(
                                        equipmentChoices =
                                            JsonObject(
                                                it.equipmentChoices +
                                                    (group.id to
                                                        buildJsonObject {
                                                            put("optionId", branch.id)
                                                            put("picks", JsonObject(emptyMap()))
                                                        })
                                            )
                                    )
                                }
                            },
                        )
                        Text(branch.label, style = ShareTypography.group)
                    }
                    branch.items.forEach { entry ->
                        Text(
                            "${entry.text("name")} ×${entry["count"].number(1)}",
                            style = ShareTypography.context,
                        )
                    }
                    if (branch.gold > 0) Text("${branch.gold} зм", color = WebPalette.Warning)
                    if (active) EquipmentPicks(group.id, branch.picks, ui, model)
                }
            }
        }
    }
}

@Composable
private fun EquipmentPicks(
    group: String,
    picks: List<EquipmentPick>,
    ui: CreationUiState,
    model: CharacterCreationViewModel,
) {
    for (pick in picks) {
        val selected =
            ui.draft.equipmentChoices[group]
                .objectValue()["picks"]
                .objectValue()[pick.key]
                .arrayValue()
        repeat(pick.count) { index ->
            var expanded by remember { mutableStateOf(false) }
            val item = ui.context.items[selected.getOrNull(index).referenceId()]
            Text(
                "${pick.label}${if (pick.count > 1) " ${index+1}" else ""}",
                style = ShareTypography.context,
            )
            Box {
                ShareAction(
                    item?.name ?: "Выберите предмет",
                    { expanded = true },
                    Modifier.fillMaxWidth(),
                )
                DropdownMenu(expanded, { expanded = false }) {
                    pick.options.forEach { option ->
                        DropdownMenuItem(
                            text = { Text(option.name) },
                            onClick = {
                                model.update { draft ->
                                    val row = draft.equipmentChoices[group].objectValue()
                                    val choices = row["picks"].objectValue()
                                    val list = choices[pick.key].arrayValue().toMutableList()
                                    while (list.size <= index) list.add(JsonNull)
                                    list[index] = JsonPrimitive(option.id)
                                    draft.copy(
                                        equipmentChoices =
                                            JsonObject(
                                                draft.equipmentChoices +
                                                    (group to
                                                        JsonObject(
                                                            row +
                                                                ("picks" to
                                                                    JsonObject(
                                                                        choices +
                                                                            (pick.key to
                                                                                JsonArray(list))
                                                                    ))
                                                        ))
                                            )
                                    )
                                }
                                expanded = false
                            },
                        )
                    }
                }
            }
        }
    }
}

@Composable
internal fun CreationShop(ui: CreationUiState, model: CharacterCreationViewModel) {
    var query by remember { mutableStateOf("") }
    var count by remember { mutableIntStateOf(25) }
    val context = ui.context
    val spent = cartCopper(context)
    val available = ui.draft.wealth?.get("gold").number() * 100
    Text(
        "Кошелёк: ${available/100} зм · покупки ${spent/100.0} зм · остаток ${(available-spent)/100.0} зм",
        style = ShareTypography.group,
        color = if (spent > available) WebPalette.Danger else WebPalette.Warning,
    )
    ui.draft.cart.forEachIndexed { index, row ->
        val item = context.items[row["item_id"].referenceId()]
        Row {
            Text("${item?.name ?: "Предмет"} ×${row["count"].number(1)}", Modifier.weight(1f))
            TextButton(
                onClick = {
                    model.update { it.copy(cart = it.cart.filterIndexed { i, _ -> i != index }) }
                }
            ) {
                Text("Убрать")
            }
        }
    }
    ShareSearch(
        query,
        {
            query = it
            count = 25
        },
    )
    val items =
        ui.catalogue.filter {
            it.typeId in listOf(1L, 2L, 12L, 13L, 14L) &&
                it.data["available_in_starting_shop"] == JsonPrimitive(true) &&
                itemCopper(it) != null &&
                it.name.contains(query, true)
        }
    items.take(count).forEach { item ->
        Row {
            Text(
                "${item.name} · ${(itemCopper(item) ?: 0)/100.0} зм",
                Modifier.weight(1f),
                style = ShareTypography.group,
            )
            TextButton(
                onClick = {
                    model.update { draft ->
                        draft.copy(
                            cart =
                                draft.cart +
                                    buildJsonObject {
                                        put("item_id", item.id)
                                        put("count", item.data["purchase_quantity"].number(1))
                                        put(
                                            "params",
                                            if (item.data.text("measurement") == "length")
                                                buildJsonObject { put("length_ft", 50) }
                                            else JsonObject(emptyMap()),
                                        )
                                    }
                        )
                    }
                },
                enabled = (itemCopper(item) ?: 0) <= available - spent,
            ) {
                Text("Купить")
            }
        }
    }
    if (items.size > count) TextButton(onClick = { count += 25 }) { Text("Показать ещё") }
}
