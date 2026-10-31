package ru.dndshare.client.ui.designsystem

import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import ru.dndshare.client.R

// Lucide geometry is shared with the web; regenerate using scripts/native/sync_web_design.py.
enum class Glyph(@param:DrawableRes val resource: Int) {
    Hand(R.drawable.lucide_hand),
    Sunrise(R.drawable.lucide_sunrise),
    Tags(R.drawable.lucide_tags),
    Clock(R.drawable.lucide_clock_3),
    Hourglass(R.drawable.lucide_hourglass),
    Shapes(R.drawable.lucide_shapes),
    Coins(R.drawable.lucide_coins),
    Gem(R.drawable.lucide_gem),
    Zap(R.drawable.lucide_zap),
    Heart(R.drawable.lucide_heart),
    Badge(R.drawable.lucide_badge),
    Shield(R.drawable.lucide_shield),
    Bell(R.drawable.lucide_bell),
    Copy(R.drawable.lucide_copy),
    InfoCircle(R.drawable.lucide_info),
    Dice(R.drawable.lucide_dices),
    Plus(R.drawable.lucide_plus),
    Minus(R.drawable.lucide_minus),
    Transfer(R.drawable.lucide_arrow_right_left),
    Move(R.drawable.lucide_folder_input),
    Up(R.drawable.lucide_arrow_up),
    Down(R.drawable.lucide_arrow_down),
    Wand(R.drawable.lucide_wand_sparkles),
    Link(R.drawable.lucide_link),
    Code(R.drawable.lucide_code),
    Quote(R.drawable.lucide_quote),
    List(R.drawable.lucide_list),
    ListOrdered(R.drawable.lucide_list_ordered),
    Image(R.drawable.lucide_image),
    Table(R.drawable.lucide_table),
    Heading(R.drawable.lucide_heading),
    Strikethrough(R.drawable.lucide_strikethrough),
    Wallet(R.drawable.lucide_wallet),
    Weight(R.drawable.lucide_weight),
    Backpack(R.drawable.lucide_backpack),
    Shirt(R.drawable.lucide_shirt),
    Trash(R.drawable.lucide_trash),
    CircleCheck(R.drawable.lucide_circle_check),
    Swords(R.drawable.lucide_swords),
    Target(R.drawable.lucide_crosshair),
    ShieldCheck(R.drawable.lucide_shield_check),
    Bold(R.drawable.lucide_bold),
    Italic(R.drawable.lucide_italic),
    Underline(R.drawable.lucide_underline),
    Undo(R.drawable.lucide_undo_2),
    Redo(R.drawable.lucide_redo_2),
    More(R.drawable.lucide_ellipsis),
    Rest(R.drawable.lucide_moon),
    Settings(R.drawable.lucide_settings),
    Edit(R.drawable.lucide_pencil),
    Filter(R.drawable.lucide_list_filter),
    Book(R.drawable.lucide_book_open),
    Rules(R.drawable.lucide_book_open_check),
    Characters(R.drawable.lucide_users),
    CreateCharacter(R.drawable.lucide_user_round_plus),
    Sessions(R.drawable.lucide_scroll_text),
    Maps(R.drawable.lucide_map),
    Admin(R.drawable.lucide_shield),
    Account(R.drawable.lucide_user_round),
    Menu(R.drawable.lucide_menu),
    Close(R.drawable.lucide_x),
    Collapse(R.drawable.lucide_panel_left_close),
    Expand(R.drawable.lucide_panel_left_open),
    Refresh(R.drawable.lucide_refresh_cw),
    Back(R.drawable.lucide_arrow_left),
    Exit(R.drawable.lucide_log_out),
    Search(R.drawable.lucide_search),
    Chevron(R.drawable.lucide_chevron_right),
}

@Composable
fun AppGlyph(
    glyph: Glyph,
    modifier: Modifier = Modifier,
    tint: androidx.compose.ui.graphics.Color = LocalContentColor.current,
) {
    Icon(
        painterResource(glyph.resource),
        contentDescription = null,
        modifier = modifier.size(24.dp),
        tint = tint,
    )
}
