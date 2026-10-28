package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun MoneyFeatureFields(form: FeatureFormScope) {
    val context = LocalCharacterSheet.current
    val vtm = form.editor.baseline.templateName == "VTM20"
    val ids =
        if (vtm) listOf("1")
        else walletCurrencyIds(context.sheet.values["money"].objectValue(), context.metadata)
    fun title(id: String) =
        if (vtm) "Доллары"
        else
            context.metadata.suggests["17"].orEmpty().firstOrNull { it.id.toString() == id }?.value
                ?: "Монеты $id"
    var error by remember(form.editor.fields.id) { mutableStateOf<String?>(null) }
    val currency = form.text("_calcCurrency").takeIf { it in ids } ?: ids.firstOrNull()
    LaunchedEffect(currency) {
        if (currency != null && form.text("_calcCurrency") !in ids)
            form.set("_calcCurrency", currency)
    }
    if (currency != null) {
        form.Choice("_calcCurrency", "Валюта", ids.map { it to title(it) })
        ShareCalcPad(
            form.text("_calcExpression"),
            {
                form.set("_calcExpression", it)
                error = null
            },
            form.enabled,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            for ((label, sign) in listOf("Дать" to -1, "Взять" to 1)) FilledTonalButton(
                onClick = {
                    try {
                        val latest = form.data
                        val amount =
                            moneyCalculation(latest, currency, latest.text("_calcExpression"), sign)
                        form.input(currency, JsonPrimitive(amount))
                        form.set("_calcExpression", "")
                        error = null
                    } catch (problem: IllegalArgumentException) {
                        error = problem.message
                    } catch (problem: IllegalStateException) {
                        error = problem.message
                    }
                },
                modifier = Modifier.weight(1f),
                enabled = form.enabled,
            ) {
                Text(label)
            }
        }
        error?.let { Text(it, style = ShareTypography.context, color = WebPalette.Danger) }
    }
    ids.forEach { form.NumberField(it, title(it)) }
}
