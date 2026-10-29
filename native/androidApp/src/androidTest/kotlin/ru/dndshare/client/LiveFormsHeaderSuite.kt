package ru.dndshare.client

import org.junit.runner.RunWith
import org.junit.runners.Suite

@RunWith(Suite::class)
@Suite.SuiteClasses(
    HeaderConnectionLayoutTest::class,
    SheetFormsStorageTest::class,
    NativeControlsInteractionTest::class,
    MorphSwipeDismissTest::class,
)
class LiveFormsHeaderSuite
