package ru.dndshare.client.ui.designsystem

import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.input.TextFieldDecorator
import androidx.compose.foundation.text.input.TextFieldLineLimits
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.sp

/** The web stepper face with a native text buffer and real keyboard editing. */
@Composable
fun ShareNumberInput(
    label: String,
    value: String,
    enabled: Boolean = true,
    change: (String) -> Unit,
) {
    val state = rememberShareInputState(value, change)
    val interactions = remember { MutableInteractionSource() }
    val fill = inputFill(interactions, enabled)
    Row(
        Modifier.fillMaxWidth().heightIn(min = DesignTokens.Layout.TouchMin),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(DesignTokens.Spacing.Medium),
    ) {
        Text(
            label,
            Modifier.weight(1f),
            style = fieldTextStyle.copy(fontSize = 13.sp),
            color = WebPalette.TextSecondary,
        )
        BasicTextField(
            state = state,
            enabled = enabled,
            modifier =
                Modifier.widthIn(
                        min =
                            DesignTokens.Layout.NumberInputWidth +
                                DesignTokens.Layout.InputStepperWidth * 2
                    )
                    .heightIn(min = DesignTokens.Layout.NumberInputHeight)
                    .inputSurface(fill)
                    .semantics { contentDescription = label },
            textStyle =
                fieldTextStyle.copy(
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                    color = WebPalette.TextSecondary,
                ),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            lineLimits = TextFieldLineLimits.SingleLine,
            interactionSource = interactions,
            cursorBrush = SolidColor(WebPalette.Accent),
            decorator =
                TextFieldDecorator { field ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        fun step(delta: Long) {
                            val next =
                                runCatching {
                                    Math.addExact(
                                        state.text.toString().toLongOrNull() ?: 0L,
                                        delta,
                                    )
                                }
                                    .getOrNull() ?: return
                            state.edit { replace(0, length, next.toString()) }
                        }
                        NumberStep("−", "Уменьшить: $label", enabled) { step(-1) }
                        Box(
                            Modifier.width(DesignTokens.Layout.NumberInputWidth),
                            contentAlignment = Alignment.Center,
                        ) {
                            field()
                        }
                        NumberStep("+", "Увеличить: $label", enabled) { step(1) }
                    }
                },
        )
    }
}

@Composable
private fun NumberStep(text: String, label: String, enabled: Boolean, click: () -> Unit) {
    Box(
        Modifier.width(DesignTokens.Layout.InputStepperWidth)
            .heightIn(min = DesignTokens.Layout.NumberInputHeight)
            .clickable(enabled = enabled, role = Role.Button, onClick = click)
            .semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text,
            style = fieldTextStyle.copy(fontSize = 16.sp, fontWeight = FontWeight.Bold),
            color = WebPalette.TextMuted,
        )
    }
}
