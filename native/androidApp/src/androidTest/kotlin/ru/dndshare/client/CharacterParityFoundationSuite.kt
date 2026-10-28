package ru.dndshare.client

import org.junit.runner.RunWith
import org.junit.runners.Suite

@RunWith(Suite::class)
@Suite.SuiteClasses(
    CharacterSheetStorageTest::class,
    SheetFormsStorageTest::class,
    CharacterSourceScopeTest::class,
    RichHtmlCodecTest::class,
    RapidFormInputTest::class,
    ImagePreparationTest::class,
    DiceRuntimeTest::class,
)
class CharacterParityFoundationSuite
