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
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp

internal val LocalAppPageActive = compositionLocalOf { true }

@Composable
internal fun AnimatedAppPage(page: AppPage, content: @Composable (AppPage) -> Unit) {
    val distance = with(LocalDensity.current) { DesignTokens.Motion.Distance.roundToPx() }
    val readingDirection = if (LocalLayoutDirection.current == LayoutDirection.Ltr) 1 else -1
    AnimatedContent(
        targetState = page,
        modifier = Modifier.fillMaxSize().clipToBounds(),
        contentKey = { it },
        transitionSpec = {
            val direction = if (targetState.ordinal > initialState.ordinal) readingDirection else -readingDirection
            (fadeIn(tween(DesignTokens.Motion.Enter)) + slideInHorizontally(tween(DesignTokens.Motion.Navigation, easing = FastOutSlowInEasing)) { distance * direction })
                .togetherWith(fadeOut(tween(DesignTokens.Motion.Exit)) +
                    slideOutHorizontally(tween(DesignTokens.Motion.Navigation, easing = FastOutSlowInEasing)) { -distance * direction / 2 })
                .using(null)
        },
        label = "App section",
    ) { displayedPage ->
        val active = displayedPage == page
        val interaction = if (active) Modifier else Modifier
            .clearAndSetSemantics { }
            .focusProperties { canFocus = false }
            .pointerInput(Unit) {
                awaitPointerEventScope {
                    while (true) awaitPointerEvent(PointerEventPass.Initial).changes.forEach { it.consume() }
                }
            }
        Box(Modifier.fillMaxSize().then(interaction)) {
            CompositionLocalProvider(LocalAppPageActive provides active) { content(displayedPage) }
        }
    }
}
