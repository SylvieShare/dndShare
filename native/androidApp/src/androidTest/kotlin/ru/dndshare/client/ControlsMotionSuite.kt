package ru.dndshare.client

import org.junit.runner.RunWith
import org.junit.runners.Suite

@RunWith(Suite::class)
@Suite.SuiteClasses(
    NativeControlsInteractionTest::class,
    MorphSwipeDismissTest::class,
    MorphContentIdentityTest::class,
    MorphFrameContinuityTest::class,
    MorphEditorViewportTest::class,
    SheetPagerStateTest::class,
    SheetPagerGestureTest::class,
)
class ControlsMotionSuite {
    companion object {
        @JvmField @org.junit.ClassRule val animations = AnimatorScaleRule()
    }
}
