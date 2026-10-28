package ru.dndshare.client.ui.designsystem

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

/** Small native calculator display/keypad for health, currency and counters. */
@Composable
fun ShareCalcPad(expression: String, change: (String) -> Unit, enabled: Boolean = true) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Surface(color = WebPalette.Raised, shape = MaterialTheme.shapes.small) {
            Text(
                expression.ifBlank { "0" },
                Modifier.fillMaxWidth().padding(12.dp),
                style = ShareTypography.section,
            )
        }
        listOf(
                listOf("7", "8", "9", "/"),
                listOf("4", "5", "6", "*"),
                listOf("1", "2", "3", "-"),
                listOf("C", "0", "⌫", "+"),
            )
            .forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    row.forEach { key ->
                        FilledTonalButton(
                            onClick = {
                                change(
                                    when (key) {
                                        "C" -> ""
                                        "⌫" -> expression.dropLast(1)
                                        else -> (expression + key).take(200)
                                    }
                                )
                            },
                            enabled = enabled,
                            modifier =
                                Modifier.weight(1f).heightIn(min = 48.dp).semantics {
                                    contentDescription =
                                        "Калькулятор: " +
                                            when (key) {
                                                "C" -> "очистить"
                                                "⌫" -> "стереть"
                                                else -> key
                                            }
                                },
                            shape = MaterialTheme.shapes.small,
                        ) {
                            Text(key)
                        }
                    }
                }
            }
    }
}
