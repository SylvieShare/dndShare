package ru.dndshare.client.ui.designsystem

import androidx.compose.animation.*
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** A quiet action surface. Only focus/selection adds an outline; collapsed inputs retain state. */
@Composable
fun ShareActionDisclosure(
    kind: String,
    title: String,
    expanded: Boolean,
    change: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
    color: Color = WebPalette.Accent,
    leading: (@Composable () -> Unit)? = null,
    trailing: @Composable RowScope.() -> Unit = {},
    content: @Composable ColumnScope.() -> Unit,
) {
    var focus by remember { mutableStateOf(false) }
    val angle =
        animateFloatAsState(
            if (expanded) -90f else 90f,
            tween(DesignTokens.Motion.Feedback),
            label = "Disclosure arrow",
        )
    val saved = rememberSaveableStateHolder()
    val inSheet = LocalDisclosureSheets.current
    Surface(
        modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        color = color.copy(alpha = .075f),
        border = if (focus) BorderStroke(1.dp, WebPalette.AccentSoft) else null,
    ) {
        Column {
            Row(
                Modifier.fillMaxWidth()
                    .heightIn(min = 56.dp)
                    .onFocusChanged { focus = it.hasFocus }
                    .clickable(role = Role.Button) { change(!expanded) }
                    .semantics {
                        contentDescription = "$kind: $title"
                        stateDescription = if (expanded) "Развернуто" else "Свернуто"
                        if (expanded)
                            collapse {
                                change(false)
                                true
                            }
                        else
                            expand {
                                change(true)
                                true
                            }
                    }
                    .padding(12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                leading?.invoke()
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        kind,
                        style =
                            ShareTypography.context.copy(
                                fontSize = 10.sp,
                                lineHeight = 12.sp,
                                fontWeight = FontWeight.Bold,
                            ),
                        color = color,
                    )
                    Text(
                        title,
                        style =
                            ShareTypography.group.copy(
                                fontSize = 13.sp,
                                lineHeight = 17.sp,
                                fontWeight = FontWeight.Bold,
                            ),
                    )
                }
                trailing()
                AppGlyph(
                    Glyph.Chevron,
                    Modifier.size(16.dp).graphicsLayer { rotationZ = angle.value },
                    WebPalette.TextMuted,
                )
            }
            AnimatedVisibility(
                expanded && !inSheet,
                enter =
                    expandVertically(tween(DesignTokens.Motion.Feedback)) +
                        fadeIn(tween(DesignTokens.Motion.Feedback)),
                exit =
                    shrinkVertically(tween(DesignTokens.Motion.Feedback)) +
                        fadeOut(tween(DesignTokens.Motion.Feedback)),
            ) {
                saved.SaveableStateProvider("body") {
                    Column(
                        Modifier.fillMaxWidth().padding(start = 12.dp, end = 12.dp, bottom = 12.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        content = content,
                    )
                }
            }
        }
    }
    if (expanded && inSheet)
        ShareBottomSheet(title, { change(false) }) {
            saved.SaveableStateProvider("body") {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp), content = content)
            }
        }
}
