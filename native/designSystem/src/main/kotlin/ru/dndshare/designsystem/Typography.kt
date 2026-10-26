package ru.dndshare.designsystem

import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.ExperimentalTextApi
import androidx.compose.ui.text.font.*
import androidx.compose.ui.unit.sp

@OptIn(ExperimentalTextApi::class)
object ShareTypography {
    private val display = FontFamily(Font(R.font.cormorant_garamond, FontWeight.SemiBold, variationSettings = FontVariation.Settings(FontVariation.weight(600))))
    private val prose = FontFamily(Font(R.font.literata, variationSettings = FontVariation.Settings(FontVariation.weight(400), FontVariation.Setting("opsz", 16f))),
        Font(R.font.literata_italic, style = FontStyle.Italic, variationSettings = FontVariation.Settings(FontVariation.weight(400), FontVariation.Setting("opsz", 16f))))
    val title = TextStyle(fontFamily = display, fontSize = 32.sp, lineHeight = 36.sp, fontWeight = FontWeight.SemiBold)
    val section = TextStyle(fontFamily = display, fontSize = 25.sp, lineHeight = 29.sp, fontWeight = FontWeight.SemiBold)
    val card = TextStyle(fontFamily = display, fontSize = 23.sp, lineHeight = 27.sp, fontWeight = FontWeight.SemiBold)
    val row = TextStyle(fontFamily = display, fontSize = 19.sp, lineHeight = 23.sp, fontWeight = FontWeight.SemiBold)
    val body = TextStyle(fontFamily = prose, fontSize = 16.sp, lineHeight = 26.sp)
}
