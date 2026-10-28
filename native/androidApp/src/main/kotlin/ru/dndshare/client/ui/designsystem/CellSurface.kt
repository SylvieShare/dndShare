package ru.dndshare.client.ui.designsystem

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/** Square content surface; outlines communicate selection/drop state rather than grouping. */
@Composable
fun ShareCellSurface(
    modifier: Modifier = Modifier,
    selected: Boolean = false,
    dropTarget: Boolean = false,
    onClick: (() -> Unit)? = null,
    content: @Composable BoxScope.() -> Unit,
) {
    val edge by
        animateColorAsState(
            if (dropTarget) WebPalette.AccentSoft
            else if (selected) WebPalette.Accent else Color.Transparent,
            tween(DesignTokens.Motion.Feedback),
            label = "Cell state",
        )
    val border = if (edge.alpha > 0) BorderStroke(2.dp, edge) else null
    val shape = RoundedCornerShape(DesignTokens.Radius.Tile)
    if (onClick == null)
        Surface(
            modifier.aspectRatio(1f),
            shape = shape,
            color = WebPalette.Surface,
            border = border,
        ) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center, content = content)
        }
    else
        Surface(
            onClick,
            modifier.aspectRatio(1f),
            shape = shape,
            color = WebPalette.Surface,
            border = border,
        ) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center, content = content)
        }
}
