package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.text
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun FeatureWidgetCards() {
    val context = LocalCharacterSheet.current
    val widgets =
        remember(context.sheet, context.items) { featureWidgets(context.sheet, context.items) }
    widgets.forEach { widget ->
        val scope = rememberCoroutineScope()
        var busy by remember(widget.key) { mutableStateOf(false) }
        var error by remember(widget.key) { mutableStateOf<String?>(null) }
        val tone =
            when (widget.definition.text("tone")) {
                "danger" -> WebPalette.Danger
                "warning" -> WebPalette.Warning
                "success" -> WebPalette.Success
                "info" -> WebPalette.Info
                else -> WebPalette.Accent
            }
        ShareTile(
            Modifier.fillMaxWidth(),
            tint = tone,
            accent = if (widget.active) tone else null,
            framed = false,
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                widget.feature.item.iconImageUrl?.let {
                    AsyncImage(
                        it,
                        null,
                        imageLoader = context.images,
                        modifier = Modifier.size(42.dp),
                    )
                }
                Column(Modifier.weight(1f)) {
                    Text(widget.title, style = ShareTypography.group)
                    val description =
                        widget.unavailable.ifBlank { widget.definition.text("description") }
                    if (description.isNotBlank())
                        Text(
                            description,
                            style = ShareTypography.context,
                            color = WebPalette.TextMuted,
                        )
                }
                if (widget.value.isNotBlank())
                    Text(widget.value, style = ShareTypography.card, color = tone)
            }
            widget.definition["details"]
                .arrayValue()
                .map { it.jsonPrimitive.content }
                .filter(String::isNotBlank)
                .forEach { Text("• $it", style = ShareTypography.context) }
            if (widget.unlimited) Text("Без ограничений", style = ShareTypography.context)
            widget.resource?.let { resource ->
                if (resource.total <= 12)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        for (pip in 1..resource.total) ShareChoiceChip(
                            pip <= resource.value,
                            {
                                val next = if (pip <= resource.value) pip - 1 else pip
                                busy = true
                                scope.launch {
                                    try {
                                        error =
                                            context.itemMechanic(
                                                resource.key,
                                                "resource-set",
                                                buildJsonObject { put("value", next) },
                                            )
                                    } finally {
                                        busy = false
                                    }
                                }
                            },
                            label = { Text(pip.toString()) },
                            enabled = context.canEdit && !busy,
                        )
                    }
                else
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            "${resource.title}: ${resource.value}/${resource.total}",
                            Modifier.weight(1f),
                            style = ShareTypography.context,
                        )
                        ShareTextButton(
                            onClick = { context.adjustResource(resource.key, -1) },
                            enabled = context.canEdit && resource.value > 0,
                        ) {
                            Text("−")
                        }
                        ShareTextButton(
                            onClick = { context.adjustResource(resource.key, 1) },
                            enabled = context.canEdit && resource.value < resource.total,
                        ) {
                            Text("+")
                        }
                    }
            }
            if (widget.kind == "toggle")
                ShareButton(
                    onClick = {
                        busy = true
                        scope.launch {
                            try {
                                error =
                                    context.itemMechanic(
                                        widget.key,
                                        "feature-widget",
                                        JsonObject(emptyMap()),
                                    )
                            } finally {
                                busy = false
                            }
                        }
                    },
                    enabled =
                        context.canEdit &&
                            !busy &&
                            (widget.active ||
                                (widget.unavailable.isBlank() &&
                                    (widget.unlimited ||
                                        widget.resource == null ||
                                        widget.resource.total <= 0 ||
                                        widget.resource.value > 0))),
                ) {
                    Text(
                        if (widget.active)
                            widget.definition.text("active_label").ifBlank { "Активно" }
                        else widget.definition.text("inactive_label").ifBlank { "Активировать" }
                    )
                }
            widget.notes.forEach { note ->
                Text(note.title, style = ShareTypography.group)
                note.definition.text("description").takeIf(String::isNotBlank)?.let {
                    Text(it, style = ShareTypography.context, color = WebPalette.TextMuted)
                }
            }
            error?.let { Text(it, color = WebPalette.Danger) }
        }
    }
}
