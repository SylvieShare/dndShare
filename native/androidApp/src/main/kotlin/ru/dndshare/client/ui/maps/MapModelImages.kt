package ru.dndshare.client.ui.maps

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.ImageLoader
import coil3.compose.AsyncImage
import ru.dndshare.client.BuildConfig
import ru.dndshare.client.maps.MapModel
import ru.dndshare.client.maps.rows
import ru.dndshare.client.ui.designsystem.*

internal fun mapImageUrl(path: String) =
    if (path.startsWith('/')) BuildConfig.API_BASE_URL.trimEnd('/') + path else path

@Composable
internal fun MapPackIcon(
    pack: String,
    images: ImageLoader,
    modifier: Modifier = Modifier.size(40.dp),
) {
    val name =
        pack.takeIf { it in setOf("lost-cave", "ultimate-dungeon", "toxic-sewer") } ?: "default"
    AsyncImage(
        "file:///android_asset/maps/packs/$name.svg",
        null,
        imageLoader = images,
        modifier = modifier,
    )
}

@Composable
internal fun MapModelCard(
    model: MapModel,
    images: ImageLoader,
    selected: Boolean,
    inspect: Boolean = false,
    modifier: Modifier = Modifier,
    choose: () -> Unit,
) {
    var pending by remember(model.previewUrl) { mutableStateOf(model.previewUrl.isNotBlank()) }
    ShareTile(
        modifier = modifier,
        onClick = choose,
        framed = selected,
        tint = if (selected) WebPalette.Accent else null,
        containerColor = WebPalette.MapPreview,
        borderColor = WebPalette.Accent.copy(alpha = .55f),
        contentPadding = PaddingValues(6.dp),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Box(
                Modifier.fillMaxWidth().height(105.dp).clip(RoundedCornerShape(6.dp)),
                contentAlignment = Alignment.Center,
            ) {
                if (pending) ShareSkeletonBlock(Modifier.fillMaxSize())
                if (model.previewUrl.isBlank()) AppGlyph(Glyph.Box)
                else
                    AsyncImage(
                        mapImageUrl(model.previewUrl),
                        null,
                        imageLoader = images,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Fit,
                        onSuccess = { pending = false },
                        onError = { pending = false },
                    )
                val count = model.behaviour.rows("defaultLights").size
                if (count > 0)
                    Row(Modifier.align(Alignment.TopEnd)) {
                        AppGlyph(Glyph.Lightbulb, Modifier.size(14.dp), WebPalette.Warning)
                        if (count > 1) Text(count.toString(), style = ShareTypography.context)
                    }
            }
            Text(
                model.name,
                style = ShareTypography.context.copy(fontSize = 12.sp, lineHeight = 15.6.sp),
            )
            if (inspect)
                Text(
                    model.id,
                    style = ShareTypography.context.copy(fontSize = 10.sp),
                    color = WebPalette.TextMuted,
                )
            if (model.width > 1 || model.height > 1)
                Text(
                    "${model.width} × ${model.height} клетки",
                    style = ShareTypography.context.copy(fontSize = 10.sp),
                    color = WebPalette.TextMuted,
                )
            if (model.supportSlots.isNotEmpty())
                Text(
                    "Пазов: ${model.supportSlots.size}",
                    style = ShareTypography.context.copy(fontSize = 10.sp),
                    color = WebPalette.TextMuted,
                )
        }
    }
}
