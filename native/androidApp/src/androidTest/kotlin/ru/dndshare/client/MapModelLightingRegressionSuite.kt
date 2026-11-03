package ru.dndshare.client

import org.junit.runner.RunWith
import org.junit.runners.Suite

/** GLB custom semantics and the lighting passes affected by the pinned engine correction. */
@RunWith(Suite::class)
@Suite.SuiteClasses(
    MapEffectsRendererTest::class,
    MapLightingGridTest::class,
    MapLightingRendererTest::class,
    MapShadowProxyTest::class,
)
class MapModelLightingRegressionSuite
