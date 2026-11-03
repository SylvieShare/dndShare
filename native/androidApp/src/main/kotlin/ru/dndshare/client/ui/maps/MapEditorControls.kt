package ru.dndshare.client.ui.maps

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun MapToolButton(label: String, glyph: Glyph, enabled: Boolean = true, run: () -> Unit) {
    IconButton(
        run,
        enabled = enabled,
        modifier = Modifier.semantics { contentDescription = label },
    ) {
        AppGlyph(glyph)
    }
}

@Composable
internal fun MapToolRail(tab: String, select: (String) -> Unit, modifier: Modifier) {
    val tabs =
        listOf(
            Triple("tiles", "Плитки", Glyph.Layers),
            Triple("objects", "Объекты", Glyph.Box),
            Triple("decals", "Декали", Glyph.Sticker),
            Triple("lights", "Освещение", Glyph.Lightbulb),
            Triple("areas", "Области", Glyph.Group),
            Triple("cameras", "Камеры", Glyph.Camera),
            Triple("settings", "Настройки", Glyph.Settings),
            Triple("performance", "Нагрузка", Glyph.Gauge),
        )
    val size = DesignTokens.Layout.MapNavigationItem
    val inset = DesignTokens.Spacing.Compact
    val gap = DesignTokens.Spacing.Xs
    val scroll = rememberScrollState()
    var lastTab by remember { mutableStateOf(tab) }
    SideEffect { if (tab.isNotBlank()) lastTab = tab }
    val index = tabs.indexOfFirst { it.first == tab.ifBlank { lastTab } }.coerceAtLeast(0)
    val dividers = (if (index >= 3) 1 else 0) + (if (index >= 6) 1 else 0)
    val y by
        animateDpAsState(
            inset + (size + gap) * index + (inset * 2 + 1.dp + gap) * dividers,
            animationSpec = tween(260, easing = CubicBezierEasing(.2f, .7f, .2f, 1f)),
            label = "Map rail selection",
        )
    val opacity by
        animateFloatAsState(
            if (tab.isBlank()) 0f else 1f,
            animationSpec = tween(150),
            label = "Map rail highlight",
        )
    val density = LocalDensity.current
    Box(modifier.fillMaxHeight().background(WebPalette.Surface).clipToBounds()) {
        Box(
            Modifier.offset {
                    with(density) {
                        IntOffset(
                            ((DesignTokens.Layout.MapRail - size) / 2).roundToPx(),
                            y.roundToPx() - scroll.value,
                        )
                    }
                }
                .size(size)
                .graphicsLayer { alpha = opacity }
                .background(WebPalette.Accent, MaterialTheme.shapes.medium)
        )
        Column(
            Modifier.fillMaxHeight()
                .fillMaxWidth()
                .verticalScroll(scroll)
                .padding(vertical = inset),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(gap),
        ) {
            tabs.forEach { (key, title, icon) ->
                if (key == "lights" || key == "settings")
                    Box(
                        Modifier.height(inset * 2 + 1.dp).width(40.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Box(
                            Modifier.fillMaxWidth().height(1.dp).background(WebPalette.BorderStrong)
                        )
                    }
                Surface(
                    { select(key) },
                    Modifier.size(size).semantics {
                        contentDescription =
                            if (key == "performance") "Производительность" else title
                        role = Role.Tab
                        selected = tab == key
                    },
                    color = Color.Transparent,
                    contentColor = if (tab == key) WebPalette.OnAccent else WebPalette.TextMuted,
                    shape = MaterialTheme.shapes.medium,
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement =
                            Arrangement.spacedBy(4.dp, Alignment.CenterVertically),
                    ) {
                        AppGlyph(icon)
                        Text(
                            title,
                            style = ShareTypography.context,
                            fontSize = 10.sp,
                            lineHeight = 13.sp,
                            fontWeight = FontWeight(650),
                            maxLines = 1,
                        )
                    }
                }
            }
        }
    }
}
