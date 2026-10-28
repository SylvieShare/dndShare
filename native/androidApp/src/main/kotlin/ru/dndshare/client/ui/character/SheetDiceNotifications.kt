package ru.dndshare.client.ui.character

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.flow.first

@Composable
internal fun SheetDiceNotifications(
    ui: SheetRollUiState,
    close: (String) -> Unit,
    repeat: (String) -> Unit,
    mode: (String, String) -> Unit,
    reroll: (String, String) -> Unit,
) {
    var retained by remember { mutableStateOf<List<SheetDiceNotice>>(emptyList()) }
    LaunchedEffect(ui.notices) {
        val all = retained.associateBy { it.id }.toMutableMap()
        ui.notices.forEach { all[it.id] = it }
        retained = all.values.toList()
    }
    BoxWithConstraints(
        Modifier.fillMaxSize().imePadding().padding(16.dp),
        contentAlignment = Alignment.BottomEnd,
    ) {
        Column(
            Modifier.widthIn(max = 380.dp)
                .fillMaxWidth()
                .heightIn(max = maxHeight)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            retained.forEach { notice ->
                key(notice.id) {
                    val present = ui.notices.any { it.id == notice.id }
                    val transition = remember { MutableTransitionState(false) }
                    LaunchedEffect(present) {
                        transition.targetState = present
                        if (!present) {
                            snapshotFlow { transition.isIdle && !transition.currentState }
                                .first { it }
                            retained = retained.filter { it.id != notice.id }
                        }
                    }
                    AnimatedVisibility(
                        transition,
                        enter = fadeIn(tween(220)) + slideInHorizontally(tween(220)) { it / 8 },
                        exit = fadeOut(tween(180)) + shrinkVertically(),
                    ) {
                        SheetDiceNotificationCard(
                            notice,
                            notice.busy ||
                                notice.result == null && notice.id == ui.recordId && ui.busy,
                            ui.busy || !present,
                            close = { close(notice.id) },
                            repeat = { repeat(notice.id) },
                            mode = { mode(notice.id, it) },
                            reroll = { reroll(notice.id, it) },
                        )
                    }
                }
            }
        }
    }
}
