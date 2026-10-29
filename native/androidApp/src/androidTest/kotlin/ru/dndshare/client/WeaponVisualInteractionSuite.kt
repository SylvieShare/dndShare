package ru.dndshare.client

import org.junit.runner.RunWith
import org.junit.runners.Suite

@RunWith(Suite::class)
@Suite.SuiteClasses(
    WeaponErrorNoticeTest::class,
    WeaponCardInteractionTest::class,
    WeaponSheetInteractionTest::class,
    OfflineSyncTest::class,
)
class WeaponVisualInteractionSuite
