package ru.dndshare.client

import org.junit.runner.RunWith
import org.junit.runners.Suite

@RunWith(Suite::class)
@Suite.SuiteClasses(
    MapShadowProxyTest::class,
    MapLightingRendererTest::class,
    MapForwardAlphaTest::class,
    MapSurfaceLayersTest::class,
    MapSceneMotionTest::class,
)
class NativeMapShadowSuite
