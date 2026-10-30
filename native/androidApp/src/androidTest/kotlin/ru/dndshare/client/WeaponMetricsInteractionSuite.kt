package ru.dndshare.client

import org.junit.runner.RunWith
import org.junit.runners.Suite

@RunWith(Suite::class)
@Suite.SuiteClasses(
    WeaponCardInteractionTest::class,
    RoundedPressTest::class,
    WeaponMetricsLayoutTest::class,
)
class WeaponMetricsInteractionSuite
