package ru.dndshare.client

import org.junit.runner.RunWith
import org.junit.runners.Suite

/** Map-only acceptance for the complete transfer; does not run other application features. */
@RunWith(Suite::class)
@Suite.SuiteClasses(
    MapWorkspaceTest::class,
    MapsHttpTest::class,
    MapModelCatalogueTest::class,
    MapGeometryCacheTest::class,
    MapRendererTest::class,
    MapBuiltinRendererTest::class,
    MapLodRendererTest::class,
    MapViewportStreamingTest::class,
    MapLoadingRendererTest::class,
    MapLightingRendererTest::class,
    MapLightFrameTest::class,
    MapForwardAlphaTest::class,
    MapSurfaceLayersTest::class,
    MapSurfaceMotionTest::class,
    MapShadowProxyTest::class,
    MapWaterReplacementTest::class,
    MapEffectsRendererTest::class,
    MapColourOutputTest::class,
    MapTextureCodecTest::class,
    MapPbrTextureTest::class,
    MapPlacementRendererTest::class,
    MapSceneMotionTest::class,
    MapPerformanceRendererTest::class,
    MapRenderResolutionRendererTest::class,
    MapSnapshotTest::class,
    MapStoredPreviewTest::class,
    MapEditorWindowTest::class,
    MapLibraryWindowTest::class,
    MapReferenceGuideFlowTest::class,
    MapPlacementFlowTest::class,
    MapLoadingFlowTest::class,
)
class NativeMapAcceptanceSuite
