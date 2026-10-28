package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun InventoryIconFields(form: FeatureFormScope) {
    val context = LocalCharacterSheet.current
    val allowed = inventoryTypeIds(context.metadata.types)
    val icons =
        listOf<InventoryIconPreset?>(null) +
            context.icons.presets.filter { it.purpose == "item" && it.itemTypeId in allowed }
    Text("Иконка", style = ShareTypography.group)
    if (context.icons.loading) LinearProgressIndicator(Modifier.fillMaxWidth())
    context.icons.error?.let { message ->
        Row {
            Text(
                message,
                Modifier.weight(1f),
                style = ShareTypography.context,
                color = WebPalette.TextMuted,
            )
            ShareTextButton(context.reloadIcons) { Text("Повторить") }
        }
    }
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val columns = ((maxWidth.value + 6) / 88).toInt().coerceAtLeast(1)
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            for (row in icons.chunked(columns)) Row(
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                row.forEach { preset ->
                    val selected = form.data["icon_preset_id"].referenceId() == preset?.id
                    var visible by remember(preset?.id) { mutableStateOf(false) }
                    ShareCellSurface(
                        Modifier.weight(1f)
                            .onGloballyPositioned { visible = !it.boundsInWindow().isEmpty }
                            .semantics {
                                contentDescription =
                                    "Иконка предмета: ${preset?.name ?: "По умолчанию"}"
                                this.selected = selected
                            },
                        selected = selected,
                        onClick =
                            if (form.enabled)
                                ({
                                    form.input(
                                        "icon_preset_id",
                                        preset?.id?.let(::JsonPrimitive) ?: JsonNull,
                                    )
                                })
                            else null,
                    ) {
                        Column(
                            Modifier.fillMaxSize().padding(6.dp),
                            horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center,
                        ) {
                            val url =
                                preset?.imageUrl
                                    ?: context.metadata.types
                                        .firstOrNull { it.id == 2L }
                                        ?.iconImageUrl
                            if (url != null && visible)
                                AsyncImage(
                                    url,
                                    null,
                                    imageLoader = context.images,
                                    contentScale = ContentScale.Fit,
                                    modifier = Modifier.size(48.dp),
                                )
                            else
                                Box(Modifier.size(48.dp)) {
                                    AppGlyph(
                                        Glyph.Backpack,
                                        Modifier.size(36.dp),
                                        WebPalette.TextMuted,
                                    )
                                }
                            Text(
                                preset?.name ?: "По умолчанию",
                                style = ShareTypography.context.copy(fontSize = 11.sp),
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }
                }
                repeat(columns - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}
