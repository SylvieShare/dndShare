package ru.dndshare.client

import org.junit.runner.RunWith
import org.junit.runners.Suite

@RunWith(Suite::class)
@Suite.SuiteClasses(
    MapForwardAlphaTest::class,
    MapSurfaceLayersTest::class,
    MapWaterReplacementTest::class,
    MapEffectsRendererTest::class,
)
class NativeMapAlphaSuite
