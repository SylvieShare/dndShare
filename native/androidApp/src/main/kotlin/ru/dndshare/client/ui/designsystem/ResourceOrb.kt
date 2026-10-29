package ru.dndshare.client.ui.designsystem

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.*
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.*
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.dp
import kotlin.math.roundToInt

/** SpellSlotSphere's glass, clipped well, liquid edge, shine, bubbles and cast/recharge light. */
@Composable
fun ShareResourceOrb(
    charged: Boolean,
    label: String,
    modifier: Modifier = Modifier,
    color: Color = WebPalette.Accent,
    enabled: Boolean = true,
    onClick: (() -> Unit)? = null,
    compact: Boolean = false,
    level: Int = 1,
) {
    val fill =
        animateFloatAsState(
            if (charged) 1f else 0f,
            tween(550, easing = CubicBezierEasing(.5f, 0f, .2f, 1f)),
            label = "Resource liquid",
        )
    val rim =
        animateColorAsState(
            if (charged)
                Color(
                    androidx.core.graphics.ColorUtils.blendARGB(
                        WebEffectSpec.OrbRim.toInt(),
                        color.toArgb(),
                        .5f,
                    )
                )
            else Color(WebEffectSpec.OrbRim),
            tween(400),
            label = "Resource glass",
        )
    val flash = remember { Animatable(0f) }
    var mounted by remember { mutableStateOf(false) }
    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(charged) {
        if (mounted) {
            flash.snapTo(1f)
            flash.animateTo(0f, tween(if (charged) 520 else 600))
        }
        mounted = true
    }
    val phase = rememberVisualPhase(charged && visible, 4.4f)
    val seed = remember(label, level) { kotlin.random.Random(label.hashCode() + level * 7) }
    val bubbles =
        remember(label, level) {
            List(2 + (((level - 1).coerceIn(0, 8) / 8f) * 2).roundToInt()) {
                floatArrayOf(
                    .30f + seed.nextFloat() * .40f,
                    .06f + seed.nextFloat() * .14f,
                    3f + seed.nextFloat() * 2f,
                    3f + seed.nextFloat() * 1.4f,
                    seed.nextFloat() * 2.2f,
                )
            }
        }
    Canvas(
        modifier
            .size(if (compact) 32.dp else 48.dp)
            .onGloballyPositioned { visible = !it.boundsInWindow().isEmpty }
            .semantics {
                contentDescription = label
                stateDescription = if (charged) "Доступна" else "Потрачена"
            }
            .then(
                if (onClick != null)
                    Modifier.clickable(enabled = enabled, role = Role.Button, onClick = onClick)
                else Modifier
            )
    ) {
        val diameter = (if (compact) 28.dp else 30.dp).toPx()
        val k = diameter / 58f
        val center = Offset(size.width / 2, size.height / 2)
        val radius = diameter / 2
        val glass = WebEffectSpec.OrbRimWidth.dp.toPx()
        val well = radius - glass - 3 * k
        val glow = flash.value
        if (glow > 0) {
            val strength = .85f + ((level - 1).coerceIn(0, 8) / 8f) * .9f
            val outer = radius + (if (charged) 18 else 22) * k * strength
            drawCircle(
                Brush.radialGradient(
                    listOf(color.copy(alpha = .55f * glow), Color.Transparent),
                    center,
                    outer,
                ),
                outer,
                center,
            )
        }
        drawCircle(Color(WebEffectSpec.OrbBody), radius, center)
        drawCircle(rim.value, radius - glass / 2, center, style = Stroke(glass))
        val clip =
            Path().apply { addOval(Rect(center - Offset(well, well), Size(well * 2, well * 2))) }
        clipPath(clip) {
            val top = center.y + well - well * 2 * fill.value
            drawRect(color, Offset(center.x - well, top), Size(well * 2, well * 2 * fill.value))
            if (fill.value > 0)
                drawLine(
                    Color.White.copy(alpha = .5f),
                    Offset(center.x - well, top),
                    Offset(center.x + well, top),
                    2.dp.toPx(),
                )
            val elapsed = phase.value * 4.4f
            bubbles.forEach { b ->
                if (charged && elapsed >= b[4]) {
                    val p = ((elapsed - b[4]) / b[3]) % 1f
                    val opacity = if (p < .18f) p / .18f * .6f else .6f * (1 - p) / .82f
                    drawCircle(
                        Color.White.copy(alpha = .4f * opacity),
                        b[2] * k / 2 * (.6f + .4f * p),
                        Offset(
                            center.x - well + b[0] * well * 2,
                            center.y + well - b[1] * well * 2 - 30 * k * p,
                        ),
                    )
                }
            }
            drawCircle(
                Color.White.copy(alpha = .45f),
                well * .26f,
                Offset(center.x - well * .30f, center.y - well * .38f),
            )
        }
        if (!charged && glow > 0) {
            val progress = 1 - glow
            val wisp = Offset(center.x, center.y - radius + diameter * .4f - 30 * k * progress)
            val r = 8 * k * (.5f + 1.2f * progress)
            val alpha = if (progress < .25f) progress / .25f * .8f else .8f * (1 - progress) / .75f
            drawCircle(
                Brush.radialGradient(listOf(color.copy(alpha = alpha), Color.Transparent), wisp, r),
                r,
                wisp,
            )
        }
    }
}
