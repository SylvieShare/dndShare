package ru.dndshare.client.ui.designsystem

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LocalTextStyle
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun ShareSwitch(
    checked: Boolean,
    onCheckedChange: ((Boolean) -> Unit)?,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    val fraction by animateFloatAsState(if (checked) 1f else 0f, label = "Switch thumb")
    val track by
        animateColorAsState(
            if (checked) WebPalette.Accent else WebPalette.Raised,
            label = "Switch track",
        )
    val thumb by
        animateColorAsState(
            if (checked) WebPalette.OnAccent else WebPalette.TextMuted,
            label = "Switch foreground",
        )
    Box(
        modifier
            .size(48.dp)
            .alpha(if (enabled) 1f else .45f)
            .then(
                if (onCheckedChange != null)
                    Modifier.toggleable(
                        checked,
                        enabled = enabled,
                        role = Role.Switch,
                        onValueChange = onCheckedChange,
                    )
                else Modifier
            ),
        contentAlignment = Alignment.Center,
    ) {
        Canvas(Modifier.size(DesignTokens.Layout.ToggleWidth, DesignTokens.Layout.ToggleHeight)) {
            drawRoundRect(track, cornerRadius = CornerRadius(size.height / 2))
            if (!checked)
                drawRoundRect(
                    WebPalette.BorderStrong,
                    cornerRadius = CornerRadius(size.height / 2),
                    style = Stroke(1.dp.toPx()),
                )
            val radius = DesignTokens.Layout.ToggleThumb.toPx() / 2
            drawCircle(
                thumb,
                radius,
                Offset(3.dp.toPx() + radius + 16.dp.toPx() * fraction, size.height / 2),
            )
        }
    }
}

@Composable
fun ShareCheckbox(
    checked: Boolean,
    onCheckedChange: ((Boolean) -> Unit)?,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    val fill by
        animateColorAsState(
            if (checked) WebPalette.Accent else Color.White.copy(alpha = .04f),
            label = "Checkbox fill",
        )
    Box(
        modifier
            .size(48.dp)
            .alpha(if (enabled) 1f else .35f)
            .then(
                if (onCheckedChange != null)
                    Modifier.toggleable(
                        checked,
                        enabled = enabled,
                        role = Role.Checkbox,
                        onValueChange = onCheckedChange,
                    )
                else Modifier
            ),
        contentAlignment = Alignment.Center,
    ) {
        Canvas(Modifier.size(DesignTokens.Layout.CheckboxSize)) {
            val inset = .75.dp.toPx()
            drawRoundRect(fill, cornerRadius = CornerRadius(5.dp.toPx()))
            drawRoundRect(
                if (checked) WebPalette.Accent else WebPalette.BorderStrong,
                Offset(inset, inset),
                androidx.compose.ui.geometry.Size(size.width - 2 * inset, size.height - 2 * inset),
                CornerRadius(5.dp.toPx()),
                style = Stroke(1.5.dp.toPx()),
            )
            if (checked)
                drawPath(
                    Path().apply {
                        moveTo(size.width * .23f, size.height * .52f)
                        lineTo(size.width * .43f, size.height * .72f)
                        lineTo(size.width * .8f, size.height * .3f)
                    },
                    WebPalette.OnAccent,
                    style = Stroke(2.dp.toPx(), cap = StrokeCap.Round),
                )
        }
    }
}

@Composable
fun ShareRadioButton(
    selected: Boolean,
    onClick: (() -> Unit)?,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    Box(
        modifier
            .size(48.dp)
            .alpha(if (enabled) 1f else .4f)
            .then(
                if (onClick != null)
                    Modifier.selectable(
                        selected,
                        enabled = enabled,
                        role = Role.RadioButton,
                        onClick = onClick,
                    )
                else Modifier
            ),
        contentAlignment = Alignment.Center,
    ) {
        Canvas(Modifier.size(18.dp)) {
            drawCircle(
                if (selected) WebPalette.Accent else WebPalette.BorderStrong,
                8.dp.toPx(),
                style = Stroke(1.5.dp.toPx()),
            )
            if (selected) drawCircle(WebPalette.Accent, 4.dp.toPx())
        }
    }
}

@Composable
fun ShareChoiceChip(
    selected: Boolean,
    onClick: () -> Unit,
    label: @Composable () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    leadingIcon: (@Composable () -> Unit)? = null,
    trailingIcon: (@Composable () -> Unit)? = null,
) {
    val color by
        animateColorAsState(
            if (selected) WebPalette.Accent else WebPalette.Raised,
            label = "Choice selection",
        )
    Row(
        modifier
            .heightIn(min = 32.dp)
            .background(color, RoundedCornerShape(6.dp))
            .border(
                1.dp,
                if (selected) WebPalette.Accent else WebPalette.BorderStrong,
                RoundedCornerShape(6.dp),
            )
            .selectable(selected, enabled = enabled, role = Role.Checkbox, onClick = onClick)
            .alpha(if (enabled) 1f else .5f)
            .padding(horizontal = 12.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        CompositionLocalProvider(
            androidx.compose.material3.LocalContentColor provides
                if (selected) WebPalette.OnAccent else WebPalette.TextSecondary,
            LocalTextStyle provides
                fieldTextStyle.copy(
                    fontSize = 12.sp,
                    lineHeight = 16.sp,
                    fontWeight = FontWeight.Bold,
                ),
        ) {
            leadingIcon?.invoke()
            label()
            trailingIcon?.invoke()
        }
    }
}
