package ru.dndshare.client.ui

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.dndshare.client.R
import ru.dndshare.client.app.AppController
import ru.dndshare.client.app.AppState

@Composable
internal fun AppSidebar(
    expanded: Boolean, page: AppPage, state: AppState, controller: AppController,
    toggleLabel: String, toggleIcon: Glyph, toggle: () -> Unit, navigate: (AppPage) -> Unit,
) {
    Column(Modifier.fillMaxSize().background(WebPalette.Surface)) {
        Row(Modifier.fillMaxWidth().height(64.dp).padding(horizontal = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            if (expanded) {
                Image(painterResource(R.drawable.brand_mark), null, Modifier.size(36.dp))
                Text("DnD Share", Modifier.weight(1f).padding(start = 8.dp), maxLines = 1,
                    style = MaterialTheme.typography.titleSmall, color = WebPalette.AccentSoft)
            }
            IconButton(onClick = toggle, modifier = Modifier.semantics { contentDescription = toggleLabel }) {
                if (expanded) AppGlyph(toggleIcon) else Image(painterResource(R.drawable.brand_mark), null, Modifier.size(36.dp))
            }
        }
        HorizontalDivider()
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 10.dp, vertical = 8.dp)) {
            if (expanded) SourcePicker(state, controller)
            else IconButton(onClick = toggle, modifier = Modifier.semantics { contentDescription = "Игровая система" }) {
                AppGlyph(Glyph.Book)
            }
            HorizontalDivider(Modifier.padding(vertical = 8.dp))
            val destinations = appDestinations(state.user!!)
            destinations.forEachIndexed { index, destination ->
                if (destination.group.isNotEmpty() && destinations.getOrNull(index - 1)?.group != destination.group) {
                    Box(Modifier.fillMaxWidth().height(28.dp).padding(horizontal = 7.dp), contentAlignment = Alignment.CenterStart) {
                        if (expanded) Text(destination.group.uppercase(), color = WebPalette.TextMuted,
                            fontSize = 10.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                        else HorizontalDivider()
                    }
                }
                SidebarItem(destination, expanded, page == destination) { navigate(destination) }
                Spacer(Modifier.height(4.dp))
            }
        }
        HorizontalDivider()
        SidebarAccount(expanded, state, controller, navigate)
    }
}

@Composable
private fun SidebarItem(page: AppPage, expanded: Boolean, selected: Boolean, onClick: () -> Unit) {
    val background by animateColorAsState(
        if (selected) WebPalette.Accent.copy(alpha = .12f) else androidx.compose.ui.graphics.Color.Transparent,
        label = "Navigation selection",
    )
    Box(Modifier.fillMaxWidth()) {
        if (selected) Box(Modifier.align(Alignment.CenterStart).offset(x = (-10).dp).width(3.dp).height(28.dp)
            .background(WebPalette.Accent, RoundedCornerShape(topEnd = 3.dp, bottomEnd = 3.dp)))
        Row(
            Modifier.fillMaxWidth().heightIn(min = 48.dp).clip(RoundedCornerShape(9.dp)).background(background)
                .selectable(selected, onClick = onClick, role = Role.Tab)
                .semantics { contentDescription = "Раздел: ${page.title}" },
            verticalAlignment = Alignment.CenterVertically,
        ) {
            CompositionLocalProvider(LocalContentColor provides if (selected) WebPalette.AccentSoft else WebPalette.TextSecondary) {
                Box(Modifier.width(44.dp).height(48.dp), contentAlignment = Alignment.Center) { AppGlyph(page.icon, Modifier.size(20.dp)) }
            }
            if (expanded) Text(page.title, Modifier.weight(1f).padding(start = 10.dp, end = 8.dp),
                style = MaterialTheme.typography.bodyMedium, maxLines = 1, overflow = TextOverflow.Ellipsis,
                color = if (selected) WebPalette.Text else WebPalette.TextSecondary)
        }
    }
}

@Composable
private fun SidebarAccount(expanded: Boolean, state: AppState, controller: AppController, navigate: (AppPage) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Box(Modifier.padding(8.dp)) {
        Row(Modifier.fillMaxWidth().heightIn(min = 48.dp).clip(MaterialTheme.shapes.medium)
            .clickable { open = true }.semantics(mergeDescendants = true) { contentDescription = "Аккаунт" },
            verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(48.dp), contentAlignment = Alignment.Center) { AppGlyph(Glyph.Account) }
            if (expanded) Text(state.user?.login.orEmpty(), Modifier.weight(1f), maxLines = 1,
                overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.bodyMedium)
        }
        DropdownMenu(open, { open = false }, containerColor = WebPalette.Popover) {
            DropdownMenuItem(text = { Text("Аккаунт") }, leadingIcon = { AppGlyph(Glyph.Account) },
                onClick = { open = false; navigate(AppPage.Account) })
            HorizontalDivider()
            DropdownMenuItem(text = { Text("Выйти") }, leadingIcon = { AppGlyph(Glyph.Exit) },
                onClick = { open = false; controller.logout() })
        }
    }
}
