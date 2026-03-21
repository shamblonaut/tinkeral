# Contributing to Tinkeral

Thanks for helping improve Tinkeral! This repo is a client-only React app (Vite + TypeScript) with local persistence (Dexie/IndexedDB) and a Web Worker sandbox for function execution.

## Prerequisites

- Node.js (current LTS recommended)
- `pnpm`

## Setup

```bash
pnpm install
pnpm run dev
```

Then open `http://localhost:5173`.

On first run, the app shows an API key modal until you configure a Google API key in Settings.

## Useful commands

```bash
pnpm run test
pnpm run lint
pnpm run typecheck
pnpm run format:check
pnpm run build
```

## Development workflow

- Keep PRs small and focused.
- Update tests when you change behavior.
- Update docs when you change user-visible flows or architectural boundaries.

### Where to put code

- Feature UI/state lives under `src/features/*`:
  - Chat: `src/features/chat/*`
  - Settings: `src/features/settings/*`
  - Functions: `src/features/functions/*`
- Cross-feature contracts live under `src/shared/types/*`.
- Provider clients live under `src/shared/services/api/*`.
- Persisted entities live under `src/db/schema.ts`.

Guideline: if it’s persisted domain data, it belongs to the DB schema; if it’s feature-internal, keep it in that feature; if it’s a cross-feature contract, keep it in `src/shared/types`.

## Code style

- TypeScript-first, strict and explicit over clever.
- ESLint/Prettier are authoritative:
  - Use `pnpm run format` and `pnpm run lint` before pushing.

## Testing guidance

- Prefer tests next to the owning feature (e.g., `src/features/chat/**/__tests__`).
- Use unit tests for pure utilities and store transitions.
- Use integration tests for end-to-end flows (chat streaming, function calling loop, import/export).

## Security hygiene

- Never commit API keys, exported backups, or other secrets.
- Be mindful that “export” files may contain API keys and conversation content.
- Avoid adding logs that could leak keys or full prompt content to the console by default.
