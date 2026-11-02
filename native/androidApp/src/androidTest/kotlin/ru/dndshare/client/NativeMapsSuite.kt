package ru.dndshare.client

import org.junit.runner.RunWith
import org.junit.runners.Suite

@RunWith(Suite::class)
@Suite.SuiteClasses(
    MapRendererTest::class,
    MapWorkspaceTest::class,
    MapsHttpTest::class,
    MapEditorWindowTest::class,
)
class NativeMapsSuite
