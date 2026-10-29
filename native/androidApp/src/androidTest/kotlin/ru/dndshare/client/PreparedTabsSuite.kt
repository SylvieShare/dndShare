package ru.dndshare.client

import org.junit.runner.RunWith
import org.junit.runners.Suite

@RunWith(Suite::class)
@Suite.SuiteClasses(
    PreparedSheetPagerTest::class,
    SheetContentLoadingTest::class,
    SheetPresentationIdentityTest::class,
    ControlsMotionSuite::class,
)
class PreparedTabsSuite {
    companion object {
        @JvmField @org.junit.ClassRule val animations = AnimatorScaleRule()
    }
}
