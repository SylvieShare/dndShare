# MCP endpoint

MCP реализован в `internal/web/mcp*.go` как JSON-RPC 2.0 over `POST /mcp`.
`mcp.go` содержит transport/dispatch, а tool schemas, аргументы и mutations
вынесены в тематические файлы. GET/SSE transport и Spring AI отсутствуют.

## Access

- Authorization: `Bearer $MCP_AUTH_TOKEN`.
- Read tools доступны при корректном token.
- Write tools дополнительно требуют `MCP_WRITE_ENABLED=true`.
- Protocol methods: `initialize`, `ping`, `tools/list`, `tools/call`.

Ошибки transport/protocol возвращаются как JSON-RPC errors; tool-level ошибка
возвращается в tool result. Имена аргументов являются частью текущего контракта:
aliases для прежних имён не поддерживаются.

## Handbook tools

Read:

- `handbook_sources`;
- `handbook_item_types`;
- `handbook_items`, `handbook_items_search`, `handbook_items_get`;
- `handbook_suggest_types`, `handbook_suggests`,
  `handbook_suggests_search`.

Write:

- `handbook_item_create`, `handbook_item_update`, `handbook_item_delete`;
- `handbook_suggest_create`, `handbook_suggest_update`,
  `handbook_suggest_set_svg`, `handbook_suggest_delete`.

Tool schemas должны совпадать с текущей item/suggest model. При обновлении item
передаются все поля, которые нужно сохранить; source links задаются через
актуальные `contentSourceIds`.

## Error-report automation

JSON-returning tools expose the typed value as
`structuredContent.result` and keep the serialized value in the text content
block for backwards compatibility. Automation code should validate the typed
value instead of parsing the text block when `structuredContent` is available.

Lifecycle tools:

- `error_reports_list`;
- `error_report_lock_acquire`, `error_report_lock_renew`,
  `error_report_lock_release`;
- `error_reports_claim`;
- `error_report_title_set`;
- `error_report_question_create`;
- `error_report_serious_change_request`;
- `error_report_resolve`;
- `error_report_screenshot`.

Automation first acquires the singleton lock, then claims rows. Mutating a
claimed report requires the exact `leaseId` returned by the lock/claim flow.
`leaseId` is mandatory for resolve, question and serious-change request;
`token` and optional-lease aliases are not accepted. There is no
`error_report_delete` tool: successful work is finished through
`error_report_resolve`, while physical deletion is an ADMIN HTTP action.

Asking a question or requesting serious approval releases the report back to a
human-gated state. Resolution records summary/commit SHA and moves it to
`RESOLVED`; reviewer polling later archives it. Expired/released leases return
unfinished reports to `OPEN`.

## Changing MCP

When adding or changing a tool, update together:

1. dispatch in `internal/web/mcp.go`;
2. `tools/list` schema in `internal/web/mcp_tool_defs.go`;
3. argument validation in `internal/web/mcp_args.go` and permission checks;
4. smoke/contract tests in `internal/web`;
5. this page and any feature-specific documentation.

Do not leave deprecated tool names or argument aliases after the caller/data
migration is complete.
