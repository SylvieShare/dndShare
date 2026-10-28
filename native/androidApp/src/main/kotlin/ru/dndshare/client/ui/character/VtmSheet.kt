package ru.dndshare.client.ui.character

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.text
import ru.dndshare.client.ui.LayoutFormat
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun VtmSheetSection(section: SheetSection, format: LayoutFormat) {
    val context = LocalCharacterSheet.current
    when (section) {
        SheetSection.Base -> {
            if (format == LayoutFormat.Wide)
                Row(horizontalArrangement = Arrangement.spacedBy(21.dp)) {
                    Column(
                        Modifier.width(DesignTokens.Layout.SheetStatsColumn),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        VtmIdentity(format)
                        CharacterCampaignBadge()
                    }
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                        VtmStats()
                        VtmAbilities()
                        VtmAdvantages()
                    }
                }
            else {
                VtmIdentity(format)
                CharacterCampaignBadge()
            }
        }
        SheetSection.Stats -> VtmStats()
        SheetSection.Abilities -> VtmAbilities()
        SheetSection.Advantages -> VtmAdvantages()
        SheetSection.Personality ->
            ShareTile(
                framed = false,
                onClick =
                    if (context.canEdit) ({ context.edit("vtm-text:clan_weakness:Слабость клана") })
                    else null,
            ) {
                Text("Слабость клана", style = ShareTypography.card)
                SheetDescription(context.sheet.values.text("clan_weakness"))
            }
        SheetSection.Journal ->
            ShareTile(
                framed = false,
                onClick =
                    if (context.canEdit) ({ context.edit("vtm-text:notes:Заметки") }) else null,
            ) {
                Text("Заметки", style = ShareTypography.card)
                SheetDescription(context.sheet.values.text("notes"))
            }
        else -> Unit
    }
}

@Composable
private fun VtmIdentity(format: LayoutFormat) {
    val context = LocalCharacterSheet.current
    val values = context.sheet.values
    ShareTile(framed = false) {
        Text(
            context.sheet.name,
            Modifier.clickable(enabled = context.canEdit) { context.edit("identity") },
            style = ShareTypography.header.copy(fontSize = 20.sp, lineHeight = 26.sp),
            color = androidx.compose.ui.graphics.Color(0xffc8a04a),
        )
        context.sheet.portrait?.let {
            AsyncImage(
                it,
                null,
                imageLoader = context.images,
                contentScale = androidx.compose.ui.layout.ContentScale.Crop,
                modifier =
                    Modifier.width(220.dp)
                        .height(if (format == LayoutFormat.Wide) 360.dp else 240.dp)
                        .clip(MaterialTheme.shapes.medium)
                        .clickable(enabled = context.canEdit) { context.edit("portrait") },
            )
        }
        listOf(
                "clan" to "Клан",
                "nature" to "Натура",
                "mask" to "Маска",
                "persona" to "Амплуа",
                "sire" to "Сир",
            )
            .forEach { (key, title) ->
                Row(
                    Modifier.fillMaxWidth().heightIn(min = 48.dp).clickable(
                        enabled = context.canEdit
                    ) {
                        context.edit("vtm-text:$key:$title")
                    }
                ) {
                    Text(
                        title,
                        Modifier.weight(1f),
                        style = ShareTypography.context,
                        color = WebPalette.TextMuted,
                    )
                    Text(values.text(key), style = ShareTypography.group)
                }
            }
    }
    ShareTile(framed = false) {
        Text(
            "ЗДОРОВЬЕ",
            Modifier.clickable(enabled = context.canEdit) { context.edit("vtm-health") },
            style = ShareTypography.group.copy(fontSize = 11.sp),
            color = WebPalette.TextMuted,
        )
        val damage = values["health"].arrayValue()
        listOf(
                "Царапина",
                "Травма",
                "Ранение",
                "Тяжёлое ранение",
                "Изуродован",
                "Искалечен",
                "Недееспособен",
            )
            .forEachIndexed { index, label ->
                val kind = (damage.getOrNull(index) as? JsonPrimitive)?.content.orEmpty()
                Row(
                    Modifier.fillMaxWidth().heightIn(min = 48.dp).clickable(
                        enabled = context.canEdit
                    ) {
                        context.edit("vtm-health")
                    }
                ) {
                    Text(label, Modifier.weight(1f), style = ShareTypography.group)
                    VtmDamageMark(kind)
                }
            }
        val blood = values["blood_pool"].objectValue()
        Text(
            "Запас крови: ${blood["current"].number()} / ${blood["max"].number(20)}",
            Modifier.heightIn(min = 48.dp).clickable(enabled = context.canEdit) {
                context.edit("vtm-blood")
            },
            style = ShareTypography.group,
        )
        TextButton(
            onClick = { context.edit("vtm:xp_total:Всего опыта") },
            enabled = context.canEdit,
        ) {
            Text("Опыт: ${values["xp_total"].number()}")
        }
        TextButton(
            onClick = { context.edit("vtm:xp_spent:Потрачено опыта") },
            enabled = context.canEdit,
        ) {
            Text("Потрачено: ${values["xp_spent"].number()}")
        }
    }
}

