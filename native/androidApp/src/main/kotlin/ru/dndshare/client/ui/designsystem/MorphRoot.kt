package ru.dndshare.client.ui.designsystem

import androidx.compose.foundation.layout.*
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.dp
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInWindow

internal class MorphLayer(
    val state: ShareMorphState,
    val context: CompositionLocalContext,
    val content: @Composable () -> Unit,
)

internal class MorphLayers {
    val entries = mutableStateMapOf<Any, MorphLayer>()
}

internal val LocalMorphLayers = staticCompositionLocalOf<MorphLayers?> { null }

/**
 * A stable, same-window overlay plane above application chrome. Each screen keeps its own morph
 * state and composition locals; navigation never remounts its background or movable source.
 */
@Composable
fun ShareMorphRoot(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    val layers = remember { MorphLayers() }
    val windows = remember { WindowBackdrops() }
    val windowRadius = animateDpAsState(windows.radius, tween(if (windows.radius > 0.dp) DesignTokens.Motion.Enter else DesignTokens.Motion.Exit), label = "Window backdrop blur")
    val entries = layers.entries.toMap()
    val active = entries.values.lastOrNull { it.state.isActive }?.state
    Box(
        modifier.fillMaxSize().onGloballyPositioned { coordinates ->
            layers.entries.values.forEach {
                it.state.hostOrigin = coordinates.positionInWindow()
                it.state.hostPlaced = true
            }
        }
    ) {
        Box(
            Modifier.fillMaxSize()
                .then(if (active != null || windows.entries.isNotEmpty()) Modifier.clearAndSetSemantics {} else Modifier)
                .shareBackgroundBlur { maxOf(8.dp * (active?.progress ?: 0f), windowRadius.value) }
        ) {
            CompositionLocalProvider(LocalMorphLayers provides layers, LocalWindowBackdrops provides windows) { content() }
        }
        entries.forEach { (token, layer) ->
            key(token) {
                Box(
                    Modifier.fillMaxSize()
                        .windowInsetsPadding(WindowInsets.safeDrawing)
                        .onGloballyPositioned {
                            layer.state.hostOrigin = it.positionInWindow()
                            layer.state.hostPlaced = true
                        }
                ) {
                    CompositionLocalProvider(layer.context) { layer.content() }
                }
            }
        }
    }
}
