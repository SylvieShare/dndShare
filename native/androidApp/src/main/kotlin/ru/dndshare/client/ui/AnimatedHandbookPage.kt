package ru.dndshare.client.ui

import ru.dndshare.designsystem.DesignTokens

import androidx.compose.animation.*
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.dp

internal data class HandbookDestination(val collection: Boolean, val typeId: Long, val dictionaryId: Long, val itemId: Long?) {
    val depth get() = if (itemId != null) 2 else if (collection || dictionaryId > 0) 1 else 0
    fun key(format: LayoutFormat): String = when {
        dictionaryId > 0 -> "dictionary:$dictionaryId"
        !collection && itemId == null -> "home"
        format == LayoutFormat.Phone && itemId != null -> "record:$itemId"
        else -> "collection:$typeId"
    }
}

@Composable
internal fun AnimatedHandbookPage(destination: HandbookDestination, format: LayoutFormat,
    content: @Composable (HandbookDestination) -> Unit) {
    val distance = with(LocalDensity.current) { DesignTokens.Motion.Distance.roundToPx() }
    val parentActive = LocalAppPageActive.current
    AnimatedContent(destination, Modifier.fillMaxSize().clipToBounds(), contentKey = { it.key(format) },
        transitionSpec = {
            val direction = if (targetState.depth >= initialState.depth) 1 else -1
            (fadeIn(tween(DesignTokens.Motion.Enter)) + slideInHorizontally(tween(DesignTokens.Motion.Navigation, easing = FastOutSlowInEasing)) { distance * direction })
                .togetherWith(fadeOut(tween(DesignTokens.Motion.Exit)) + slideOutHorizontally(tween(DesignTokens.Motion.Navigation)) { -distance * direction / 2 })
                .using(null)
        }, label = "Handbook navigation") { displayed ->
        val active = parentActive && displayed.key(format) == destination.key(format)
        val interaction = if (active) Modifier else Modifier.clearAndSetSemantics {}.focusProperties { canFocus = false }
            .pointerInput(Unit) { awaitPointerEventScope {
                while (true) awaitPointerEvent(PointerEventPass.Initial).changes.forEach { it.consume() }
            } }
        Box(Modifier.fillMaxSize().then(interaction)) {
            CompositionLocalProvider(LocalAppPageActive provides active) { content(displayed) }
        }
    }
}
