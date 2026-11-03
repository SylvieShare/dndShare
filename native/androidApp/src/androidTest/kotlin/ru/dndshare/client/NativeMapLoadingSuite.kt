package ru.dndshare.client

import org.junit.runner.RunWith
import org.junit.runners.Suite

@RunWith(Suite::class)
@Suite.SuiteClasses(
    MapModelCatalogueTest::class,
    MapGeometryCacheTest::class,
    MapsHttpTest::class,
    MapLoadingFlowTest::class,
    MapEffectsRendererTest::class,
    MapTextureCodecTest::class,
)
class NativeMapLoadingSuite