@Composable
private fun VtmStats() {
    ShareBalancedColumns {
        VtmPointGroup("Физические", vtmPhysical)
        VtmPointGroup("Социальные", vtmSocial)
        VtmPointGroup("Ментальные", vtmMental)
    }
}

@Composable
private fun VtmAbilities() {
    ShareBalancedColumns {
        VtmPointGroup("Таланты", vtmTalents)
        VtmPointGroup("Навыки", vtmSkills)
        VtmPointGroup("Знания", vtmKnowledge)
    }
}

@Composable
private fun VtmAdvantages() {
    val context = LocalCharacterSheet.current
    val values = context.sheet.values
    listOf("disciplines" to "Дисциплины", "backgrounds" to "Предыстории").forEach { (key, title) ->
        ShareTile(framed = false) {
            Text(
                title,
                Modifier.clickable(enabled = context.canEdit) { context.edit("vtm-list:$key") },
                style = ShareTypography.card,
            )
            values[key].arrayValue().forEach { raw ->
                val entry = raw.objectValue()
                VtmRatingRow(
                    entry.label(),
                    entry["value"].number(),
                    maxOf(5, entry["value"].number()),
                    context.canEdit,
                ) {
                    context.edit("vtm-list:$key")
                }
            }
        }
    }
    ShareTile(
        framed = false,
        onClick = if (context.canEdit) ({ context.edit("money") }) else null,
    ) {
        Text("Доллары", style = ShareTypography.card)
        Text(
            "$${values["money"].objectValue()["amounts"].objectValue()["1"].number()}",
            style = ShareTypography.group,
        )
    }
    VtmPointGroup(
        "Добродетели",
        listOf(
            "conscience" to "Совесть / Решимость",
            "self_control" to "Самоконтроль / Инстинкты",
            "courage" to "Смелость",
        ),
    )
    VtmPointGroup(
        "Человечность и сила воли",
        listOf(
            "humanity" to "Человечность",
            "willpower_perm" to "Постоянная",
            "willpower_temp" to "Временная",
        ),
        maximum = 10,
    )
}

@Composable
private fun VtmPointGroup(title: String, fields: List<Pair<String, String>>, maximum: Int = 5) {
    val context = LocalCharacterSheet.current
    ShareTile(framed = false) {
        Text(
            title.uppercase(),
            style = ShareTypography.group.copy(fontSize = 11.sp),
            color = WebPalette.TextMuted,
        )
        fields.forEach { (key, label) ->
            val value = context.sheet.values[key].number().coerceIn(0, maximum)
            VtmRatingRow(label, value, maximum, context.canEdit) {
                context.edit("vtm:$key:$label")
            }
        }
    }
}
