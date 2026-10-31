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
) {
    val cover =
        item.coverImageUrl?.takeIf(String::isNotBlank)
            ?: type?.coverImageUrl?.takeIf(String::isNotBlank)
    val summary = remember(item, type, metadata) { catalogueSummary(item, type, metadata) }
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
                                .border(
                                    1.dp,
                                    WebPalette.Text.copy(alpha = .14f),
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
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(summaryGap),
                    ) {
                        Column(
                            Modifier.width(sideWidth),
                            verticalArrangement = Arrangement.spacedBy(9.dp),
                        ) {
                            summary.left.forEach { CoverStat(it) }
                        }
                        Spacer(Modifier.widthIn(min = 16.dp).weight(1f))
                        Column(
                            Modifier.width(sideWidth),
                            verticalArrangement = Arrangement.spacedBy(9.dp),
                        ) {
                            summary.right.forEach { CoverStat(it) }
                        }
                    }
                } else Spacer(Modifier.weight(1f))
                if (summary.rail.isNotEmpty())
                    Row(
                        Modifier.fillMaxWidth()
                            .background(
                                WebPalette.Surface.copy(alpha = .74f),
                                RoundedCornerShape(10.dp),
                            )
                            .border(
                                1.dp,
                                WebPalette.Text.copy(alpha = .18f),
                                RoundedCornerShape(10.dp),
                            )
                            .padding(12.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        summary.rail.forEach { stat ->
                            Column(
                                Modifier.weight(1f),
                                verticalArrangement = Arrangement.spacedBy(4.dp),
                            ) {
                                Text(
                                    stat.label,
                                    fontSize = 9.sp,
                                    lineHeight = 11.sp,
                                    color = WebPalette.TextSecondary,
                                )
                                Text(
                                    stat.value,
                                    fontSize = 12.sp,
                                    lineHeight = 16.sp,
                                    color = WebPalette.Text,
                                )
                            }
                        }
                    }
            }
        }
    }
}

@Composable
private fun CoverStat(stat: CoverValue, modifier: Modifier = Modifier, compact: Boolean = false) {
    val glyph =
        when (stat.label) {
            "Урон",
            "Двумя руками" -> Glyph.Swords
            "Категория" -> Glyph.Badge
            "Дистанция" -> Glyph.Target
            "Стоимость" -> Glyph.Coins
            "Вес" -> Glyph.Weight
            "Время" -> Glyph.Clock
            "Длительность" -> Glyph.Hourglass
            "Компоненты" -> Glyph.Shapes
            "Редкость" -> Glyph.Gem
            "Зарядов" -> Glyph.Zap
            "Хиты" -> Glyph.Heart
            "Класс доспеха",
            "КД" -> Glyph.Shield
            else -> Glyph.Book
        }
    val tone =
        when (stat.label) {
            "Урон" -> WebPalette.Danger
            "Стоимость" -> WebPalette.Warning
            "Редкость" -> WebPalette.AccentSoft
            else -> WebPalette.Text
        }
    val large =
        !compact &&
            stat.label in
                setOf(
                    "Урон",
                    "Двумя руками",
                    "Магический бонус",
                    "Хиты",
                    "Класс доспеха",
                    "КД",
                    "Вес",
                ) &&
            stat.value.length < 12
    Row(
        modifier
            .fillMaxWidth()
            .background(WebPalette.Surface.copy(alpha = .74f), RoundedCornerShape(10.dp))
            .border(
                1.dp,
                tone.copy(alpha = if (tone == WebPalette.Text) .18f else .44f),
                RoundedCornerShape(10.dp),
            )
            .padding(horizontal = 12.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                stat.label.uppercase(),
                style =
                    ShareTypography.context.copy(
                        fontSize = 9.sp,
                        lineHeight = 11.sp,
                        fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
                    ),
                color = tone,
            )
            Text(
                stat.value,
                style =
                    ShareTypography.group.copy(
                        fontSize = if (large) 27.sp else 17.sp,
                        lineHeight = if (large) 29.sp else 20.sp,
                    ),
                color = WebPalette.Text,
            )
            if (stat.note.isNotBlank())
                Text(
                    stat.note,
                    fontSize = 10.sp,
                    lineHeight = 13.sp,
                    color = WebPalette.TextSecondary,
                )
        }
        AppGlyph(glyph, Modifier.size(27.dp), tone.copy(alpha = .72f))
    }
}
