package ru.dndshare.client.ui.designsystem

import androidx.compose.ui.geometry.*
import kotlin.math.max
import kotlin.math.min

data class MorphPlan(
    val source: Rect, val viewport: Size, val stacked: Boolean,
    val panelWidth: Float, val previewWidth: Float, val editorWidth: Float,
    val previewLimit: Float, val maximumHeight: Float,
)

/** Sanitizes layout observations, including detached/off-screen anchors and transient IME sizes. */
fun morphPlan(viewport: Size, live: Rect?, previous: Rect?, density: Float): MorphPlan {
    val scale = density.takeIf { it.isFinite() && it > 0 } ?: 1f
    val width = viewport.width.takeIf { it.isFinite() && it > 0 } ?: 1f
    val height = viewport.height.takeIf { it.isFinite() && it > 0 } ?: 1f
    val screen = Rect(0f, 0f, width, height)
    fun usable(rect: Rect?) = rect != null && listOf(rect.left, rect.top, rect.right, rect.bottom).all(Float::isFinite) &&
        rect.width > 0 && rect.height > 0 && rect.overlaps(screen)
    val fallbackWidth = min(width, DesignTokens.Layout.SheetStatMin.value * scale)
    val fallbackHeight = min(height, 128f * scale)
    val raw = when {
        usable(live) -> requireNotNull(live)
        usable(previous) -> requireNotNull(previous)
        else -> Rect((width - fallbackWidth) / 2, (height - fallbackHeight) / 2,
            (width + fallbackWidth) / 2, (height + fallbackHeight) / 2)
    }
    val source = raw.intersect(Rect(-width, -height, width * 2, height * 4))
    val stacked = width <= DesignTokens.Layout.MorphStackedMax.value * scale
    val panelWidth = if (stacked) width else min((width - 2 * DesignTokens.Layout.MorphMargin.value * scale).coerceAtLeast(1f), source.width + DesignTokens.Layout.MorphEditorWidth.value * scale)
    val preview = if (stacked) panelWidth else source.width.coerceIn(
        min(DesignTokens.Layout.MorphPreviewMin.value * scale, panelWidth / 2), (panelWidth - min(DesignTokens.Layout.MorphPreviewMin.value * scale, panelWidth / 2)).coerceAtLeast(1f))
    val maxHeight = (if (stacked) height else height * .9f).coerceAtLeast(1f)
    return MorphPlan(source, Size(width, height), stacked, panelWidth, preview,
        if (stacked) panelWidth else (panelWidth - preview).coerceAtLeast(1f),
        if (stacked) min(height * .45f, DesignTokens.Layout.MorphPreviewMaxHeight.value * scale).coerceAtLeast(1f) else maxHeight, maxHeight)
}

fun MorphPlan.frame(progress: Float, editorHeight: Float): Rect {
    val targetHeight = if (stacked) viewport.height else max(min(source.height, maximumHeight), editorHeight).coerceIn(1f, maximumHeight)
    val left = (viewport.width - panelWidth) / 2
    val top = if (stacked) 0f else (viewport.height - targetHeight) / 2
    return lerp(source, Rect(left, top, left + panelWidth, top + targetHeight), progress.coerceIn(0f, 1f))
}
