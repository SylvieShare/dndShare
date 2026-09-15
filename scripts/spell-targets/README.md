# Число целей заклинаний

После миграции 128 применить `plan.json` через общий MCP-скрипт:

```bash
python3 scripts/spell-rules/apply.py scripts/spell-targets/plan.json --apply
```

Скрипт требует `MCP_AUTH_TOKEN`, использует `MCP_URL`, проверяет исходные значения
и перечитывает результат. Остальные поля записей сохраняются.
