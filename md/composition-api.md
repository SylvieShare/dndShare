# Composition API Rules

New and touched Vue components must use Composition API. Prefer `<script setup>` for new components and small/medium refactors.

## Do

- Use `defineProps`, `defineEmits`, `provide`, `inject`, template refs (`const input = ref(null)`), `useRouter`, and `useRoute` explicitly.
- Use `computed` for derived values.
- Use `watch` only for side effects.
- Clean up timers, DOM listeners, observers, and pending animation frames in `onBeforeUnmount`.
- Put reusable feature behavior into composables near the feature.
- Keep cross-feature pure helpers in `shared/lib` or feature `lib` folders.

## Do Not

- Do not add Options API sections: `data`, `computed`, `methods`, `mounted`, `created`, `watch`, `provide`, or `inject` as component options.
- Do not use component-instance legacy helpers in new/touched code: `this`, `$store`, `$router`, `$route`, `$refs`, `$nextTick`, or `$emit`.
- Do not add Vuex code, `$store`, `mapState`, `mapGetters`, `mapActions`, or `mapMutations`.
- Do not copy the temporary proxy compatibility pattern (`const vm = new Proxy`).

## Composables

- A composable should own one behavior or workflow: loading data, form state, drag behavior, tooltip positioning, tab swiping, etc.
- Return a small explicit contract: state refs/computed values plus action functions.
- Keep API calls in `shared/api/*Api.js` or a feature API client; composables can orchestrate those clients.
- Do not create global mutable module state unless it is an intentional cache/registry and documented near the declaration.

## Existing code

Options API and temporary component-instance proxies are not part of the
current architecture. If one is discovered, remove it in the same change and
extract focused composables/children where size justifies it. Do not preserve a
second implementation path for compatibility.
