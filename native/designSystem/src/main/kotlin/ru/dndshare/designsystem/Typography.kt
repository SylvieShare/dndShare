package ru.dndshare.designsystem

import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.ExperimentalTextApi
import androidx.compose.ui.text.font.*

@OptIn(ExperimentalTextApi::class)
private fun textRole(token: DesignType): TextStyle {
    val weight = FontVariation.weight(token.weight.weight)
    val family = when (token.family) {
        DesignFont.Ui -> FontFamily.Default
        DesignFont.Display -> FontFamily(Font(R.font.cormorant_garamond, token.weight,
            variationSettings = FontVariation.Settings(weight)))
        DesignFont.Prose -> {
            val settings = FontVariation.Settings(weight, FontVariation.Setting("opsz", token.size.value))
            FontFamily(Font(R.font.literata, token.weight, variationSettings = settings),
                Font(R.font.literata_italic, token.weight, style = FontStyle.Italic, variationSettings = settings))
        }
    }
    return TextStyle(fontFamily = family, fontSize = token.size, lineHeight = token.lineHeight, fontWeight = token.weight, letterSpacing = token.tracking)
}

object ShareTypography {
    val sheetStat = textRole(DesignTokens.Typography.SheetStat)
    val sheetStatCompact = textRole(DesignTokens.Typography.SheetStatCompact)
    val title = textRole(DesignTokens.Typography.Title)
    val section = textRole(DesignTokens.Typography.Section)
    val card = textRole(DesignTokens.Typography.Card)
    val row = textRole(DesignTokens.Typography.Row)
    val body = textRole(DesignTokens.Typography.Body)
    val listAlternate = textRole(DesignTokens.Typography.ListAlternate)
    val listSubtitle = textRole(DesignTokens.Typography.ListSubtitle)
    val listMetric = textRole(DesignTokens.Typography.ListMetric)
    val header = textRole(DesignTokens.Typography.Header)
    val context = textRole(DesignTokens.Typography.Context)
    val group = textRole(DesignTokens.Typography.Group)
    val collectionTitle = textRole(DesignTokens.Typography.CollectionTitle)
    val collectionDescription = textRole(DesignTokens.Typography.CollectionDescription)
    val collectionCount = textRole(DesignTokens.Typography.CollectionCount)
    val collectionRelation = textRole(DesignTokens.Typography.CollectionRelation)
    val collectionChildren = textRole(DesignTokens.Typography.CollectionChildren)
}
