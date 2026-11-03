package ru.dndshare.client.maps.rendering

import com.google.android.filament.LightManager

/**
 * The 1.77.3 Java ShadowOptions constructor is zeroed; restore the native PCF defaults explicitly.
 */
internal fun mapShadowOptions(size: Int) =
    LightManager.ShadowOptions().apply {
        mapSize = size
        shadowCascades = 1
        setCascadeSplitPositions(.125f, .25f, .5f)
        constantBias = .001f
        normalBias = 1f
        shadowNearHint = 1f
        shadowFarHint = 100f
        lispsm = true
        polygonOffsetConstant = .5f
        polygonOffsetSlope = 2f
        stepCount = 8
        maxShadowDistance = .3f
        shadowBulbRadius = -1f
        setTransform(0f, 0f, 0f, 1f)
        penumbraScale = 1f
        penumbraRatioScale = 1f
    }
