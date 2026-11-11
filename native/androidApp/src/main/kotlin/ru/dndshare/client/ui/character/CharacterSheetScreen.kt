package ru.dndshare.client.ui.character

import kotlin.math.roundToInt
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import coil3.ImageLoader
import ru.dndshare.client.character.*
import ru.dndshare.client.data.CacheDao
import ru.dndshare.client.model.text
import ru.dndshare.client.ui.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun CharacterSheetScreen(
    ui: CharacterSheetUiState,
    model: CharacterSheetViewModel,
    accountId: Long,
    cache: CacheDao,
    format: LayoutFormat,
    images: ImageLoader,
    active: Boolean,
    close: () -> Unit,
    backTitle: String = "Персонажи",
) {
    val editor = ui.editor?.takeIf { it.isDndStat() && ui.sheet?.userId == accountId && ui.mechanics != null }
    // The modal renders the live document. Keep the covered sheet at its opening state
    // so Room writes and acknowledgements don't recompose and blur every tab mid-animation.
    val backdrop = if (editor == null) ui else {
        val opening = remember(model, editor.fields.id) { ui }
        // Session notifications and navigation still follow the latest state.
        val background = ui.copy(snapshot = opening.snapshot, mechanics = opening.mechanics,
            content = opening.content, editor = opening.editor)
        remember(background) { background }
    }
    CharacterSheetBody(backdrop, model, accountId, cache, format, images, active, close, backTitle)
    if (editor != null) {
        SheetStatDialog(
            editor, requireNotNull(ui.mechanics), model::dismissEditor, model::number,
            model::input, model::formInput,
            syncError = ui.snapshot?.draft?.blocked,
            retry = model::retrySave,
        )
    }
}

