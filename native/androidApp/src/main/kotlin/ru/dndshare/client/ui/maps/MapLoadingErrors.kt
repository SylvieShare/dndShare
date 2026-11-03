package ru.dndshare.client.ui.maps

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun MapLoadingErrors(
    issues: List<MapLoadingIssue>,
    document: JsonObject,
    close: () -> Unit,
    retry: () -> Unit,
) {
    val stages =
        mapOf(
            "catalogue" to "Получение каталога",
            "download" to "Получение файла",
            "decode" to "Декодирование GLB и текстур",
            "geometry" to "Подготовка геометрии",
            "scene" to "Подготовка сцены",
        )
    val kinds =
        mapOf(
            "render" to "Основная модель",
            "lod" to "LOD",
            "shadow" to "Теневая модель",
            "catalogue" to "Каталог моделей",
            "other" to "Изображение",
        )
    ShareWindow(
        onDismissRequest = close,
        title = { Text("Проблемы загрузки карты") },
        actions = {
            ShareTextButton(retry) { Text("Повторить сейчас") }
            ShareTextButton(close) { Text("Закрыть") }
        },
    ) {
        for (issue in issues) key(issue.key) {
            Text(issue.title, style = ShareTypography.header)
            Text(issue.message, style = ShareTypography.context)
            Text("Этап: ${stages[issue.stage] ?: issue.stage}", style = ShareTypography.context)
            for (model in issue.models) Text(
                "Модель: ${model.name} · ${model.id}",
                style = ShareTypography.context,
            )
            issue.kind?.let { Text("Ресурс: ${kinds[it] ?: it}", style = ShareTypography.context) }
            issue.status?.let { Text("HTTP: $it", style = ShareTypography.context) }
            if (issue.attempt > 0)
                Text("Попытка: ${issue.attempt}", style = ShareTypography.context)
            issue.url?.let {
                Text("Запрос: ${mapLoadingPath(it)}", style = ShareTypography.context)
            }
            if (issue.retryable)
                Text(
                    "Это не подтверждение отсутствия модели. Автоматические попытки продолжаются с паузами до 30 секунд; окно можно закрыть.",
                    style = ShareTypography.context,
                    color = WebPalette.TextMuted,
                )
            if (issue.models.isEmpty())
                for (id in issue.modelIds) Text(id, style = ShareTypography.context)
            val affected =
                (document.rows("tiles").map { "Плитка" to it } +
                        document.rows("objects").map { "Объект" to it })
                    .filter { it.second.string("modelId") in issue.modelIds }
            if (affected.isNotEmpty()) {
                var expanded by remember { mutableStateOf(false) }
                ShareTextButton({ expanded = !expanded }) {
                    Text("Элементы карты (${affected.size})")
                }
                AnimatedVisibility(expanded) {
                    Column {
                        for ((kind, entry) in affected.take(50)) Text(
                            "$kind ${entry.string("id")} · модель ${entry.string("modelId")} · X ${entry.number("x")}, Y ${entry.number("y")}" +
                                if (entry["level"] != null)
                                    ", уровень ${entry.number("level").toInt()+1}"
                                else "",
                            style = ShareTypography.context,
                        )
                        if (affected.size > 50)
                            Text(
                                "Показаны первые 50 элементов из ${affected.size}.",
                                style = ShareTypography.context,
                            )
                    }
                }
            }
        }
    }
}
