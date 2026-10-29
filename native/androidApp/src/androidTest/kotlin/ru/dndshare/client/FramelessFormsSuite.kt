package ru.dndshare.client

import org.junit.runner.RunWith
import org.junit.runners.Suite

/** Controls, focus handoff and the remaining dismissal paths after removing the close icon. */
@RunWith(Suite::class)
@Suite.SuiteClasses(NativeControlsInteractionTest::class, MorphSwipeDismissTest::class)
class FramelessFormsSuite
