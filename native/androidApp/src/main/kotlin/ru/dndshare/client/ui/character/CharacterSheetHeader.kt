package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.ImageLoader
import coil3.compose.AsyncImage
import ru.dndshare.client.character.CharacterSheet
import ru.dndshare.client.character.subtitle
import ru.dndshare.client.ui.LayoutFormat
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun CharacterSheetHeader(
    sheet: CharacterSheet?,
    format: LayoutFormat,
    sections: List<SheetSection>,
    section: SheetSection,
    images: ImageLoader,
    select: (SheetSection) -> Unit,
    close: () -> Unit,
    backTitle: String = "Персонажи",
    menu: (() -> Unit)? = null,
    navigationInHeader: Boolean = true,
    actions: (@Composable () -> Unit)? = null,
) {
    ShareWorkspaceHeader(
        contentInset = if (format == LayoutFormat.Phone) 8.dp else 14.dp,
        maxContentWidth = DesignTokens.Layout.SheetMax,
        compact = format != LayoutFormat.Wide,
        actions = actions,
        navigation =
            if (navigationInHeader && format == LayoutFormat.Tablet)
                ({
                    SheetNavigation(
                        sections,
                        section,
                        images,
                        select,
                        template = sheet?.templateName.orEmpty(),
                        pill = true,
                    )
                })
            else null,
    ) {
        if (format == LayoutFormat.Wide && sheet?.templateName == "VTM20") {
            Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.weight(1f)) { SheetIdentity(sheet, format, close, backTitle, menu) }
                SheetNavigation(sections, section, images, select, template = "VTM20")
                Spacer(Modifier.weight(1f))
            }
        } else {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                SheetIdentity(sheet, format, close, backTitle, menu)
            }
        }
    }
}

@Composable
private fun SheetIdentity(
    sheet: CharacterSheet?,
    format: LayoutFormat,
    close: () -> Unit,
    backTitle: String,
    menu: (() -> Unit)?,
) {
    Row(
        Modifier.fillMaxWidth().heightIn(min = if (format == LayoutFormat.Tablet) 56.dp else 48.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement =
            Arrangement.spacedBy(if (format == LayoutFormat.Phone) 8.dp else 14.dp),
    ) {
        ShareTextButton(
            onClick = close,
            colors = ButtonDefaults.textButtonColors(contentColor = WebPalette.TextSecondary),
            modifier =
                Modifier.then(if (format == LayoutFormat.Phone) Modifier.width(48.dp) else Modifier)
                    .semantics {
                        contentDescription =
                            if (backTitle == "Персонажи") "К списку персонажей"
                            else "К предыдущему персонажу"
                    },
        ) {
            AppGlyph(Glyph.Back, Modifier.size(18.dp))
            if (format != LayoutFormat.Phone) {
                Spacer(Modifier.width(8.dp))
                Text(backTitle)
            }
        }
        if (format == LayoutFormat.Wide) VerticalDivider(Modifier.height(32.dp))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(
                sheet?.name ?: "Лист персонажа",
                style = ShareTypography.header,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            sheet
                ?.subtitle()
                ?.takeIf { it.isNotBlank() }
                ?.let {
                    Text(
                        it,
                        style = ShareTypography.context,
                        color = WebPalette.TextMuted,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
        }
        if (menu != null)
            IconButton(
                onClick = menu,
                modifier = Modifier.semantics { contentDescription = "Меню персонажа" },
            ) {
                AppGlyph(Glyph.Settings, Modifier.size(20.dp), WebPalette.TextMuted)
            }
    }
}

@Composable
internal fun SheetNavigation(
    sections: List<SheetSection>,
    section: SheetSection,
    images: ImageLoader,
    select: (SheetSection) -> Unit,
    compact: Boolean = false,
    template: String = "DND5",
    textOnly: Boolean = false,
    pill: Boolean = false,
) {
    fun title(entry: SheetSection) =
        when {
            template == "VTM20" && entry == SheetSection.Journal -> "Заметки"
            template == "VTM20" && entry == SheetSection.Stats -> "Характеристики"
            textOnly && entry == SheetSection.Inventory -> "Снаряжение"
            else -> entry.title
        }
    if (textOnly) {
        val index = sections.indexOf(section).coerceAtLeast(0)
        ScrollableTabRow(
            index,
            containerColor = Color.Transparent,
            contentColor = WebPalette.Text,
            edgePadding = 0.dp,
            divider = {},
            indicator = { positions ->
                TabRowDefaults.SecondaryIndicator(
                    Modifier.tabIndicatorOffset(positions[index]),
                    color = WebPalette.Accent,
                )
            },
        ) {
            sections.forEach { entry ->
                Tab(
                    entry == section,
                    onClick = { select(entry) },
                    text = { Text(title(entry), fontSize = 13.sp) },
                    modifier = Modifier.clip(RoundedCornerShape(DesignTokens.Radius.Input)),
                )
            }
        }
        return
    }
    ShareIconNavigation(
        sections.map { ShareNavigationItem(it.name, title(it)) },
        section.name,
        onSelect = { key -> select(sections.first { it.name == key }) },
        compact = compact,
        pill = pill,
    ) { key ->
        val entry = sections.first { it.name == key }
        AsyncImage(
            "file:///android_asset/character-sheet/${entry.asset}",
            null,
            imageLoader = images,
            colorFilter =
                ColorFilter.tint(
                    if (entry == section) if (pill) WebPalette.AccentSoft else WebPalette.Text
                    else WebPalette.TextMuted
                ),
            modifier = Modifier.size(if (compact) 22.dp else 24.dp),
        )
    }
}
