package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.clickable
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.tween
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import ru.dndshare.client.character.*
import ru.dndshare.client.model.text
import ru.dndshare.client.ui.LayoutFormat
import ru.dndshare.designsystem.*

@Composable
internal fun DndSheetSection(section: SheetSection, format: LayoutFormat) {
    when (section) {
        SheetSection.Base -> BoxWithConstraints(Modifier.fillMaxWidth()) {
            if (maxWidth >= DesignTokens.Layout.SheetBaseMin * 2 + DesignTokens.Spacing.Page) {
                Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                    Box(Modifier.weight(1f)) { DndIdentityCard() }
                    Box(Modifier.weight(1f)) { DndUtilities() }
                }
            } else Column(verticalArrangement = Arrangement.spacedBy(20.dp)) { DndIdentityCard(); DndUtilities() }
        }
        SheetSection.Stats -> DndStats()
        SheetSection.Weapons -> DndWeapons()
        SheetSection.Spells -> DndSpells()
        SheetSection.Inventory -> DndInventory()
        SheetSection.Abilities -> DndAbilities(format)
        SheetSection.Personality -> DndPersonality()
        SheetSection.Journal -> DndJournal()
        else -> Unit
    }
}

@Composable
internal fun DndWideSheet(section: SheetSection, sections: List<SheetSection>, select: (SheetSection) -> Unit, swipeEnabled: Boolean = true) {
    val context = LocalCharacterSheet.current
    val pager = rememberSheetPager(sections, section, select)
    Box(Modifier.fillMaxSize()) {
        Row(Modifier.widthIn(max = DesignTokens.Layout.SheetMax).fillMaxWidth().verticalScroll(rememberScrollState())
            .align(androidx.compose.ui.Alignment.TopCenter), horizontalArrangement = Arrangement.spacedBy(15.dp)) {
            Box(Modifier.width(DesignTokens.Layout.SheetStatsColumn).padding(20.dp)) { DndStats(adaptive = false) }
            Column(Modifier.weight(1f).padding(top = 20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                DndIdentityCard()
                SheetNavigation(sections, sections[pager.currentPage], context.images, select, textOnly = true)
                HorizontalPager(pager, Modifier.fillMaxWidth().animateContentSize(tween(DesignTokens.Motion.Navigation)),
                    beyondViewportPageCount = 0, key = { sections[it].name }, userScrollEnabled = swipeEnabled,
                    verticalAlignment = androidx.compose.ui.Alignment.Top) { page ->
                    Column(Modifier.fillMaxWidth()) { DndSheetSection(sections[page], LayoutFormat.Wide) }
                }
            }
            Column(Modifier.width(DesignTokens.Layout.SheetUtilitiesColumn).padding(20.dp), verticalArrangement = Arrangement.spacedBy(15.dp)) {
                DndUtilities()
                DndFeatureSummary()
            }
        }
    }
}
