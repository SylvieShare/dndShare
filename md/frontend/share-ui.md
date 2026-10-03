# Сопровождение share-ui

Разрешённый межрепозиторный workflow и обновление фиксированного release tag.

← [Frontend: архитектура и разработка](../frontend.md)

## Межрепозиторное сопровождение

Задача в DnD Share является разрешением без дополнительного согласования
изменить соседний `../share-ui`, когда существующий общий API содержит баг или
не позволяет корректно завершить задачу. В рамках задачи разрешены изменения
исходников, тестов, галереи и документации библиотеки, release commit/tag/push,
а затем обновление точной версии и lock-файла DnD Share.

Изменение обязано оставаться нейтральным: `share-ui` не получает router, Pinia,
HTTP API, permissions, локализованные DnD-тексты и доменные модели. Такая логика
остаётся в локальном adapter/controller. Нехватку общего API не обходят копией
компонента, deep import, правкой `node_modules` или постоянным переопределением
его базовой геометрии. Если безопасное решение требует незапланированной
breaking-миграции других продуктов, перед выпуском нужно завершить их миграцию
либо запросить решение пользователя.

Канонический порядок работы, матрица проверок, versioning и Definition of Done
описаны в
[share-ui/MAINTAINING.md](https://github.com/SylvieShare/share-ui/blob/main/MAINTAINING.md).

DnD Share использует точный HTTPS-архив release tag; floating branch и локальная
`file:` dependency не допускаются. Обновление выполняется после выпуска новой
версии в `SylvieShare/share-ui`:

```bash
cd frontend
npm install --save-exact \
  "https://github.com/SylvieShare/share-ui/archive/refs/tags/vX.Y.Z.tar.gz"
npm test -- --run
npm run build
```

Изменения межпроектного примитива сначала делаются и документируются в
`share-ui`, затем consumer обновляет tag. Файлы внутри `node_modules` не меняют.

## Связанные страницы

[Оглавление wiki](../README.md) · [Frontend: архитектура и разработка](../frontend.md) · [Общие UI-компоненты](components.md) · [dndShare](../../README.md)
