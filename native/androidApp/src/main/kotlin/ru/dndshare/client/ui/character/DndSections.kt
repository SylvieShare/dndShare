package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import ru.dndshare.client.character.*
import ru.dndshare.client.ui.LayoutFormat
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun DndSheetSection(section: SheetSection, format: LayoutFormat) {
    when (section) {
        SheetSection.Base ->
            BoxWithConstraints(Modifier.fillMaxWidth()) {
                if (maxWidth >= DesignTokens.Layout.SheetBaseMin * 2 + DesignTokens.Spacing.Page) {
                    Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                        Column(
                            Modifier.weight(1f),
                            verticalArrangement = Arrangement.spacedBy(14.dp),
                        ) {
                            DndIdentityCard(compactHealth = format == LayoutFormat.Phone)
                            CharacterCampaignBadge()
                        }
                        Box(Modifier.weight(1f)) { DndUtilities() }
                    }
                } else
                    Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
                        DndIdentityCard(compactHealth = format == LayoutFormat.Phone)
                        CharacterCampaignBadge()
                        DndUtilities()
                    }
            }
        SheetSection.Stats -> DndStats()
        SheetSection.Weapons -> DndWeapons()
        SheetSection.Spells -> DndSpells()
        SheetSection.Inventory -> DndInventory()
        SheetSection.Abilities -> DndAbilities(format)
        SheetSection.Personality -> DndPersonality(format)
        SheetSection.Journal -> DndJournal()
        else -> Unit
    }
}

@Composable
internal fun DndWideSheet(
    section: SheetSection,
    sections: List<SheetSection>,
    select: (SheetSection) -> Unit,
    swipeEnabled: Boolean = true,
) {
    val context = LocalCharacterSheet.current
    val pager = rememberSheetPager(sections, section, select)
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val widths = wideSheetColumns(minOf(maxWidth, DesignTokens.Layout.SheetMax))
        Row(
            Modifier.widthIn(max = DesignTokens.Layout.SheetMax)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .align(androidx.compose.ui.Alignment.TopCenter),
            horizontalArrangement = Arrangement.spacedBy(15.dp),
        ) {
            Box(Modifier.width(widths.stats).padding(20.dp)) {
                DndStats(adaptive = false)
            }
            Column(
                Modifier.weight(1f).padding(top = 20.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                DndIdentityCard()
                CharacterCampaignBadge()
                SheetNavigation(
                    sections,
                    sections[pager.currentPage],
                    context.images,
                    select,
                    textOnly = true,
                )
                PreparedSheetPager(
                    pager,
                    sections,
                    Modifier.fillMaxWidth(),
                    enabled = swipeEnabled,
                    fillHeight = false,
                ) { page ->
                    Column(
                        Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        DndSheetSection(page, LayoutFormat.Wide)
                    }
                }
            }
            Column(
                Modifier.width(widths.utilities).padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(15.dp),
            ) {
                DndUtilities()
                DndFeatureSummary()
            }
        }
    }
}
