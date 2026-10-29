package ru.dndshare.client.ui.designsystem

import androidx.compose.foundation.layout.*
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
                .then(active?.let { Modifier.shareMorphBackground(it) } ?: Modifier)
        ) {
            CompositionLocalProvider(LocalMorphLayers provides layers) { content() }
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
