package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.graphics.Color
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun ItemResourceOrbs(
    resource: ResourceControl,
    error: (String?) -> Unit,
    fallback: Color = WebPalette.Accent,
) {
    val context = LocalCharacterSheet.current
    val scope = rememberCoroutineScope()
    var busy by remember(resource.key) { mutableStateOf(false) }
    val color =
        resourceDisplayColor(resource, context.items).takeIf(String::isNotBlank)?.let {
            runCatching { Color(android.graphics.Color.parseColor(it)) }.getOrNull()
        } ?: fallback
    if (resource.total > 9)
        Text("${resource.value}/${resource.total}", style = ShareTypography.group, color = color)
    else
        Row {
            for (index in 1..resource.total) ShareResourceOrb(
                resource.value >= index,
                "${resource.title} · заряд $index",
                color = color,
                compact = true,
                enabled = context.canEdit && !busy && !context.rollBusy,
                onClick =
                    if (!context.canEdit) null
                    else
                        ({
                            busy = true
                            scope.launch {
                                try {
                                    error(
                                        context.itemMechanic(
                                            resource.key,
                                            "resource-set",
                                            buildJsonObject {
                                                put(
                                                    "value",
                                                    if (resource.value >= index) index - 1
                                                    else index,
                                                )
                                            },
                                        )
                                    )
                                } finally {
                                    busy = false
                                }
                            }
                        }),
            )
        }
}