@Composable
private fun CharacterSheetBody(
    ui: CharacterSheetUiState,
    model: CharacterSheetViewModel,
    accountId: Long,
    cache: CacheDao,
    format: LayoutFormat,
    images: ImageLoader,
    active: Boolean,
    close: () -> Unit,
    backTitle: String,
) {
    val sheet = rememberPresentedSheet(ui.snapshot)
    val navigation = ui.navigation
    val weaponOverlay = navigation.overlay?.takeIf { it.startsWith("weapon-roll:") }
    LaunchedEffect(weaponOverlay, sheet) {
        if (weaponOverlay != null && sheet != null) {
            val uid = weaponOverlay.substringAfter(':').substringBefore('|')
            val entry = sheet.values["weapon"].arrayValue().map { it.objectValue() }.firstOrNull { it.text("uid") == uid }
            if (sheet.userId != accountId || entry == null ||
                entry["params"].objectValue()["creation"].objectValue().text("expired") == "true") model.dismissOverlay()
        }
    }
    val sections = sheetSections(sheet?.templateName ?: "DND5", format)
    val section = sections.firstOrNull { it.name == navigation.sectionName } ?: sections.first()
    val wideDnd = format == LayoutFormat.Wide && sheet?.templateName == "DND5"
    val pager =
        if (sheet != null && !wideDnd) rememberSheetPager(sections, section, model::selectSection)
        else null
    val swipeEnabled =
        active && ui.editor == null && !ui.restoringEditor && navigation.overlay == null
    val canEdit = active && sheet?.userId == accountId
    LaunchedEffect(format, sheet?.templateName) { model.formatChanged(format) }
    BackHandler(enabled = active) {
        when {
            ui.editor != null -> model.dismissEditor()
            ui.restoringEditor -> Unit
            navigation.overlay != null -> model.dismissOverlay()
            navigation.itemStack.isNotEmpty() -> model.closeItem()
            else -> close()
        }
    }
    val mechanics = ui.mechanics
    val pageScrollStates = remember(model.uuid, format) { mutableStateMapOf<SheetSection, androidx.compose.foundation.ScrollState>() }
    val sheetContext = if (sheet != null && mechanics != null)
        model.sheetContext(ui, sheet, mechanics, images, canEdit) else null
    val dndContext = sheetContext?.takeIf { it.sheet.templateName == "DND5" }
    Box(
        Modifier.fillMaxSize()
            .sheetHistoryKeys(
                enabled =
                    canEdit &&
                        ui.editor == null &&
                        !ui.restoringEditor &&
                        navigation.overlay == null,
                canUndo = ui.snapshot?.draft?.undo?.isNotEmpty() == true,
                canRedo = ui.snapshot?.draft?.redo?.isNotEmpty() == true,
                history = model::history,
            )
    ) {
        ShareChromeLayout(
            modifier = Modifier.shareCanvas(),
            solidColor = WebPalette.Subheader,
            header = {
                PreparedSheetHeader(
                    sheet,
                    format,
                    sections,
                    pager,
                    section,
                    images,
                    model::selectSection,
                    close,
                    backTitle,
                    navigationInHeader = false,
                    heading = dndContext?.let { ctx -> { DndHeading(ctx) } },
                    actions = { SheetHeaderWidgets(ui, model, format, dndContext) },
                    menu =
                        if (sheet?.templateName == "VTM20") ({ model.edit("menu") })
                        else null,
                )
            },
            collapsibleRow = if (dndContext != null && hasHeaderStatuses(dndContext)) ({
                CompositionLocalProvider(LocalCharacterSheet provides dndContext) {
                    DndSummaryStrip()
                }
            }) else null,
            rowScrollOffset = { height ->
                if (pager == null || dndContext == null || height == 0) 0 else {
                    val position = (pager.currentPage + pager.currentPageOffsetFraction).coerceIn(0f, sections.lastIndex.toFloat())
                    val first = position.toInt()
                    fun offset(index: Int) = (pageScrollStates[sections[index]]?.value ?: 0).coerceAtMost(height)
                    val from = offset(first)
                    (from + (offset((first + 1).coerceAtMost(sections.lastIndex)) - from) * (position - first)).roundToInt()
                }
            },
            subheader = {
                Column {
                    if (sheet != null && pager != null && format != LayoutFormat.Wide)
                        ShareSubheader(
                            maxContentWidth = DesignTokens.Layout.SheetMax,
                            surfaceColor = Color.Transparent,
                            cornerRadius = 0.dp,
                            horizontalInset = DesignTokens.Spacing.Page,
                            contentPadding = PaddingValues(top = DesignTokens.Spacing.Xs),
                            shadowElevation = 0.dp,
                        ) {
                            PreparedSheetNavigation(
                                sections,
                                requireNotNull(pager),
                                images,
                                model::selectSection,
                                compact = format == LayoutFormat.Phone,
                                pill = true,
                                template = sheet.templateName,
                            )
                        }
                    SheetStatusPanels(sheet != null && !canEdit)
                }
            },
        ) { chromePadding ->
            Column(Modifier.fillMaxSize()) {
                when {
                    sheet == null && ui.loadError == null ->
                        Box(
                            Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center,
                        ) {
                            SheetPageSkeleton()
                        }
                    sheet != null && sheet.templateName !in listOf("DND5", "VTM20") ->
                        EmptyContent("Система пока не поддерживается", sheet.sourceName)
                    sheet != null ->
                        CompositionLocalProvider(
                            LocalCharacterSheet provides
                                requireNotNull(sheetContext),
                            ru.dndshare.client.ui.LocalRichInteractions provides
                                rememberSheetRichInteractions(
                                    sheet,
                                    requireNotNull(mechanics),
                                    ui.content.metadata,
                                    images,
                                    model.rolls::open,
                                ),
                        ) {
                            Box(Modifier.weight(1f).fillMaxWidth()) {
                                if (wideDnd)
                                    DndWideSheet(
                                        section,
                                        sections,
                                        model::selectSection,
                                        swipeEnabled,
                                    )
                                else
                                    PreparedSheetPager(
                                        requireNotNull(pager),
                                        sections,
                                        Modifier.fillMaxSize(),
                                        enabled = swipeEnabled,
                                        active = active,
                                    ) { page ->
                                        Box(
                                            Modifier.fillMaxSize(),
                                            contentAlignment = Alignment.TopCenter,
                                        ) {
                                            val pageScroll = rememberScrollState()
                                            DisposableEffect(pageScrollStates, page, pageScroll) {
                                                pageScrollStates[page] = pageScroll
                                                onDispose { pageScrollStates.remove(page) }
                                            }
                                            Column(
                                                Modifier.widthIn(
                                                        max =
                                                            DesignTokens.Layout.SheetMax
                                                    )
                                                    .fillMaxSize()
                                                    .verticalScroll(pageScroll)
                                                    .padding(
                                                        start =
                                                            DesignTokens.Spacing.Page,
                                                        end = DesignTokens.Spacing.Page,
                                                        top =
                                                            chromePadding
                                                                .calculateTopPadding() +
                                                                DesignTokens.Spacing
                                                                    .Page,
                                                        bottom =
                                                            chromePadding
                                                                .calculateBottomPadding() +
                                                                DesignTokens.Spacing
                                                                    .Page,
                                                    ),
                                                verticalArrangement =
                                                    Arrangement.spacedBy(16.dp),
                                            ) {
                                                CompositionLocalProvider(
                                                    LocalWeaponScroll provides
                                                        pageScroll
                                                ) {
                                                    if (sheet.templateName == "DND5")
                                                        DndSheetSection(page, format)
                                                    else VtmSheetSection(page, format)
                                                }
                                            }
                                        }
                                    }
                            }

                            ui.editor?.takeUnless { it.isDndStat() }
                                ?.let { editor ->
                                    if (isFeatureForm(editor.fields.target))
                                        FeatureEditor(
                                            editor,
                                            cache,
                                            model::dismissEditor,
                                            model::input,
                                            model::submitEditor,
                                            ui.campaign.players,
                                            model::formInput,
                                        )
                                    else
                                        CharacterSheetEditor(
                                            editor,
                                            cache,
                                            model::dismissEditor,
                                            model::number,
                                            model::inspiration,
                                            model::submitEditor,
                                            model::calculateHealth,
                                            model::input,
                                            model::formInput,
                                        )
                                }
                            navigation.overlay?.takeUnless { it.startsWith("weapon-roll:") }?.let { target ->
                                if (target.startsWith("spell-roll:")) {
                                    val key = target.substringAfter(':').substringBefore('|')
                                    SpellActionsDialog(
                                        key,
                                        ui.roll.busy,
                                        model::dismissOverlay,
                                        model.rolls.spellOptions(key),
                                        preferred = target.substringAfter('|', ""),
                                    ) { options ->
                                        model.dismissOverlay()
                                        model.rolls.spell(key, options)
                                    }
                                } else if (target.startsWith("campaign"))
                                    CharacterCampaignDialog(
                                        ui.remote,
                                        ui.campaign,
                                        model.campaign,
                                        model.remote::selectSession,
                                        model::dismissOverlay,
                                        model.remote::openCharacter,
                                        initialTab =
                                            if (target.endsWith(":events")) "events"
                                            else "players",
                                    )
                                else
                                    SheetInformationDialog(
                                        sheet,
                                        ui.remote,
                                        model.remote,
                                        model::dismissOverlay,
                                        close,
                                        model::refresh,
                                    )
                            }
                            if (navigation.itemStack.isNotEmpty())
                                run {
                                    val destination = navigation.itemStack.last()
                                    val source = destination.spellKey
                                    val readout =
                                        source?.takeIf(String::isNotBlank)?.let {
                                            runCatching {
                                                spellReadout(
                                                    sheet,
                                                    it,
                                                    ui.content.items,
                                                    ui.content.metadata,
                                                )
                                            }
                                                .getOrNull()
                                        }
                                    val base =
                                        ru.dndshare.client.ui.LocalRichInteractions
                                            .current
                                    val interactions =
                                        readout?.let {
                                            spellRichInteractions(
                                                base,
                                                it,
                                                model.rolls
                                                    .spellOptions(source.orEmpty())
                                                    ?.castLevel
                                                    ?: it.reference["cast_level"]
                                                        .number(
                                                            it.item.data["lvl"].number()
                                                        ),
                                            )
                                        } ?: base
                                    CompositionLocalProvider(
                                        ru.dndshare.client.ui
                                            .LocalRichInteractions provides interactions
                                    ) {
                                        ru.dndshare.client.ui.ItemPreviewDialog(
                                            cache,
                                            sheet.sourceId,
                                            destination.id,
                                            ui.content.metadata,
                                            images,
                                            close = model::closeItem,
                                            open = model::openItem,
                                            canGoBack = navigation.itemStack.size > 1,
                                            instance =
                                                destination.equipmentUid?.let { uid ->
                                                    sheet.values["weapon"]
                                                        .arrayValue()
                                                        .firstOrNull {
                                                            it.objectValue()
                                                                .text("uid") == uid
                                                        }
                                                        ?.objectValue()
                                                },
                                            knownItems = ui.content.items,
                                            initialItem =
                                                ui.content.items[destination.id],
                                        )
                                    }
                                }
                        }
                }
            }
        }
        if (active)
            SheetDiceNotifications(
                ui.roll,
                model.rolls::close,
                model.rolls::repeat,
                model.rolls::mode,
                model.rolls::reroll,
            )
        if (navigation.discardDialog)
            ShareAlertDialog(
                onDismissRequest = { model.confirmReload(false) },
                title = { Text("Загрузить серверную версию?") },
                text = { Text("Локальный черновик будет заменён текущим листом с сервера.") },
                confirmButton = {
                    ShareTextButton(onClick = model::reload) { Text("Загрузить") }
                },
                dismissButton = {
                    ShareTextButton(onClick = { model.confirmReload(false) }) { Text("Отмена") }
                },
            )
    }
}
