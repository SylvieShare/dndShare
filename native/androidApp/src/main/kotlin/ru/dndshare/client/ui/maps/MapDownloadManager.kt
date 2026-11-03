package ru.dndshare.client.ui.maps

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.layout.*
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.*
import ru.dndshare.client.ui.designsystem.*

private val kinds =
    linkedMapOf(
        "render" to "Основные",
        "lod" to "LOD",
        "shadow" to "Тени",
        "catalogue" to "Каталог",
        "other" to "Другое",
    )

private fun bytes(value: Long): String =
    when {
        value < 1024 -> "$value Б"
        value < 1024 * 1024 ->
            "%.1f КБ".format(java.util.Locale.forLanguageTag("ru"), value / 1024.0)
        else -> "%.1f МБ".format(java.util.Locale.forLanguageTag("ru"), value / 1048576.0)
    }

@Composable
internal fun MapDownloadManager(workspace: MapEditorWorkspace, cache: MapAssetCache) {
    val transfers by cache.downloads.state.collectAsState()
    val scene = workspace.scene?.loadState?.collectAsState()?.value ?: MapSceneLoadState()
    val document = workspace.preview ?: workspace.map?.document ?: newMapDocument()
    val current =
        remember(document, workspace.state, transfers, scene) {
            mapLoadingReport(document, workspace.state, transfers, scene, scene.problem)
        }
    var session by remember(workspace.id) { mutableStateOf(MapLoadingSession()) }
    val (next, report) = mapLoadingSession(session, current)
    SideEffect { if (session != next) session = next }
    var open by remember(workspace.id) { mutableStateOf(false) }
    var seen by remember(workspace.id) { mutableStateOf(emptySet<String>()) }
    val keys = report.issues.map { it.key }.toSet()
    LaunchedEffect(keys) {
        if (keys.any { it !in seen }) open = true
        if (keys.isEmpty()) open = false
        seen = keys
    }
    fun retry() {
        workspace.scope.launch {
            cache.downloads.retry()
            workspace.controller.retry()
            workspace.scene?.retry()
        }
    }
    AnimatedVisibility(report.remaining > 0 || report.issues.isNotEmpty()) {
        ShareTile(
            Modifier.widthIn(max = 248.dp).semantics { contentDescription = "Загрузка моделей" },
            framed = false,
            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 10.dp),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                AppGlyph(Glyph.Download, Modifier.size(14.dp))
                Text(
                    "Загрузка моделей",
                    Modifier.weight(1f),
                    style =
                        ShareTypography.context.copy(
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                        ),
                )
                if (report.total > 0)
                    Text(
                        "${report.ready}/${report.total}",
                        style = ShareTypography.context,
                        color = WebPalette.TextMuted,
                    )
            }
            if (report.total > 0)
                LinearProgressIndicator(
                    progress = {
                        if (report.unknown || report.totalBytes == 0L)
                            report.ready.toFloat() / report.total
                        else
                            (report.loadedBytes.toDouble() / report.totalBytes)
                                .toFloat()
                                .coerceIn(0f, 1f)
                    },
                    modifier = Modifier.fillMaxWidth().height(5.dp),
                    color = WebPalette.Accent,
                    trackColor = WebPalette.Raised,
                )
            for ((key, label) in kinds) {
                val files = report.files.filter { it.kind == key }
                val remaining = files.count { !it.ready }
                if (remaining > 0)
                    Row(
                        Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Text(
                            label,
                            Modifier.weight(1f),
                            style = ShareTypography.context,
                            color = WebPalette.TextMuted,
                        )
                        Text("$remaining осталось", style = ShareTypography.context)
                        Text(
                            if (files.any { it.unknown }) "Объём уточняется"
                            else bytes(files.sumOf { it.total - it.loaded }),
                            style = ShareTypography.context,
                        )
                    }
            }
            if (report.remaining > 0)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("${report.remaining} осталось", style = ShareTypography.context)
                    Text(
                        if (report.unknown) "Объём уточняется"
                        else bytes((report.totalBytes - report.loadedBytes).coerceAtLeast(0)),
                        style = ShareTypography.context,
                    )
                }
            val active =
                report.files.count {
                    it.state.phase in setOf(MapDownloadPhase.Loading, MapDownloadPhase.Processing)
                }
            val queued = report.files.count { it.state.phase == MapDownloadPhase.Queued }
            val processing = report.files.count { it.state.phase == MapDownloadPhase.Processing }
            Text(
                "В работе $active · В очереди $queued · Подготовка $processing",
                style = ShareTypography.context.copy(fontSize = 10.sp),
                color = WebPalette.TextMuted,
            )
            val retrying = report.files.count { it.state.phase == MapDownloadPhase.Retrying }
            if (retrying > 0)
                Text(
                    "Повторяем загрузку: $retrying · с задержкой до 30 с",
                    style = ShareTypography.context,
                    color = WebPalette.TextMuted,
                )
            if (report.issues.isNotEmpty()) {
                ShareTextButton({ open = true }) {
                    Text("Подробности ошибок (${report.issues.size})")
                }
                ShareTextButton(::retry) {
                    AppGlyph(Glyph.Refresh, Modifier.size(14.dp))
                    Text("Повторить загрузку")
                }
            }
        }
    }
    if (open) MapLoadingErrors(report.issues, document, { open = false }, ::retry)
}
