package ru.dndshare.client.ui.character

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.text
import ru.dndshare.client.ui.LayoutFormat
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun WeaponSheetCard(
    entry: JsonObject,
    weapon: WeaponReadout?,
    format: LayoutFormat = LayoutFormat.Wide,
    modifier: Modifier = Modifier,
    dragging: Boolean = false,
) {
    val context = LocalCharacterSheet.current
    val uid = entry.text("uid")
    val item = weapon?.item ?: resolveWeapon(entry, context.items)
    val id = (entry["magic_item_id"] ?: entry["item_id"]).referenceId()
    val title =
        entry["override"].objectValue().text("name").ifBlank { item?.name ?: "Авторское оружие" }
    val expired =
        entry["params"].objectValue()["creation"].objectValue()["expired"] == JsonPrimitive(true)
    val descriptions =
        remember(context.metadata, item) {
            context.metadata.suggests["14"].orEmpty().associate { it.value to it.desc.orEmpty() } +
                item
                    ?.data
                    ?.get("tags")
                    .arrayValue()
                    .filterIsInstance<JsonObject>()
                    .associate {
                        it.text("value").ifBlank { it.text("label").ifBlank { it.text("name") } } to
                            it.text("desc")
                    }
                    .filterValues(String::isNotBlank)
        }
    var deleting by remember(uid) { mutableStateOf(false) }
    val actions = buildList {
        addAll(createdItemActions(entry))
        if (context.canEdit) {
            add(
                ShareMenuAction(
                    "Бросок оружием",
                    Glyph.Dice,
                    { context.edit("weapon-roll:$uid") },
                    !expired,
                )
            )
            add(ShareMenuAction("Изменить", Glyph.Edit, { context.edit("weapon:$uid") }))
            if (item?.data?.get("usable") is JsonObject && !expired)
                add(
                    ShareMenuAction(
                        "Использовать на себе",
                        Glyph.Account,
                        { context.edit("item-use:weapon|$uid") },
                    )
                )
            if (context.sessionUuid != null)
                add(
                    ShareMenuAction(
                        "Передать",
                        Glyph.Transfer,
                        { context.edit("transfer:weapon|$uid") },
                    )
                )
        }
        if (id != null)
            add(ShareMenuAction("Справочник", Glyph.Book, { context.openEquipment(id, uid) }))
        if (context.canEdit)
            add(ShareMenuAction("Удалить", Glyph.Trash, { deleting = true }, danger = true))
    }
    ShareActionMenu(
        "Действия с записью: $title",
        actions,
        ownerKey = uid,
        trigger = { semantics, open, expanded ->
            Column(
                modifier
                    .then(semantics)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(
                        if (expanded)
                            WebPalette.Accent.copy(alpha = .08f).compositeOver(WebPalette.Surface)
                        else if (dragging) WebPalette.Raised else Color.Transparent
                    )
                    .clickable(enabled = !dragging, role = Role.Button, onClick = open)
            ) {
                BoxWithConstraints(
                    Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp)
                ) {
                    val compact = format != LayoutFormat.Wide || maxWidth < 600.dp
                    val icon: @Composable () -> Unit = {
                        Box(Modifier.size(64.dp), contentAlignment = Alignment.Center) {
                            val model: Any? =
                                item?.iconImageUrl
                                    ?: item?.svg?.let { remember(it) { it.toByteArray() } }
                                    ?: context.metadata.types
                                        .firstOrNull { it.id == item?.typeId }
                                        ?.iconImageUrl
                            if (model != null)
                                AsyncImage(
                                    model,
                                    null,
                                    imageLoader = context.images,
                                    modifier = Modifier.fillMaxSize(),
                                )
                            else AppGlyph(Glyph.Swords, Modifier.size(28.dp), WebPalette.TextMuted)
                        }
                    }
                    val heading: @Composable () -> Unit = {
                        Column(
                            Modifier.fillMaxWidth(),
                            verticalArrangement = Arrangement.spacedBy(1.dp),
                        ) {
                            Text(
                                title,
                                style =
                                    ShareTypography.group.copy(
                                        fontSize = if (compact) 15.sp else 14.sp,
                                        lineHeight = 19.sp,
                                        fontWeight = FontWeight.SemiBold,
                                    ),
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis,
                            )
                            weapon?.range?.takeIf(String::isNotBlank)?.let {
                                Text(
                                    "дист. $it фт.",
                                    style =
                                        ShareTypography.context.copy(
                                            fontSize = 11.sp,
                                            lineHeight = 14.sp,
                                        ),
                                    color = WebPalette.TextMuted,
                                )
                            }
                            if (
                                item?.typeId == 19L &&
                                    item.data.text("attunement") !in listOf("", "none")
                            )
                                Text(
                                    if (
                                        entry["params"]
                                            .objectValue()["magic"]
                                            .objectValue()["attuned"] == JsonPrimitive(true)
                                    )
                                        "Настроено"
                                    else "Не настроено",
                                    style = ShareTypography.context,
                                    color = WebPalette.TextMuted,
                                )
                            if (weapon?.proficient == true)
                                Text(
                                    "Владение",
                                    style =
                                        ShareTypography.context.copy(
                                            fontSize = 10.sp,
                                            lineHeight = 13.sp,
                                            fontWeight = FontWeight.Bold,
                                        ),
                                    color = WebPalette.Success,
                                )
                        }
                    }
                    if (compact)
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                            ) {
                                icon()
                                Box(Modifier.weight(1f)) { heading() }
                            }
                            if (weapon != null)
                                WeaponMetricsTable(
                                    title,
                                    weapon,
                                    propertyDescriptions = descriptions,
                                    openItem = context.openItem,
                                )
                        }
                    else
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            icon()
                            Box(Modifier.weight(.9f)) { heading() }
                            if (weapon != null)
                                WeaponMetricsTable(
                                    title,
                                    weapon,
                                    Modifier.weight(2.5f),
                                    descriptions,
                                    context.openItem,
                                )
                        }
                }
                CompositionLocalProvider(
                    LocalDisclosureSheets provides (format != LayoutFormat.Wide)
                ) {
                    Column(
                        Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, bottom = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        ItemMechanicsPanels(entry, compact = true)
                    }
                }
                HorizontalDivider(color = WebPalette.Border)
            }
        },
    )
    if (deleting) WeaponDeleteDialog(entry, title) { deleting = false }
}
