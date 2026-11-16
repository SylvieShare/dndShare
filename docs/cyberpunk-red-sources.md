# Локальные источники Cyberpunk RED

Рабочая опись, 16 ноября 2026. PDF хранятся в предусмотренной `.gitignore`
директории `docs/` и не публикуются вместе с сайтом или Git-репозиторием.
В текущей основной рабочей копии книги D&D в PDF не найдены; для RED использован
имеющийся контракт `/docs/*.pdf`.

Локальная папка материалов: `C:/Projects/dndshare/docs`.

| Файл | Источник | Назначение |
| --- | --- | --- |
| `cyberpunk-red-character-sheet.pdf` | [RTG](https://rtalsoriangames.com/wp-content/uploads/2020/11/RTG-CPR-CharacterSheet.pdf) | Лист для печати |
| `cyberpunk-red-character-sheet-fillable.pdf` | [RTG](https://rtalsoriangames.com/wp-content/uploads/2020/11/RTG-CPR-CharacterSheet-Fillable.pdf) | Заполняемый лист |
| `cyberpunk-red-core-errata-v1.25.pdf` | [RTG](https://rtalsoriangames.com/wp-content/uploads/2021/08/RTG-CPR-CoreBookErratav1.25.pdf) | Исправления Core |
| `cyberpunk-red-jumpstart-rules-ru.pdf` | [Hobby Games CDN](https://hobbygames.cdnvideo.ru/download/rules/CyberpunkRED_JumpstartKit_rules.pdf) | Русский стартер 2019; не Core |
| `cyberpunk-red-core-rulebook-1.25-ru.pdf` | Предоставлен пользователем из локальной папки Downloads/Telegram Desktop | Полная книга, русский фанатский перевод; 458 PDF-страниц |

Полная книга **получена от пользователя** и скопирована в указанную папку.
На странице создателей визуально подтверждено обозначение «Редакция v1.25».
Первая дополнительная страница указывает фанатское происхождение перевода;
он не обозначается официальной русской локализацией. Запрос покупки больше
не нужен. Оригинальный файл пользователя сохранён без изменения.

Доступные стартовые правила не заменяют Core. После таймаута основного домена
русский Jumpstart успешно загружен с CDN Hobby Games. У всех пяти файлов
проверены PDF-сигнатура и SHA-256.

## Контрольные суммы SHA-256

```text
character-sheet-fillable: 95085ae1ec70442cb2ec26113016dfea049bf1e25bfdac7449ff8d03e8308e65
character-sheet: d9e426cfa124a6c478a46e47ac84eaeea539dfbfa415ea35c9edd0a5a599598e
core-errata-v1.25: d9c16d315872567e17d953b067d636dea1cea0ac0504f1635b0a5b35f0e54129
jumpstart-rules-ru: 4a1aa68da0a63453449892d9803d44511431e3fe55f2fb6ff96625d15b4f755d
core-rulebook-1.25-ru: aece6513e81347acecb06e1544ec281d44b9eed2e99ec7c4ecfc766b6856b295
```

## Извлечение и сверка

У полного PDF отсутствует корректный Unicode mapping у части встроенных
шрифтов. Обычный extract_text искажает буквы и теряет числа. Утилита
[extract_source.py](../scripts/cyberpunk-red/extract_source.py) принимает только
зафиксированный SHA, восстанавливает доступные glyph mappings и рендерит страницы
для сверки. Нераспознанные глифы остаются явно отмеченными `⟦число⟧`.
Это рабочее извлечение, а не гарантия точности всех страниц; таблицы нужно
сверять визуально. Артефакты находятся в игнорируемом `build/cyberpunk-red-source`.
Номер напечатанной страницы N в проверенных разделах соответствует PDF-странице N+1.

Проверены правила создания: 73–90, бюджет вещей 104–105, производные значения
79–80; таблицы рангов навыков 86–87 сверены с изображениями. Официальная errata
имеет приоритет над ошибкой перевода или неподправленной таблицей (например,
падение EMP у готовых комплектов на стр. 117). Полные тексты и PDF не входят
в публичную сборку или Git.

Открытые вспомогательные материалы:
[Free Basic Rules](https://roll20.net/compendium/cpunk/BookIndex),
[русский Jumpstart](https://hobbygames.ru/download/rules/CyberpunkRED_JumpstartKit_rules.pdf),
[официальный список загрузок](https://rtalsoriangames.com/downloadable-content/).

## Связанные страницы

[План](../plans/cyberpunk-red/README.md) · [Реестр контента](../plans/cyberpunk-red/content.md)
