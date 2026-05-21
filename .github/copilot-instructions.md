# Copilot Instructions for Elasticvue

## Build, Test & Lint Commands

```bash
npm run dev              # Start dev server (Vite, port 5173)
npm run build            # Production build
npm run tsc              # Type-check (tsc + vue-tsc)
npm run lint             # ESLint with auto-fix
npm run lint:style       # Stylelint for CSS/SCSS
npm run format           # Prettier formatting

# Unit tests (Vitest)
npm run test:unit        # Run all unit tests
npx vitest run tests/unit/helpers/flatten.spec.ts  # Run a single unit test file

# E2E tests (Playwright, requires running dev server + Elasticsearch)
npm run test:e2e         # Chromium only
npm run test:e2e:all     # All browsers
npx playwright test tests/e2e/tests/pages/home.spec.ts  # Run a single e2e test

# Tauri desktop app
npm run tauri:dev        # Dev mode
npm run tauri:build      # Build desktop binary
```

## Architecture

Elasticvue is a **Vue 3 + TypeScript** GUI for Elasticsearch/OpenSearch, distributed as:
- **Web app** (self-hosted or Docker)
- **Browser extension** (Chrome, Firefox, Edge)
- **Desktop app** (Tauri v2, Rust backend)

### Build Modes

The app adapts behavior based on `VITE_APP_BUILD_MODE` env var (`docker`, `browser_extension`, `tauri`, or default `other`). See `src/buildConfig.ts` for the feature matrix (router mode, SSL/CORS hints, predefined clusters).

### Key Layers

- **`src/services/ElasticsearchAdapter.ts`** — Single class wrapping all Elasticsearch HTTP calls. Methods map 1:1 to ES APIs. Supports Basic Auth, API Key, and AWS IAM (via `aws4fetch`).
- **`src/composables/CallElasticsearch.ts`** — Vue composable (`useElasticsearchAdapter`) that provides type-safe `callElasticsearch(method, ...args)` with reactive request state (loading, error tracking).
- **`src/store/`** — Pinia stores with `persist: true` (persisted to localStorage via `pinia-plugin-persistedstate`). The `connection` store manages multi-cluster state.
- **`src/components/`** — Organized by feature domain (indices, search, shards, nodes, rest, snapshots, etc.). Uses Quasar UI framework components.
- **`src/composables/`** — Shared logic extracted as Vue composables.
- **`src/helpers/`** — Pure utility functions (no Vue dependency).
- **`src/locales/`** — i18n JSON files (en, fr, cn, ru, jp, it, tw, ko).
- **`src/db/`** — IndexedDB layer (via `idb` library) for client-side persistence beyond localStorage.

### Routing

Hash-based routing for browser extension, history-based for all other builds. Routes are nested under `/cluster/:clusterIndex/` — each cluster gets its own route scope.

## Key Conventions

- **No semicolons** — ESLint enforces `semi: ['error', 'never']`
- **Single quotes** — ESLint enforces `quotes: ['error', 'single']`
- **i18n keys use `snake_case`** — Enforced by `@intlify/vue-i18n/key-format-style`. All 8 locale files must stay in sync (`no-missing-keys-in-other-locales` is enforced).
- **`data-testid` attributes** — Used for E2E test selectors; automatically stripped in production builds via a Vite compiler transform.
- **PR branches target `develop`** — Not `main`.
- **Unused variables** — Prefix with `_` (e.g., `_unused`) to satisfy `@typescript-eslint/no-unused-vars`.
- **`@ts-expect-error`** — Used sparingly for dynamic dispatch in the ElasticsearchAdapter.
- **Composable naming** — Files in `src/composables/` export functions named `use*` (e.g., `useElasticsearchAdapter`, `useSnackbar`).
- **Store naming** — Pinia stores use `use*Store` pattern (e.g., `useConnectionStore`).

## E2E Testing

- Playwright auto-starts dev server on port 5175 for tests.
- E2E tests live in `tests/e2e/tests/` with page-based organization.
- Mock data and helpers are in `tests/e2e/mocks/` and `tests/e2e/helpers.ts`.
- Tests require an Elasticsearch instance (the `compose.yml` can provide one for development).

## Docker Development

`docker compose up` starts a dev container with hot-reload (maps port 5173, uses the project root as a volume).
