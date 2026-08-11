# Client-side JavaScript diagnostics

`features/console-errors` provides an in-page view of JavaScript errors for users with
`ERROR_REPORT_REVIEWER` or `ADMIN`. It is mounted globally from `App.vue` outside print routes.
Ordinary users never see stack traces or the diagnostic control.

`installConsoleErrorCapture()` is called in `main.js` before the Vue application is mounted. During
the lifetime of the current tab it captures:

- explicit `console.error(...)` calls while preserving the original console output;
- uncaught `window.error` events with filename, line, column and stack where available;
- unhandled promise rejections.

Browser-generated `ResizeObserver` delivery notifications without an associated `Error` object are
excluded. They report deferred layout observation rather than an application exception; explicitly
thrown errors with the same text are still captured.

The collector is in-memory only: errors are neither persisted nor sent to the backend. Circular
objects, `Error` values and DOM elements are converted to bounded text safely. Identical errors on
the same page URL are grouped with an occurrence count, and at most 100 unique entries are retained.

When at least one error exists, a circular indicator appears at the bottom-right above transient
dice notifications. A single occurrence is shown as `!`; multiple occurrences show their count
(capped visually at `99+`). The circle expands into a scrollable list. Clicking a row opens the
shared `AppModal` with the complete bounded error text, page URL and timestamp.
