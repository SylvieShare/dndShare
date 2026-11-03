package ru.dndshare.client

import org.junit.runner.RunWith
import org.junit.runners.Suite

@RunWith(Suite::class)
@Suite.SuiteClasses(
    MapRendererTest::class,
    MapEffectsRendererTest::class,
    MapSurfaceLayersTest::class,
    MapLightFrameTest::class,
)
class NativeMapGraphicsSuite
