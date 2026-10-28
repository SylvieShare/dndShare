package ru.dndshare.client.ui.designsystem

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun ShareButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    shape: Shape = RoundedCornerShape(8.dp),
    colors: ButtonColors =
        ButtonDefaults.buttonColors(
            containerColor = WebPalette.Accent,
            contentColor = WebPalette.OnAccent,
        ),
    contentPadding: PaddingValues = PaddingValues(horizontal = 14.dp, vertical = 8.dp),
    content: @Composable RowScope.() -> Unit,
) {
    Button(
        onClick,
        modifier,
        enabled = enabled,
        shape = shape,
        colors = colors,
        contentPadding = contentPadding,
    ) {
        ProvideTextStyle(fieldTextStyle.copy(fontSize = 13.sp, fontWeight = FontWeight.SemiBold)) {
            content()
        }
    }
}

@Composable
fun ShareTextButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    colors: ButtonColors = ButtonDefaults.textButtonColors(contentColor = WebPalette.TextSecondary),
    contentPadding: PaddingValues = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
    content: @Composable RowScope.() -> Unit,
) {
    TextButton(
        onClick,
        modifier,
        enabled = enabled,
        shape = RoundedCornerShape(8.dp),
        colors = colors,
        contentPadding = contentPadding,
    ) {
        ProvideTextStyle(fieldTextStyle.copy(fontSize = 13.sp, fontWeight = FontWeight.SemiBold)) {
            content()
        }
    }
}

@Composable
fun ShareOutlinedButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    shape: Shape = RoundedCornerShape(8.dp),
    border: BorderStroke = BorderStroke(1.dp, WebPalette.BorderStrong),
    colors: ButtonColors =
        ButtonDefaults.outlinedButtonColors(
            containerColor = WebPalette.Raised,
            contentColor = WebPalette.TextSecondary,
        ),
    contentPadding: PaddingValues = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
    content: @Composable RowScope.() -> Unit,
) {
    OutlinedButton(
        onClick,
        modifier,
        enabled = enabled,
        shape = shape,
        border = border,
        colors = colors,
        contentPadding = contentPadding,
    ) {
        ProvideTextStyle(fieldTextStyle.copy(fontSize = 13.sp, fontWeight = FontWeight.SemiBold)) {
            content()
        }
    }
}

@Composable
fun ShareTonalButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    shape: Shape = RoundedCornerShape(8.dp),
    content: @Composable RowScope.() -> Unit,
) {
    ShareButton(
        onClick,
        modifier,
        enabled,
        shape = shape,
        colors =
            ButtonDefaults.buttonColors(
                containerColor = WebPalette.Raised,
                contentColor = WebPalette.Text,
            ),
        content = content,
    )
}
