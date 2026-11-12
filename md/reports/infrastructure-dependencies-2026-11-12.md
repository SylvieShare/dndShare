# Очередь, retention и зависимости — 12 ноября 2026

Статус: исторический отчёт. Действующие правила: [выпуск](../deploy.md),
[версии/OTA](../features/client-updates.md), [Android](../../native/README.md).

## Срез

Выпущен 7498a3ed768aa7526481b1541ca1237e45bf2a39:
backend 0.3.2/build 3, frontend 0.3.22/build 23, Android 0.3.6/versionCode 10.
Чистая копия и артефакты: C:/Projects/dndshare/build/releases/SHA/source и
соседние frontend/, web/, android/. APK установлен на телефон с сохранением данных.

Пользователь подтвердил наличие бэкапов БД и сам перезагрузил VM. После этого
проверены работа nginx/активного слота, успешный health и отсутствие reboot marker.
Мониторинг, бэкапы и повторная перезагрузка в эту работу не входили.

## Обновления

| Компонент | Проверенная версия |
| --- | --- |
| Node/npm | 24.22.3 / 11.19.1, отдельная установка на C и pin .node-version. |
| Go | 1.27.4, включая stdlib в Linux-бинаре. |
| Pinia / devtools API | 4.1.0 / 8.2.1; ESM и обязательный peer учтены. |
| Vitest | 5.1.0. |
| Vue / Router | 3.5.45 / 5.5.0. |
| Three.js / BVH | 0.187.0 / 0.9.18. |
| Vite / Vue plugin | 8.3.8 / 6.0.11. |
| Playwright | 1.65.0; браузерные пакеты обновлены для Windows и Linux. |
| ESLint / Vue plugin | 10.14.0 / 10.12.1. |
| pgx / AWS SDK / S3 | 5.13.0 / 1.48.0 / 1.114.10. |
| x/image / x/text / x/sync | 0.48.0 / 0.44.0 / 0.25.0. |
| JDK / Gradle / AGP | Temurin 25.0.5+8 / 9.9.1 / 9.5.1. |
| AppCompat / annotation-experimental | 1.8.0 / 1.6.0. |

Остальные прямые зависимости проверены по реестрам; уже актуальные Capacitor 8.6.0,
activity 1.13.0, Window 1.5.1, html-to-image 1.11.13 и fflate 0.8.3 сохранены.
Share-ui обновлён до опубликованного v0.59.0 при включении законченных изменений main.
Для ESLint/config-array задан override minimatch 11.0.8: upstream-диапазон
оставлял известное замечание аудита. Линтер всего src и build с override пройдены.

## Публикации и хранение

Prepare создаёт неизменяемый snapshot frontend, Go-архив и manifest по SHA.
Повторный Prepare того же SHA занял 0,47 секунды без новой сборки. Android
упакован из того же dist; 84 ресурса побайтово совпали со snapshot.

Реальный запрос прошёл queued → publishing → published, attempts=1; сервер
подтвердил ожидаемый SHA. Передача архива заняла 200 секунд; прежний слот оставался
активным до получения и проверки кандидата. При подготовке двух разных SHA
их source, manifest и APK не перезаписывали друг друга.

Retention service завершился Result=success, ExecMainStatus=0. Удалены пять
неиспользуемых каталогов релизов, оба слота защищены. Размер releases после
операции — около 149 МиБ. Кандидатов удаления статики не было: кеш около 1,2 ГиБ
сохранён при политике 30 дней. Asset cleanup не был пропущен из-за старой описи:
опись предыдущего слота успешно конвертирована перед переключением.

## Проверки и границы

- npm audit: ноль замечаний после обновления и security override.
- govulncheck для linux/amd64: ноль findings; ранее использовавшаяся Go 1.27.1
  заменена в компилируемом backend.
- 288 unit-тестов в 74 файлах: stores, platform, model3d, map rendering и router.
- 10 browser-сценариев версий/шапки в трёх ширинах; 13 WebGL-сценариев моделей,
  освещения, теней и объёмного тумана; production safe-area сценарий.
- Изолированная PostgreSQL: handbook sync/commit order, persistence персонажей,
  authored effects; S3/config unit-тесты и go vet пройдены.
- Android: updater/rollback, HybridShellTest, SystemChromeTest и lint пройдены
  на выделенном эмуляторе. Физический телефон использовался для установки.
- Queue: четыре одновременных клиента, продолжение после ошибки, recovery воркера,
  ordering barrier; artifact reuse/isolation/tamper проверены в PowerShell 5 и 7.
- 13 deployment-тестов на Linux, включая пять защит retention и migration описи;
  27 узких тестов dev tools; wiki strict пройдён. Полного набора тестов не было.

Машинные результаты сохранены в локальном build/: dependencies-*, release-queue-*,
release-artifact-*, infrastructure-last-prune.json, infrastructure-queue-publish.log;
квитанция установки — build/releases/SHA/android/release.json. Визуальное одобрение
дизайна остаётся за пользователем; эти проверки его не заменяют.
