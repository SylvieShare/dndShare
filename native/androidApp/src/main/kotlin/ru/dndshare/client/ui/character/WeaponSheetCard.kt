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
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.text
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun WeaponSheetCard(entry: JsonObject, weapon: WeaponReadout?) {
    val context = LocalCharacterSheet.current
    val uid = entry.text("uid")
    val item = weapon?.item ?: resolveWeapon(entry, context.items)
    val id = (entry["magic_item_id"] ?: entry["item_id"]).referenceId()
    val title =
        entry["override"].objectValue().text("name").ifBlank { item?.name ?: "Авторское оружие" }
    val expired =
        entry["params"].objectValue()["creation"].objectValue()["expired"] == JsonPrimitive(true)
    val creation = createdItemActions(entry)
    var properties by remember(uid) { mutableStateOf(false) }
    val actions = buildList {
        add(ShareMenuAction("Свойства", { properties = true }))
        addAll(creation)
        if (context.canEdit) {
            add(ShareMenuAction("Бросок оружием", { context.edit("weapon-roll:$uid") }, !expired))
            add(ShareMenuAction("Изменить", { context.edit("weapon:$uid") }))
            if (item?.data?.get("usable") is JsonObject)
                add(
                    ShareMenuAction(
                        "Использовать на себе",
                        { context.edit("item-use:weapon|$uid") },
                    )
                )
            if (context.sessionUuid != null)
                add(ShareMenuAction("Передать", { context.edit("transfer:weapon|$uid") }))
        }
        if (id != null) add(ShareMenuAction("Справочник", { context.openItem(id) }))
    }
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val inline = maxWidth >= 600.dp
        Column(Modifier.fillMaxWidth()) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp),
                horizontalArrangement = Arrangement.spacedBy(20.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                var visible by remember(uid) { mutableStateOf(false) }
                Box(
                    Modifier.size(56.dp)
                        .onGloballyPositioned { visible = !it.boundsInWindow().isEmpty }
                        .clip(RoundedCornerShape(12.dp))
                        .clickable { properties = true },
                    contentAlignment = Alignment.Center,
                ) {
                    if (item?.iconImageUrl != null && visible)
                        AsyncImage(
                            item.iconImageUrl,
                            null,
                            imageLoader = context.images,
                            modifier = Modifier.fillMaxSize(),
                        )
                    else AppGlyph(Glyph.Swords, Modifier.size(28.dp), WebPalette.TextMuted)
                }
                val heading: @Composable () -> Unit = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            title,
                            Modifier.weight(1f).clickable { properties = true },
                            style =
                                ShareTypography.group.copy(
                                    fontSize = 15.sp,
                                    lineHeight = 19.sp,
                                    fontWeight = FontWeight.Bold,
                                ),
                            maxLines = if (inline) 1 else 2,
                            overflow = TextOverflow.Ellipsis,
                        )
                        CompositionLocalProvider(
                            LocalMinimumInteractiveComponentSize provides 0.dp
                        ) {
                            ShareActionMenu(
                                "Действия с записью: $title",
                                actions,
                                ownerKey = uid,
                                trigger = { modifier, open ->
                                    IconButton(open, modifier.size(24.dp)) {
                                        AppGlyph(
                                            Glyph.More,
                                            Modifier.size(16.dp),
                                            WebPalette.TextMuted,
                                        )
                                    }
                                },
                            )
                        }
                    }
                    if (weapon != null) {
                        if (weapon.range.isNotBlank())
                            Text(
                                "дист. ${weapon.range} фт.",
                                style =
                                    ShareTypography.context.copy(
                                        fontSize = 11.sp,
                                        lineHeight = 14.sp,
                                    ),
                                color = WebPalette.TextMuted,
                            )
                        if (weapon.proficient)
                            Text(
                                "Владение",
                                style =
                                    ShareTypography.context.copy(
                                        fontSize = 11.sp,
                                        lineHeight = 13.sp,
                                        fontWeight = FontWeight.Bold,
                                    ),
                                color = WebPalette.Success,
                            )
                    }
                }
                if (inline) {
                    Column(Modifier.weight(1f)) { heading() }
                    if (weapon != null) {
                        WeaponAttackValue(title, weapon.attack, context.canEdit && !expired) {
                            context.edit("weapon-roll:$uid")
                        }
                        WeaponDamageFace(
                            title,
                            weapon.parts,
                            weapon.twoHanded,
                            weapon.damageBonus,
                            context.canEdit && !expired,
                        ) {
                            context.edit("weapon-roll:$uid")
                        }
                        WeaponPropertyPills(weapon.properties, Modifier.widthIn(max = 125.dp))
                    }
                } else
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Column { heading() }
                        if (weapon != null) {
                            WeaponAttackValue(title, weapon.attack, context.canEdit && !expired) {
                                context.edit("weapon-roll:$uid")
                            }
                            WeaponDamageFace(
                                title,
                                weapon.parts,
                                weapon.twoHanded,
                                weapon.damageBonus,
                                context.canEdit && !expired,
                            ) {
                                context.edit("weapon-roll:$uid")
                            }
                            WeaponPropertyPills(weapon.properties)
                        }
                    }
            }
            Column(
                Modifier.fillMaxWidth()
                    .padding(start = if (inline) 16.dp else 28.dp, end = 16.dp, bottom = 8.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                ItemMechanicsPanels(entry, compact = true)
            }
            HorizontalDivider(color = WebPalette.Border)
        }
    }
    if (properties)
        ShareFormDialog(title, { properties = false }) {
            val description =
                entry["override"].objectValue().text("desc").ifBlank {
                    entry.text("desc").ifBlank { item?.data?.text("desc").orEmpty() }
                }
            if (description.isNotBlank()) SheetDescription(description)
            ItemMechanicsPanels(entry)
            if (context.canEdit)
                ShareAction(
                    "Изменить",
                    {
                        properties = false
                        context.edit("weapon:$uid")
                    },
                )
        }
}

