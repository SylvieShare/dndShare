package ru.dndshare.client.ui.designsystem

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

@Composable
fun ShareSearch(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "Поиск по названию — RU / EN…",
) {
    OutlinedTextField(
        value,
        onValueChange,
        modifier.fillMaxWidth().heightIn(min = DesignTokens.Layout.TouchMin).semantics {
            contentDescription = placeholder
        },
        singleLine = true,
        placeholder = {
            Text(
                placeholder,
                style = MaterialTheme.typography.bodyMedium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        },
        leadingIcon = { AppGlyph(Glyph.Search, Modifier.size(20.dp)) },
        trailingIcon = {
            if (value.isNotEmpty())
                IconButton(
                    onClick = { onValueChange("") },
                    modifier = Modifier.semantics { contentDescription = "Очистить поиск" },
                ) {
                    AppGlyph(Glyph.Close, Modifier.size(18.dp))
                }
        },
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
        shape = RoundedCornerShape(DesignTokens.Radius.Small),
        colors =
            OutlinedTextFieldDefaults.colors(
                unfocusedContainerColor = WebPalette.Raised,
                focusedContainerColor = WebPalette.Raised,
                unfocusedBorderColor = WebPalette.BorderStrong,
            ),
    )
}

@Composable
fun ShareAction(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: Glyph? = null,
    active: Boolean = false,
    enabled: Boolean = true,
) {
    OutlinedButton(
        onClick,
        modifier.heightIn(min = DesignTokens.Layout.TouchMin),
        shape = RoundedCornerShape(DesignTokens.Radius.Small),
        border = BorderStroke(1.dp, if (active) WebPalette.Accent else WebPalette.BorderStrong),
        colors =
            ButtonDefaults.outlinedButtonColors(
                containerColor =
                    if (active) WebPalette.Accent.copy(alpha = .12f) else WebPalette.Raised,
                contentColor = if (active) WebPalette.AccentSoft else WebPalette.TextSecondary,
            ),
        enabled = enabled,
        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
    ) {
        if (icon != null) {
            AppGlyph(icon, Modifier.size(18.dp))
            Spacer(Modifier.width(7.dp))
        }
        Text(label, style = MaterialTheme.typography.labelLarge)
    }
}
