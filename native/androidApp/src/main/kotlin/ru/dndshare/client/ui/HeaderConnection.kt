package ru.dndshare.client.ui

import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import ru.dndshare.client.app.AppState
import ru.dndshare.client.ui.designsystem.*

internal data class HeaderConnectionState(
    val busy: Boolean = false,
    val error: String? = null,
    val message: String = "Соединяемся с сервером…",
)

internal val LocalHeaderConnection = staticCompositionLocalOf { HeaderConnectionState() }
internal val LocalHeaderRetry = staticCompositionLocalOf<() -> Unit> { {} }

internal fun AppState.headerConnection() =
    HeaderConnectionState(
        synchronizing,
        error,
        if (received > 0) "Синхронизация · получено $received" else "Обновляем данные…",
    )

/** Inserts actual layout width, moving preceding widgets smoothly instead of overlaying them. */
@Composable
internal fun HeaderConnectionWidget(
    state: HeaderConnectionState = LocalHeaderConnection.current,
    retry: () -> Unit = LocalHeaderRetry.current,
    reload: (() -> Unit)? = null,
) {
    var open by remember { mutableStateOf(false) }
    LaunchedEffect(state.busy, state.error) { if (!state.busy && state.error == null) open = false }
    AnimatedVisibility(
        state.busy || state.error != null,
        enter =
            expandHorizontally(tween(DesignTokens.Motion.Navigation), expandFrom = Alignment.End) +
                fadeIn(),
        exit =
            shrinkHorizontally(
                tween(DesignTokens.Motion.Navigation),
                shrinkTowards = Alignment.End,
            ) + fadeOut(),
    ) {
        Box {
            val label = state.error ?: state.message
            IconButton(
                { open = true },
                Modifier.size(48.dp).semantics {
                    contentDescription = label
                    liveRegion = LiveRegionMode.Polite
                },
            ) {
                if (state.error != null)
                    AppGlyph(Glyph.InfoCircle, Modifier.size(21.dp), WebPalette.Danger)
                else
                    CircularProgressIndicator(
                        Modifier.size(19.dp),
                        strokeWidth = 2.dp,
                        color = WebPalette.AccentSoft,
                    )
            }
            ShareDropdownMenu(open, { open = false }) {
                Text(
                    label,
                    Modifier.widthIn(max = 280.dp).padding(12.dp),
                    style = ShareTypography.context,
                )
                if (state.error != null) {
                    ShareDropdownMenuItem(
                        { Text("Повторить") },
                        {
                            open = false
                            retry()
                        },
                        leadingIcon = { AppGlyph(Glyph.Refresh) },
                    )
                    if (reload != null)
                        ShareDropdownMenuItem(
                            { Text("Версия сервера") },
                            {
                                open = false
                                reload()
                            },
                            leadingIcon = { AppGlyph(Glyph.Refresh) },
                        )
                }
            }
        }
    }
}
