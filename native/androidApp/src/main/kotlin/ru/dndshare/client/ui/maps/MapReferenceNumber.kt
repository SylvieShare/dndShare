package ru.dndshare.client.ui.maps

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.text.input.KeyboardType
import ru.dndshare.client.ui.designsystem.*

internal val LocalReferenceNumberScope = staticCompositionLocalOf { "" }

internal val LocalMapReference = staticCompositionLocalOf<MapReferenceController?> { null }

/** Preserve incomplete numeric input in the draft and forbid silently saving its old value. */
@Composable
internal fun ReferenceNumber(
    value: Double,
    label: String,
    integer: Boolean = false,
    change: (String) -> Unit,
) {
    val reference = LocalMapReference.current
    val inputKey = LocalReferenceNumberScope.current + label.substringAfter(": ")
    val invalid = reference?.draft?.invalidNumbers?.get(inputKey)
    val formatted =
        if (value == value.toLong().toDouble()) value.toLong().toString() else value.toString()
    Column {
        ShareTextInput(
            invalid ?: formatted,
            { text ->
                if (reference?.validateNumber(inputKey, text, integer) != false) change(text)
            },
            label,
            keyboardOptions =
                KeyboardOptions(
                    keyboardType = if (integer) KeyboardType.Number else KeyboardType.Decimal
                ),
        )
        if (invalid != null)
            Text(
                if (integer) "Введите целое число" else "Введите число",
                color = WebPalette.Danger,
                style = ShareTypography.context,
            )
    }
}
