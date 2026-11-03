package ru.dndshare.client

import org.junit.runner.RunWith
import org.junit.runners.Suite

@RunWith(Suite::class)
@Suite.SuiteClasses(
    MapSurfaceMotionTest::class,
    MapReferenceGuideFlowTest::class,
    MapEditorWindowTest::class,
)
class NativeMapFinalUiSuite
