package ru.dndshare.client.ui

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.*
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.unit.*
import coil3.ImageLoader
import coil3.compose.AsyncImage
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun ItemDetailCover(
    item: CatalogueItem,
    type: ItemType?,
    metadata: HandbookMetadata,
    images: ImageLoader,
    headerInset: Int = 0,
    back: (() -> Unit)? = null,
    open: (Long) -> Unit = {},
) {
    val cover =
        item.coverImageUrl?.takeIf(String::isNotBlank)
            ?: type?.coverImageUrl?.takeIf(String::isNotBlank)
    val preview = LocalCataloguePreview.current
    val summary =
        remember(item, type, metadata, preview.instance) {
            catalogueSummary(item, type, metadata, preview.instance)
        }
    var ratio by remember(cover) { mutableStateOf<Float?>(null) }
    var loading by remember(cover) { mutableStateOf(cover != null) }
    val viewport = LocalWindowInfo.current.containerDpSize.width
    val sideWidth = if (viewport <= 520.dp) 124.dp else if (viewport <= 900.dp) 170.dp else 210.dp
    val summaryGap = if (viewport <= 900.dp) 9.dp else 18.dp
    val titleSize = (viewport.value * .03f).coerceIn(20f, 28f).sp
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val height = catalogueCoverHeight(item.typeId, maxWidth.value, ratio).dp
        Box(
            Modifier.fillMaxWidth()
                .heightIn(min = height)
                .background(
                    Brush.linearGradient(
                        listOf(
                            WebPalette.Accent.copy(alpha = .22f).compositeOver(WebPalette.Surface),
                            WebPalette.Background,
                        )
                    )
                )
        ) {
            if (cover != null)
                AsyncImage(
                    cover,
                    null,
                    imageLoader = images,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.matchParentSize(),
                    onSuccess = { state ->
                        val image = state.result.image
                        ratio =
                            if (item.typeId in setOf(1L, 6L, 12L) && image.height > image.width) 1f
                            else image.width.toFloat() / image.height.coerceAtLeast(1)
                        loading = false
                    },
                    onError = { loading = false },
                )
            if (loading) ShareSkeletonBlock(Modifier.matchParentSize())
            if (
                item.typeId !in
                    setOf(
                        1L,
                        2L,
                        3L,
                        4L,
                        5L,
                        6L,
                        7L,
                        8L,
                        9L,
                        12L,
                        13L,
                        14L,
                        15L,
                        16L,
                        17L,
                        18L,
                        19L,
                    )
            )
                Box(
                    Modifier.matchParentSize()
                        .background(
                            Brush.verticalGradient(
                                listOf(
                                    WebPalette.Background.copy(alpha = .05f),
                                    WebPalette.Background.copy(alpha = .25f),
                                    WebPalette.Background.copy(alpha = .72f),
                                )
                            )
                        )
                )
            Column(
                Modifier.fillMaxWidth().heightIn(min = height).padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                if (back != null) ShareTextButton(back) { Text("Назад") }
                Row(
                    Modifier.fillMaxWidth().padding(end = headerInset.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.Top,
                ) {
                    Box(Modifier.weight(1f)) {
                        Column(
                            Modifier.background(
                                    WebPalette.Background.copy(alpha = .68f),
                                    RoundedCornerShape(9.dp),
                                )
                                .padding(horizontal = 10.dp, vertical = 7.dp)
                        ) {
                            Text(
                                item.name,
                                style =
                                    ShareTypography.section.copy(
                                        fontSize = titleSize,
                                        lineHeight = titleSize * 1.1f,
                                    ),
                                color = WebPalette.Text,
                            )
                            item.nameEn?.takeIf(String::isNotBlank)?.let { name ->
                                Text(
                                    name.replace('_', ' ').split(' ').joinToString(" ") {
                                        it.replaceFirstChar(Char::titlecase)
                                    },
                                    fontSize = 12.sp,
                                    color = WebPalette.TextSecondary,
                                )
                            }
                            if (item.userId != null)
                                Text(
                                    "✦ ваше",
                                    style = ShareTypography.context,
                                    color = WebPalette.AccentSoft,
                                )
                        }
                    }
                    item.contentSources.firstOrNull()?.let { source ->
                        Text(
                            source.code.ifBlank { source.name },
                            Modifier.background(
                                    WebPalette.Background.copy(alpha = .68f),
                                    RoundedCornerShape(5.dp),
                                )
                                .padding(6.dp),
                            style = ShareTypography.context,
                            color = WebPalette.Text,
                        )
                    }
                }
                if (summary.kind.isNotBlank())
                    Text(
                        summary.kind,
                        Modifier.background(
                                WebPalette.Background.copy(alpha = .7f),
                                RoundedCornerShape(9.dp),
                            )
                            .padding(10.dp),
                        color = WebPalette.Text,
                        style = ShareTypography.group,
                    )
                if (summary.left.isNotEmpty() || summary.right.isNotEmpty()) {
                    Row(
                        Modifier.fillMaxWidth()
                            .heightIn(min = if (viewport > 520.dp) 205.dp else 0.dp),
                        horizontalArrangement = Arrangement.spacedBy(summaryGap),
                    ) {
                        Column(
                            Modifier.width(sideWidth),
                            verticalArrangement = Arrangement.spacedBy(9.dp),
                        ) {
                            summary.left.forEach { ItemCoverStat(it) }
                        }
                        Spacer(Modifier.widthIn(min = 16.dp).weight(1f))
                        Column(
                            Modifier.width(sideWidth),
                            verticalArrangement = Arrangement.spacedBy(9.dp),
                        ) {
                            summary.right.forEach { ItemCoverStat(it) }
                        }
                    }
                } else Spacer(Modifier.weight(1f))
                Spacer(Modifier.weight(1f))
                if (summary.rail.isNotEmpty()) ItemCoverRail(summary.rail, viewport <= 520.dp)
                selectedEquipmentBases(item, preview.instance).forEach { (kind, id) ->
                    Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                        Text(
                            if (kind == "weapon") "Основа оружия" else "Основа доспеха",
                            style = ShareTypography.context,
                            color = WebPalette.Text,
                        )
                        EquipmentReference(id, metadata, open)
                    }
                }
            }
        }
    }
}
