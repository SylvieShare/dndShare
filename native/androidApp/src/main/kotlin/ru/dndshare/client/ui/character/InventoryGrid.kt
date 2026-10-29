package ru.dndshare.client.ui.character

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.layout.*
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

private data class CellAddress(val space: String, val slot: Int)

private data class HeldInventory(
    val entry: JsonObject,
    val source: CellAddress,
    val grab: Offset,
    val size: Size,
)

@Composable
internal fun InventoryGrid(
    model: JsonObject,
    busy: Boolean,
    perform: (String, String, JsonObject) -> Unit,
    properties: (String) -> Unit,
    tool: (String) -> Unit,
    remove: (String) -> Unit,
    removeSpace: (String) -> Unit,
) {
    val context = LocalCharacterSheet.current
    val targets = remember { mutableMapOf<CellAddress, LayoutCoordinates>() }
    var root by remember { mutableStateOf<LayoutCoordinates?>(null) }
    var rootOrigin by remember { mutableStateOf(Offset.Zero) }
    var held by remember { mutableStateOf<HeldInventory?>(null) }
    var pointer by remember { mutableStateOf(Offset.Zero) }
    var target by remember { mutableStateOf<CellAddress?>(null) }
    var settling by remember { mutableStateOf(false) }
    var settleFrom by remember { mutableStateOf(Offset.Zero) }
    val progress = remember { Animatable(0f) }
    val scope = rememberCoroutineScope()
    val bring = remember { androidx.compose.foundation.relocation.BringIntoViewRequester() }
    val density = LocalDensity.current
    val edge = with(density) { 48.dp.toPx() }
    val haptics = LocalHapticFeedback.current
    fun hit(point: Offset): CellAddress? {
        val owner = root?.takeIf { it.isAttached } ?: return null
        if (!owner.boundsInWindow().contains(point)) return null
        return targets.entries
            .firstOrNull { (_, coordinates) ->
                coordinates.isAttached && coordinates.boundsInWindow().contains(point)
            }
            ?.key
    }
    LaunchedEffect(held?.entry?.text("uid"), settling) {
        if (held == null || settling) return@LaunchedEffect
        var scrolling: Job? = null
        try {
            while (isActive) {
                withFrameNanos {}
                target = hit(pointer)
                val owner = root?.takeIf { it.isAttached } ?: continue
                val visible = owner.boundsInWindow()
                val origin = owner.localToWindow(Offset.Zero)
                val bottom =
                    owner.localToWindow(
                        Offset(owner.size.width.toFloat(), owner.size.height.toFloat())
                    )
                val direction =
                    when {
                        pointer.y < visible.top + edge && origin.y < visible.top - 1 -> -1
                        pointer.y > visible.bottom - edge && bottom.y > visible.bottom + 1 -> 1
                        else -> 0
                    }
                if (direction != 0 && scrolling?.isActive != true) {
                    val local = owner.windowToLocal(pointer) + Offset(0f, direction * edge * 1.5f)
                    scrolling = launch { bring.bringIntoView(Rect(local, Size(1f, 1f))) }
                }
            }
        } finally {
            scrolling?.cancel()
        }
    }
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val columns = inventoryColumns(maxWidth.value)
        val sections = model["sections"].arrayValue().map { it.objectValue() }
        val cells = sections.associate { section ->
            section.text("id") to
                inventoryCells(
                    inventorySpaceEntries(model, section.text("id")),
                    section["slots"].objectValue(),
                    columns,
                )
        }
        Box(
            Modifier.fillMaxWidth()
                .bringIntoViewRequester(bring)
                .onGloballyPositioned {
                    root = it
                    rootOrigin = it.localToWindow(Offset.Zero)
                }
                .shareLongPressDrag(
                    context.canEdit && !busy && !settling,
                    onStart = { position ->
                        val owner = root?.takeIf { it.isAttached }
                        val point = owner?.localToWindow(position)
                        val address = point?.let(::hit)
                        val entry = address?.let { cells[it.space]?.getOrNull(it.slot) }
                        val coordinates = address?.let { targets[it] }?.takeIf { it.isAttached }
                        val bounds = coordinates?.let {
                            Rect(
                                it.localToWindow(Offset.Zero),
                                Size(it.size.width.toFloat(), it.size.height.toFloat()),
                            )
                        }
                        if (point == null || address == null || entry == null || bounds == null)
                            false
                        else {
                            held =
                                HeldInventory(entry, address, point - bounds.topLeft, bounds.size)
                            pointer = point
                            target = address
                            haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                            true
                        }
                    },
                    onMove = { position, _ ->
                        root
                            ?.takeIf { it.isAttached }
                            ?.let {
                                pointer = it.localToWindow(position)
                                target = hit(pointer)
                            }
                    },
                    onEnd = { cancelled ->
                        val from = held
                        if (cancelled || from == null) {
                            held = null
                            target = null
                        } else {
                            val destination = target ?: from.source
                            target = destination
                            settleFrom = pointer
                            settling = true
                            scope.launch(start = CoroutineStart.UNDISPATCHED) {
                                try {
                                    progress.snapTo(0f)
                                    if (destination != from.source)
                                        perform(
                                            from.entry.text("uid"),
                                            "inventory-cell",
                                            buildJsonObject {
                                                put("fromId", from.source.space)
                                                put("toId", destination.space)
                                                put("toSlot", destination.slot)
                                            },
                                        )
                                    progress.animateTo(1f, tween(DesignTokens.Motion.Navigation))
                                } finally {
                                    held = null
                                    target = null
                                    settling = false
                                }
                            }
                        }
                    },
                )
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(40.dp)) {
                for (section in sections) {
                    val id = section.text("id")
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        InventorySectionHeading(section, model, busy, removeSpace)
                        val entries = cells.getValue(id)
                        for (row in entries.indices.chunked(columns)) Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            for (index in row) key(id, index) {
                                val address = CellAddress(id, index)
                                val own = remember { arrayOfNulls<LayoutCoordinates>(1) }
                                DisposableEffect(address) {
                                    onDispose {
                                        if (targets[address] === own[0]) targets.remove(address)
                                    }
                                }
                                Box(
                                    Modifier.weight(1f).onGloballyPositioned {
                                        own[0] = it
                                        targets[address] = it
                                    }
                                ) {
                                    val entry = entries[index]
                                    val selected =
                                        entry != null &&
                                            model["equipped"].arrayValue().any {
                                                it.objectValue().text("uid") == entry.text("uid")
                                            }
                                    val actions =
                                        if (entry != null)
                                            inventoryCellActions(
                                                context,
                                                model,
                                                entry,
                                                id,
                                                busy || settling,
                                                perform,
                                                properties,
                                                tool,
                                                remove,
                                            )
                                        else if (context.canEdit)
                                            listOf(
                                                ShareMenuAction(
                                                    "Из справочника",
                                                    Glyph.Book,
                                                    {
                                                        context.edit(
                                                            "inventory:new|$id|$index|catalog"
                                                        )
                                                    },
                                                    !busy,
                                                ),
                                                ShareMenuAction(
                                                    "Своя вещь",
                                                    Glyph.Plus,
                                                    { context.edit("inventory:new|$id|$index") },
                                                    !busy,
                                                ),
                                            )
                                        else emptyList()
                                    val label =
                                        if (entry == null)
                                            "Свободная ячейка ${index+1}: ${section.text("name")}"
                                        else
                                            "Действия с предметом: ${inventoryEntryName(entry,context.items)}"
                                    val face: @Composable BoxScope.() -> Unit = {
                                        if (entry != null) {
                                            if (held?.entry?.text("uid") != entry.text("uid"))
                                                InventoryCellFace(entry, equipped = selected)
                                        } else
                                            AppGlyph(
                                                Glyph.Backpack,
                                                Modifier.size(42.dp),
                                                WebPalette.TextMuted.copy(alpha = .08f),
                                            )
                                    }
                                    if (actions.isNotEmpty())
                                        ShareActionMenu(
                                            label,
                                            actions,
                                            ownerKey = entry?.text("uid") ?: address,
                                            trigger = { modifier, open ->
                                                ShareCellSurface(
                                                    modifier
                                                        .testTag(
                                                            "sheet-entry:${entry?.text("uid") ?: "$id:$index"}"
                                                        )
                                                        .semantics {
                                                            testTagsAsResourceId = true
                                                            stateDescription =
                                                                if (selected) "Экипировано" else ""
                                                        },
                                                    selected = selected,
                                                    dropTarget = held != null && target == address,
                                                    onClick = open,
                                                    content = face,
                                                )
                                            },
                                        )
                                    else
                                        ShareCellSurface(
                                            selected = selected,
                                            dropTarget = held != null && target == address,
                                            content = face,
                                        )
                                }
                            }
                        }
                    }
                }
            }
            held?.let { current ->
                ShareCellSurface(
                    Modifier.requiredSize(
                            with(density) { current.size.width.toDp() },
                            with(density) { current.size.height.toDp() },
                        )
                        .zIndex(10f)
                        .graphicsLayer {
                            val end =
                                target
                                    ?.let { targets[it] }
                                    ?.takeIf { it.isAttached }
                                    ?.localToWindow(Offset.Zero)
                                    ?.plus(current.grab) ?: pointer
                            val drawn =
                                if (settling) settleFrom + (end - settleFrom) * progress.value
                                else pointer
                            translationX = drawn.x - current.grab.x - rootOrigin.x
                            translationY = drawn.y - current.grab.y - rootOrigin.y
                            shadowElevation = 8.dp.toPx()
                        }
                        .clearAndSetSemantics {},
                    selected =
                        model["equipped"].arrayValue().any {
                            it.objectValue().text("uid") == current.entry.text("uid")
                        },
                ) {
                    InventoryCellFace(
                        current.entry,
                        true,
                        model["equipped"].arrayValue().any {
                            it.objectValue().text("uid") == current.entry.text("uid")
                        },
                    )
                }
            }
        }
    }
}
