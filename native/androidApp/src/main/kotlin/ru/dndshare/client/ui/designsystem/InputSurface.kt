package ru.dndshare.client.ui.designsystem

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.sp

internal val fieldTextStyle: TextStyle
    get() =
        ShareTypography.header.copy(
            fontSize = 14.sp,
            lineHeight = 20.sp,
            fontWeight = FontWeight.Normal,
        )

@Composable
internal fun FieldCaption(label: String) {
    if (label.isNotEmpty())
        Text(
            label,
            style = ShareTypography.context.copy(fontSize = 13.sp, lineHeight = 18.sp),
            color = WebPalette.TextSecondary,
        )
}

@Composable
internal fun inputFill(
    interactions: MutableInteractionSource,
    enabled: Boolean,
    invalid: Boolean = false,
): Color {
    val focused by interactions.collectIsFocusedAsState()
    val color by
        animateColorAsState(
            inputFillColor(focused, invalid),
            label = "Input focus",
        )
    return color.copy(alpha = color.alpha * if (enabled) 1f else .55f)
}

internal fun inputFillColor(focused: Boolean, invalid: Boolean = false): Color =
    when {
        invalid -> WebPalette.Danger.copy(alpha = .16f).compositeOver(WebPalette.Raised)
        focused -> WebPalette.Accent.copy(alpha = .18f).compositeOver(WebPalette.Raised)
        else -> WebPalette.Raised
    }

internal fun Modifier.inputSurface(fill: Color) =
    background(fill, RoundedCornerShape(DesignTokens.Radius.Input))

/**
 * Controlled input for search/login: Android IME, selection, password and autofill remain native.
 */
@Composable
fun ShareValueInput(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    showLabel: Boolean = true,
    enabled: Boolean = true,
    placeholder: String = "",
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    leading: (@Composable () -> Unit)? = null,
    trailing: (@Composable () -> Unit)? = null,
) {
    val interactions = remember { MutableInteractionSource() }
    val fill = inputFill(interactions, enabled)
    Column(
        modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(DesignTokens.Spacing.Compact),
    ) {
        if (showLabel) FieldCaption(label)
        BasicTextField(
            value,
            onValueChange,
            modifier =
                Modifier.fillMaxWidth()
                    .heightIn(min = DesignTokens.Layout.InputHeight)
                    .inputSurface(fill)
                    .semantics { contentDescription = label },
            enabled = enabled,
            textStyle =
                fieldTextStyle.copy(
                    color = WebPalette.Text.copy(alpha = if (enabled) 1f else .55f)
                ),
            singleLine = true,
            keyboardOptions = keyboardOptions,
            keyboardActions = keyboardActions,
            visualTransformation = visualTransformation,
            interactionSource = interactions,
            cursorBrush = SolidColor(WebPalette.Accent),
            decorationBox = { field ->
                Row(
                    Modifier.padding(
                        horizontal = DesignTokens.Layout.InputPaddingHorizontal,
                        vertical = DesignTokens.Layout.InputPaddingVertical,
                    ),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(DesignTokens.Spacing.Small),
                ) {
                    leading?.invoke()
                    Box(Modifier.weight(1f)) {
                        if (value.isEmpty() && placeholder.isNotEmpty())
                            Text(placeholder, style = fieldTextStyle, color = WebPalette.TextMuted)
                        field()
                    }
                    trailing?.invoke()
                }
            },
        )
    }
}
