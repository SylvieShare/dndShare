package ru.dndshare.client.ui.designsystem

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** Static placeholders also stay inexpensive on offscreen retained pages. */
@Composable
fun ShareSkeletonBlock(modifier: Modifier = Modifier, height: Dp = 12.dp, round: Boolean = false) {
    Box(
        modifier
            .height(height)
            .background(
                WebPalette.TextMuted.copy(alpha = .12f).compositeOver(WebPalette.Surface),
                RoundedCornerShape(if (round) 999.dp else 6.dp),
            )
            .clearAndSetSemantics {}
    )
}
