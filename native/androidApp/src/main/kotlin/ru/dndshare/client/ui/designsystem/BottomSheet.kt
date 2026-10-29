package ru.dndshare.client.ui.designsystem

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch

val LocalDisclosureSheets = staticCompositionLocalOf { false }
val LocalDetailsDismiss = staticCompositionLocalOf<() -> Unit> { {} }

/** Product-styled sheet with native nested-scroll, Back, focus and draggable dismissal. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShareBottomSheet(
    title: String,
    onDismissRequest: () -> Unit,
    content: @Composable ColumnScope.() -> Unit,
) {
    val state = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val scope = rememberCoroutineScope()
    val dismiss: () -> Unit = {
        scope.launch {
            state.hide()
            if (!state.isVisible) onDismissRequest()
        }
        Unit
    }
    val maximum = LocalWindowInfo.current.containerDpSize.height * .9f
    ModalBottomSheet(
        onDismissRequest = onDismissRequest,
        sheetState = state,
        sheetMaxWidth = 760.dp,
        containerColor = WebPalette.Background,
        contentColor = WebPalette.Text,
        scrimColor = WebPalette.Scrim,
        shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp),
        dragHandle = {
            BottomSheetDefaults.DragHandle(
                modifier = Modifier.semantics { contentDescription = "Потянуть, чтобы закрыть" },
                color = WebPalette.TextMuted.copy(alpha = .5f),
            )
        },
    ) {
        Column(
            Modifier.fillMaxWidth()
                .heightIn(max = maximum)
                .padding(horizontal = 20.dp)
                .padding(bottom = 20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Row(Modifier.fillMaxWidth()) {
                Text(title, Modifier.weight(1f), style = ShareTypography.header)
                ShareTextButton({
                    dismiss()
                }) {
                    Text("Закрыть")
                }
            }
            Column(
                Modifier.fillMaxWidth().verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                CompositionLocalProvider(LocalDetailsDismiss provides dismiss) { content() }
            }
        }
    }
}
