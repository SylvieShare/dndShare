package ru.dndshare.client.ui.creation

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import ru.dndshare.client.character.*
import ru.dndshare.client.character.creation.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun CreationStats(ui: CreationUiState, model: CharacterCreationViewModel) {
    val draft = ui.draft
    var confirmRoll by remember { mutableStateOf(false) }
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        listOf("array" to "Стандартный набор", "point" to "Покупка очков", "roll" to "Броски")
            .forEach { (key, title) ->
                FilterChip(
                    draft.method == key,
                    {
                        model.update {
                            it.copy(method = key, scores = emptyMap(), assignments = emptyMap())
                        }
                    },
                    label = { Text(title) },
                )
            }
    }
    if (draft.method == "point")
        Text(
            "Осталось очков: ${pointBuyRemaining(draft)} / 27",
            style = ShareTypography.group,
            color = WebPalette.AccentSoft,
        )
    if (draft.method == "array") ShareAction("Быстрая сборка", model::quickScores)
    if (draft.method == "roll") {
        ShareAction(
            if (draft.rolls.isEmpty()) "Бросить 6 × 4d6" else "Перебросить",
            { if (draft.rolls.isEmpty()) model.rollScores() else confirmRoll = true },
        )
        draft.rolls.forEachIndexed { index, dice ->
            Text(
                "${index+1}: ${dice.joinToString(" · ")} → ${dice.sortedDescending().take(3).sum()} (меньшая кость отброшена)",
                style = ShareTypography.context,
            )
        }
    }
    val scores = creationScores(draft)
    val pool =
        if (draft.method == "roll") draft.rolls.map { it.sortedDescending().take(3).sum() }
        else listOf(15, 14, 13, 12, 10, 8)
    ShareBalancedColumns(minimumWidth = 260.dp, maxColumns = 3) {
        creationStats.forEachIndexed { index, stat ->
            ShareTile(framed = false) {
                Text(statTitles[index], style = ShareTypography.card)
                val value = scores[stat]
                Text(
                    if (value == null) "?" else "${signed(abilityModifier(value))} ($value)",
                    style = ShareTypography.sheetStatCompact,
                    color = WebPalette.AccentSoft,
                )
                if (draft.method == "point") {
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Button(
                            onClick = {
                                model.update {
                                    it.copy(scores = it.scores + (stat to ((value ?: 8) - 1)))
                                }
                            },
                            enabled = (value ?: 8) > 8,
                        ) {
                            Text("−")
                        }
                        Button(
                            onClick = {
                                model.update {
                                    it.copy(scores = it.scores + (stat to ((value ?: 8) + 1)))
                                }
                            },
                            enabled =
                                (value ?: 8) < 15 &&
                                    pointBuyRemaining(draft) >= if ((value ?: 8) >= 13) 2 else 1,
                        ) {
                            Text("+")
                        }
                    }
                } else {
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        pool.forEachIndexed { slot, number ->
                            val used = draft.assignments.any { it.key != stat && it.value == slot }
                            if (!used)
                                FilterChip(
                                    draft.assignments[stat] == slot,
                                    {
                                        model.update {
                                            it.copy(
                                                assignments =
                                                    if (it.assignments[stat] == slot)
                                                        it.assignments - stat
                                                    else it.assignments + (stat to slot)
                                            )
                                        }
                                    },
                                    label = { Text(number.toString()) },
                                )
                        }
                    }
                }
                if (draft.version == "2024") {
                    val allowed =
                        ui.context
                            .item("background")
                            ?.data
                            ?.get("ability_options")
                            .arrayValue()
                            .map { it.number() }
                    if (allowed.isEmpty() || index + 1 in allowed)
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            listOf(0, 1, 2).forEach { bonus ->
                                FilterChip(
                                    (draft.backgroundAsi[stat] ?: 0) == bonus,
                                    {
                                        model.update {
                                            it.copy(
                                                backgroundAsi = it.backgroundAsi + (stat to bonus)
                                            )
                                        }
                                    },
                                    label = { Text("+$bonus") },
                                    modifier =
                                        Modifier.semantics {
                                            contentDescription =
                                                "${statTitles[index]}: прибавка предыстории +$bonus"
                                        },
                                )
                            }
                        }
                }
            }
        }
    }
    if (confirmRoll)
        AlertDialog(
            onDismissRequest = { confirmRoll = false },
            title = { Text("Испытать судьбу ещё раз?") },
            text = {
                Text(
                    "Текущее распределение будет сброшено. Судьба уже выбрала вам кости — но можно поспорить с ней."
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        confirmRoll = false
                        model.rollScores()
                    }
                ) {
                    Text("Перебросить")
                }
            },
            dismissButton = { TextButton(onClick = { confirmRoll = false }) { Text("Оставить") } },
        )
}
