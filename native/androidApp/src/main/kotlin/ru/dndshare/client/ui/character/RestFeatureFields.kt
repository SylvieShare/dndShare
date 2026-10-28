package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.text
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun RestFeatureFields(form: FeatureFormScope) {
    val sheet = form.editor.baseline
    val context = LocalCharacterSheet.current
    form.Choice(
        "kind",
        "Восстановление",
        listOf("short" to "Короткий отдых", "long" to "Долгий отдых", "dawn" to "Рассвет"),
    )
    val pools = sheet.values["hp"].objectValue()["hitDice"].arrayValue()
    val spent = form.data["hitDiceSpent"].arrayValue()
    if (form.text("kind") == "short") {
        Text(
            "Потратьте кости хитов, затем завершите отдых. Броски сохраняются в форме.",
            style = ShareTypography.context,
        )
        pools.forEach { raw ->
            val row = raw.objectValue()
            val die = row.text("die")
            val remaining =
                row["total"].number() -
                    row["used"].number() -
                    spent.count { it.objectValue().text("die") == die }
            Button(
                onClick = {
                    val con = abilityModifier(context.mechanics.score("CON"))
                    val result = rollDice("1$die${signed(con)}")
                    form.input(
                        "hitDiceSpent",
                        JsonArray(
                            spent +
                                buildJsonObject {
                                    put("die", die)
                                    put("healing", result.total.coerceAtLeast(0))
                                    put("roll", JsonArray(result.dice.map(::JsonPrimitive)))
                                }
                        ),
                    )
                },
                enabled = remaining > 0 && !form.editor.saving,
            ) {
                Text("Потратить $die · осталось $remaining")
            }
        }
        if (spent.isNotEmpty())
            Text(
                "Восстановление: ${spent.joinToString(" + ") { it.objectValue()["healing"].number().toString() }} хитов",
                style = ShareTypography.group,
            )
    } else if (form.text("kind") == "long") {
        Text(
            "Полные хиты, сброс временных хитов и спасбросков от смерти, восстановление ячеек и ресурсов. Истощение уменьшается на один.",
            style = ShareTypography.context,
        )
        Text(
            if (sheet.sourceVersion == "2024") "Восстанавливаются все кости хитов."
            else "Восстанавливается половина общего числа костей хитов (минимум одна).",
            style = ShareTypography.context,
        )
    } else {
        val resources =
            resourceControls(sheet, context.items, includeInactive = true).filter {
                it.rule["dawn_recovery"].objectValue().text("mode") in setOf("roll", "full")
            }
        val cooldowns = itemUseDawnCandidates(sheet, context.items)
        cooldowns.forEach {
            Text(
                "${it.title}: ${it.before} → ${it.after} рассветов",
                style = ShareTypography.context,
            )
        }
        if (resources.isEmpty() && cooldowns.isEmpty())
            Text("Нет ресурсов с восстановлением на рассвете.", style = ShareTypography.context)
        resources.forEach { resource ->
            Text(
                "${resource.title}: ${resource.value}/${resource.total}",
                style = ShareTypography.group,
            )
            val dawn = resource.rule["dawn_recovery"].objectValue()
            if (dawn.text("mode") == "roll") {
                val rolls = form.data["dawnRolls"].objectValue()
                val result = rolls[resource.key]
                if (result != null)
                    Text("Бросок: ${result.jsonPrimitive.content}", color = WebPalette.Success)
                else
                    TextButton(
                        onClick = {
                            val roll = rollDice(dawn.text("formula"))
                            form.input(
                                "dawnRolls",
                                JsonObject(rolls + (resource.key to JsonPrimitive(roll.total))),
                            )
                        }
                    ) {
                        Text("Бросить ${dawn.text("formula")}")
                    }
            }
        }
    }
}
