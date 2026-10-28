package ru.dndshare.client.ui.character

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import ru.dndshare.client.model.text
import ru.dndshare.client.ui.LayoutFormat
import ru.dndshare.client.ui.designsystem.*

private val appearanceFields =
    listOf(
        "person_height",
        "person_weight",
        "person_age",
        "person_eyes",
        "person_skin",
        "person_hair",
    )
private val characterFields =
    listOf("person_traits", "person_ideals", "person_bonds", "person_flaws")

@Composable
internal fun DndPersonality(format: LayoutFormat) {
    val wide = format == LayoutFormat.Wide
    if (wide)
        Column(verticalArrangement = Arrangement.spacedBy(22.dp)) {
            ShareTile(framed = false, contentPadding = PaddingValues(18.dp)) {
                PersonalityFieldGrid(listOf("person_origin", "person_alignment"), 2)
            }
            ShareTile(framed = false, contentPadding = PaddingValues(18.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(25.dp)) {
                    PersonalityPortrait(Modifier.width(200.dp).height(260.dp))
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(17.dp)) {
                        PersonalityField("person_appearance")
                        PersonalityFieldGrid(appearanceFields, 3)
                    }
                }
            }
            ShareTile(framed = false, contentPadding = PaddingValues(18.dp)) {
                PersonalityFieldGrid(characterFields, 2)
            }
            ShareTile(framed = false, contentPadding = PaddingValues(18.dp)) {
                PersonalityField("person_backstory")
                PersonalityField("person_allies")
            }
        }
    else
        ShareBalancedColumns(
            minimumWidth = 300.dp,
            maxColumns = if (format == LayoutFormat.Phone) 1 else 2,
            gap = 17.dp,
        ) {
            PersonalityGroup("Основное") {
                PersonalityField("person_origin")
                PersonalityField("person_alignment")
                PersonalityField("person_appearance")
            }
            PersonalityGroup("Облик") { PersonalityFieldGrid(appearanceFields, 2) }
            PersonalityGroup("Характер") { characterFields.forEach { PersonalityField(it) } }
            PersonalityGroup("История") {
                PersonalityField("person_backstory")
                PersonalityField("person_allies")
            }
        }
}

@Composable
private fun PersonalityGroup(title: String, content: @Composable ColumnScope.() -> Unit) {
    ShareTile(framed = false, contentPadding = PaddingValues(14.dp)) {
        Text(
            title.uppercase(),
            style = ShareTypography.group.copy(fontSize = 11.sp, fontWeight = FontWeight.Bold),
            color = WebPalette.TextMuted,
        )
        HorizontalDivider()
        Column(verticalArrangement = Arrangement.spacedBy(12.dp), content = content)
    }
}

@Composable
private fun PersonalityFieldGrid(fields: List<String>, columns: Int) {
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        for (row in fields.chunked(columns)) Row(
            horizontalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            for (key in row) Box(Modifier.weight(1f)) { PersonalityField(key) }
            repeat(columns - row.size) { Spacer(Modifier.weight(1f)) }
        }
    }
}

@Composable
private fun PersonalityField(key: String) {
    val context = LocalCharacterSheet.current
    val label = personalityFields.getValue(key)
    val value = context.sheet.values.text(key)
    val short = key in appearanceFields || key == "person_origin" || key == "person_alignment"
    val caption =
        ShareTypography.group.copy(
            fontSize = 11.sp,
            lineHeight = 15.sp,
            fontWeight = FontWeight.Bold,
        )
    if (short) {
        Column {
            Row(
                Modifier.fillMaxWidth()
                    .heightIn(min = 40.dp)
                    .clickable(enabled = context.canEdit) { context.edit("personality:$key") }
                    .semantics { contentDescription = "Изменить: $label" },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(label, style = caption, color = WebPalette.TextMuted)
                Text(
                    value.ifBlank { label },
                    Modifier.weight(1f),
                    style =
                        ShareTypography.header.copy(
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Normal,
                        ),
                    color = if (value.isBlank()) WebPalette.TextMuted else WebPalette.Text,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                if (context.canEdit)
                    AppGlyph(Glyph.Edit, Modifier.size(12.dp), WebPalette.TextMuted)
            }
            HorizontalDivider()
        }
    } else {
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    label.uppercase(),
                    Modifier.weight(1f),
                    style = caption,
                    color = WebPalette.TextMuted,
                )
                if (context.canEdit)
                    IconButton(
                        onClick = { context.edit("personality:$key") },
                        modifier =
                            Modifier.size(24.dp).semantics {
                                contentDescription = "Изменить: $label"
                            },
                    ) {
                        AppGlyph(Glyph.Edit, Modifier.size(12.dp), WebPalette.TextMuted)
                    }
            }
            if (value.isNotBlank()) SheetDescription(value)
            else
                Text(
                    if (key == "person_appearance") "Описание внешности…" else "$label…",
                    style = ShareTypography.context,
                    color = WebPalette.TextMuted,
                )
        }
    }
}

@Composable
private fun PersonalityPortrait(modifier: Modifier) {
    val context = LocalCharacterSheet.current
    ShareTile(
        modifier,
        framed = false,
        contentPadding = PaddingValues(0.dp),
        onClick = if (context.canEdit) ({ context.edit("portrait") }) else null,
    ) {
        if (context.sheet.portrait != null)
            AsyncImage(
                context.sheet.portrait,
                "Портрет персонажа",
                imageLoader = context.images,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        else
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(context.sheet.name.take(1), style = ShareTypography.title)
            }
    }
}