@Composable
internal fun WeaponAttackValue(title: String, bonus: Int, enabled: Boolean, roll: () -> Unit) {
    CompositionLocalProvider(LocalMinimumInteractiveComponentSize provides 0.dp) {
        Surface(
            roll,
            Modifier.semantics {
                contentDescription = "Атака: $title"
                stateDescription = signed(bonus)
            },
            enabled = enabled,
            color = WebPalette.Raised,
            shape = RoundedCornerShape(7.dp),
            border = BorderStroke(1.dp, WebPalette.AccentSoft.copy(alpha = .4f)),
        ) {
            Text(
                "АТАКА ${signed(bonus)}",
                Modifier.widthIn(min = 92.dp)
                    .heightIn(min = 28.dp)
                    .padding(horizontal = 10.dp, vertical = 5.dp),
                style =
                    ShareTypography.group.copy(
                        fontSize = 12.sp,
                        lineHeight = 16.sp,
                        fontWeight = FontWeight.Bold,
                    ),
                color = WebPalette.AccentSoft,
            )
        }
    }
}

@Composable
internal fun WeaponDamageFace(
    title: String,
    parts: List<WeaponDamagePart>,
    twoHanded: List<WeaponDamagePart>,
    bonus: Int,
    enabled: Boolean,
    roll: () -> Unit,
) {
    val type = parts.map { it.type }.filter(String::isNotBlank).distinct().joinToString(" / ")
    val color =
        parts.firstOrNull()?.color?.takeIf(String::isNotBlank)?.let {
            runCatching { Color(android.graphics.Color.parseColor(it)) }.getOrNull()
        } ?: WebPalette.Warning
    Column(
        Modifier.clickable(enabled = enabled, role = Role.Button, onClick = roll).semantics {
            contentDescription = "Урон: $title"
        },
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            parts.forEachIndexed { index, part ->
                if (index > 0) Text("+", color = color)
                if (part.sides != null) {
                    if (part.count > 1) Text("${part.count}×", color = color)
                    ShareDie(part.sides, part.sides.toString(), color, size = 38.dp)
                } else Text(part.count.toString(), color = color, style = ShareTypography.group)
            }
            if (twoHanded.isNotEmpty()) {
                Text("/", color = WebPalette.TextMuted)
                twoHanded.forEachIndexed { index, part ->
                    if (index > 0) Text("+", color = color)
                    if (part.sides != null) {
                        if (part.count > 1) Text("${part.count}×", color = color)
                        ShareDie(part.sides, part.sides.toString(), color, size = 38.dp)
                    } else Text(part.count.toString(), color = color)
                }
            }
            if (bonus != 0) Text(signed(bonus), color = color, style = ShareTypography.group)
            if (parts.isEmpty() && bonus == 0)
                Text("0", color = color, style = ShareTypography.group)
        }
        if (type.isNotBlank())
            Text(
                type,
                style =
                    ShareTypography.context.copy(
                        fontSize = 11.sp,
                        lineHeight = 13.sp,
                        fontWeight = FontWeight.Bold,
                    ),
                color = color,
            )
    }
}

@Composable
private fun WeaponPropertyPills(properties: List<String>, modifier: Modifier = Modifier) {
    val context = LocalCharacterSheet.current
    var shown by remember { mutableStateOf<Pair<String, String>?>(null) }
    FlowRow(
        modifier,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        properties.forEach { label ->
            val description =
                context.metadata.suggests["14"]
                    .orEmpty()
                    .firstOrNull { it.value == label }
                    ?.desc
                    .orEmpty()
            Text(
                label,
                Modifier.background(WebPalette.Raised, RoundedCornerShape(6.dp))
                    .then(
                        if (description.isNotBlank())
                            Modifier.clickable { shown = label to description }
                        else Modifier
                    )
                    .padding(horizontal = 7.dp, vertical = 5.dp),
                style = ShareTypography.context,
                color = WebPalette.TextMuted,
            )
        }
    }
    shown?.let { (label, description) ->
        ShareFormDialog(label, { shown = null }) { SheetDescription(description) }
    }
}
