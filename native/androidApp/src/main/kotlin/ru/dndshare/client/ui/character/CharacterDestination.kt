package ru.dndshare.client.ui.character

import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.clearAndSetSemantics
import ru.dndshare.client.ui.designsystem.DesignTokens

@Composable
internal fun CharacterDestination(
    uuid: String?,
    depth: Int = if (uuid == null) 0 else 1,
    content: @Composable (String?, Boolean) -> Unit,
) {
    val distance = with(LocalDensity.current) { DesignTokens.Motion.Distance.roundToPx() }
    AnimatedContent(
        CharacterLocation(uuid, depth),
        transitionSpec = {
            val direction = if (targetState.depth < initialState.depth) -1 else 1
            (fadeIn(tween(DesignTokens.Motion.Enter)) +
                    slideInHorizontally(tween(DesignTokens.Motion.Navigation)) {
                        distance * direction
                    })
                .togetherWith(
                    fadeOut(tween(DesignTokens.Motion.Exit)) +
                        slideOutHorizontally(tween(DesignTokens.Motion.Navigation)) {
                            -distance * direction / 2
                        }
                )
                .using(null)
        },
        label = "Character destination",
    ) { displayed ->
        val active = displayed == CharacterLocation(uuid, depth)
        val interaction =
            if (active) Modifier
            else
                Modifier.clearAndSetSemantics {}
                    .focusProperties { canFocus = false }
                    .pointerInput(Unit) {
                        awaitPointerEventScope {
                            while (true) awaitPointerEvent(PointerEventPass.Initial)
                                .changes
                                .forEach { it.consume() }
                        }
                    }
        Box(Modifier.fillMaxSize().then(interaction)) { content(displayed.uuid, active) }
    }
}

private data class CharacterLocation(val uuid: String?, val depth: Int)
