package ru.dndshare.client.ui.character

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.DialogProperties
import coil3.ImageLoader
import ru.dndshare.client.character.*
import ru.dndshare.client.data.CacheDao
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
    val sheet = rememberPresentedSheet(ui.snapshot)
    val navigation = ui.navigation
    val sections = sheetSections(sheet?.templateName ?: "DND5", format)
    val section = sections.firstOrNull { it.name == navigation.sectionName } ?: sections.first()
    val wideDnd = format == LayoutFormat.Wide && sheet?.templateName == "DND5"
    val pager =
        if (sheet != null && !wideDnd) rememberSheetPager(sections, section, model::selectSection)
        else null
    val swipeEnabled =
        active && ui.editor == null && !ui.restoringEditor && navigation.overlay == null
    val canEdit = active && sheet?.userId == accountId
    val morph = rememberShareMorphState()
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
    val mechanics =
        remember(sheet, ui.content.items, ui.content.metadata) {
            sheet?.let { DndDerivedValues(it, ui.content.items, ui.content.metadata) }
        }
    CompositionLocalProvider(LocalShareMorphState provides morph) {
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
            ShareMorphHost(
                morph,
                background = {
                    Column(Modifier.fillMaxSize().shareCanvas()) {
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
                            menu =
                                if (sheet?.templateName == "VTM20") ({ model.edit("menu") })
                                else null,
                        )
                        if (ui.snapshot?.draft?.edits?.isNotEmpty() == true) {
                            SheetSaveStatus(
                                ui.snapshot.draft.blocked ?: ui.saveMessage,
                                model::retrySave,
                                reload = { model.confirmReload(true) },
                            )
                        }
                        if (ui.commands.pending || ui.commands.message != null)
                            Surface(color = WebPalette.Raised) {
                                Row(
                                    Modifier.fillMaxWidth().padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Text(
                                        ui.commands.message ?: "Отправляем действие…",
                                        Modifier.weight(1f),
                                        style = ShareTypography.context,
                                    )
                                    if (!ui.commands.busy && ui.commands.pending)
                                        ShareTextButton(onClick = model::retryCommand) {
                                            Text("Повторить")
                                        }
                                }
                            }
                        ui.loadError?.let { message ->
                            Surface(color = WebPalette.Raised) {
                                Row(
                                    Modifier.fillMaxWidth().padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Text(
                                        message,
                                        Modifier.weight(1f),
                                        style = ShareTypography.context,
                                    )
                                    ShareTextButton(onClick = model::refresh) { Text("Повторить") }
                                }
                            }
                        }
                        when {
                            sheet == null && ui.loadError == null ->
                                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                    SheetPageSkeleton()
                                }
                            sheet != null && sheet.templateName !in listOf("DND5", "VTM20") ->
                                EmptyContent("Система пока не поддерживается", sheet.sourceName)
                            sheet != null ->
                                CompositionLocalProvider(
                                    LocalCharacterSheet provides
                                        SheetContext(
                                            sheet,
                                            ui.content.metadata,
                                            ui.content.items,
                                            images,
                                            canEdit,
                                            edit = {
                                                if (canEdit || it in listOf("menu", "rest"))
                                                    model.edit(it)
                                            },
                                            openItem = model::openItem,
                                            mechanics = requireNotNull(mechanics),
                                            journal = ui.journal,
                                            adjustResource = model::adjustResource,
                                            uuid = model.uuid,
                                            icons = ui.content.icons,
                                            canUndo =
                                                ui.snapshot?.draft?.undo?.isNotEmpty() == true,
                                            canRedo =
                                                ui.snapshot?.draft?.redo?.isNotEmpty() == true,
                                            history = model::history,
                                            deathSave = model.health::deathSave,
                                            reloadIcons = model::reloadInventoryIcons,
                                            sessionUuid = ui.remote.sessionUuid,
                                            sessionName =
                                                ui.remote.sessions
                                                    .firstOrNull {
                                                        it.uuid == ui.remote.sessionUuid
                                                    }
                                                    ?.name
                                                    .orEmpty(),
                                            concentration = ui.campaign.concentration,
                                            roll = model.rolls::open,
                                            itemMechanic = model.itemMechanics::perform,
                                            openSpell = model::openSpell,
                                            rollBusy = ui.roll.busy,
                                            rerollForUse = model.rolls::rerollForUse,
                                            reroll = model.rolls::reroll,
                                            resolvedItemIds = ui.content.resolvedIds,
                                            fetchingContent = ui.content.fetching,
                                            refreshContent = model::refreshContent,
                                        ),
                                    LocalSheetEditorPreview provides ui.editor,
                                    ru.dndshare.client.ui.LocalRichInteractions provides
                                        rememberSheetRichInteractions(
                                            sheet,
                                            requireNotNull(mechanics),
                                            ui.content.metadata,
                                            images,
                                            model.rolls::open,
                                        ),
                                ) {
                                    if (!canEdit)
                                        Text(
                                            "Режим просмотра",
                                            Modifier.padding(horizontal = 20.dp, vertical = 4.dp),
                                            style = ShareTypography.context,
                                            color = WebPalette.TextSecondary,
                                        )
                                    if (format == LayoutFormat.Phone)
                                        ShareSubheader {
                                            PreparedSheetNavigation(
                                                sections,
                                                requireNotNull(pager),
                                                images,
                                                model::selectSection,
                                                compact = true,
                                                pill = true,
                                                template = sheet.templateName,
                                            )
                                        }
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
                                                    Column(
                                                        Modifier.widthIn(
                                                                max = DesignTokens.Layout.SheetMax
                                                            )
                                                            .fillMaxSize()
                                                            .verticalScroll(rememberScrollState())
                                                            .padding(DesignTokens.Spacing.Page),
                                                        verticalArrangement =
                                                            Arrangement.spacedBy(16.dp),
                                                    ) {
                                                        if (sheet.templateName == "DND5")
                                                            DndSheetSection(page, format)
                                                        else VtmSheetSection(page, format)
                                                    }
                                                }
                                            }
                                    }

                                    ui.editor
                                        ?.takeUnless { it.isDndStat() }
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
                                    navigation.overlay?.let { target ->
                                        if (target.startsWith("weapon-roll:")) {
                                            val uid = target.substringAfter(':')
                                            WeaponActionsDialog(
                                                uid,
                                                ui.roll.busy,
                                                model::dismissOverlay,
                                                attack = { options ->
                                                    model.dismissOverlay()
                                                    model.rolls.attack(uid, options)
                                                },
                                                damage = { options ->
                                                    model.dismissOverlay()
                                                    model.rolls.damage(uid, options)
                                                },
                                            )
                                        } else if (target.startsWith("spell-roll:")) {
                                            val key = target.substringAfter(':')
                                            SpellActionsDialog(
                                                key,
                                                ui.roll.busy,
                                                model::dismissOverlay,
                                                model.rolls.spellOptions(key),
                                            ) { options ->
                                                model.dismissOverlay()
                                                model.rolls.spell(key, options)
                                            }
                                        } else if (target == "campaign")
                                            CharacterCampaignDialog(
                                                ui.remote,
                                                ui.campaign,
                                                model.campaign,
                                                model.remote::selectSession,
                                                model::dismissOverlay,
                                                model.remote::openCharacter,
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
                                        ShareFullscreenDialog(
                                            onDismissRequest = model::closeItem,
                                            properties =
                                                DialogProperties(usePlatformDefaultWidth = false),
                                        ) {
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
                                                ru.dndshare.client.ui.LocalRichInteractions.current
                                            val interactions =
                                                readout?.let {
                                                    spellRichInteractions(
                                                        base,
                                                        it,
                                                        model.rolls
                                                            .spellOptions(source.orEmpty())
                                                            ?.castLevel
                                                            ?: it.reference["cast_level"].number(
                                                                it.item.data["lvl"].number()
                                                            ),
                                                    )
                                                } ?: base
                                            CompositionLocalProvider(
                                                ru.dndshare.client.ui.LocalRichInteractions provides
                                                    interactions
                                            ) {
                                                ItemDetail(
                                                    cache,
                                                    sheet.sourceId,
                                                    destination.id,
                                                    ui.content.metadata,
                                                    images,
                                                    back = model::closeItem,
                                                    open = model::openItem,
                                                )
                                            }
                                        }
                                }
                        }
                    }
                },
            ) {
                SheetStatMorph(
                    morph,
                    ui.editor,
                    model::dismissEditor,
                    model::number,
                    model::submitEditor,
                    model::input,
                    model::formInput,
                    ui.content.items,
                    ui.content.metadata,
                )
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
}

@Composable
private fun SheetSaveStatus(message: String?, retry: () -> Unit, reload: () -> Unit) {
    Surface(color = WebPalette.Raised) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                message ?: "Сохраняем изменения…",
                Modifier.weight(1f),
                style = ShareTypography.context,
                color = if (message != null) WebPalette.Warning else WebPalette.TextSecondary,
            )
            if (message != null) {
                ShareTextButton(onClick = retry) { Text("Повторить") }
                ShareTextButton(onClick = reload) { Text("Версия сервера") }
            }
        }
    }
}
