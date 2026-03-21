# Tinkeral

**A browser-only playground for exploring LLM chat + tool/function calling.**

Tinkeral bridges the gap between simple chat UIs and raw API calls. Tune parameters, test function-calling flows, and inspect results — all in the browser.

## Features

- Chat with streaming responses
- Parameter tuning per conversation (temperature, top‑p, max tokens, etc.)
- Function/tool calling: create, test, attach, and inspect calls/results
- Local persistence (IndexedDB via Dexie) + Import/Export
- Theme + UI preferences
- Token usage display (when provided by the API)

## Privacy & security

- No backend: your API key is stored locally in your browser (IndexedDB via Dexie).
- Requests go directly from your browser to the provider API (currently Google).
- Recommended: use restricted keys, avoid shared machines, and export/clear your data when needed.

## Quick start

### Prerequisites

- Node.js (current LTS recommended)
- [pnpm](https://pnpm.io/installation)
- A Google API key from [Google AI Studio](<(https://aistudio.google.com/app/apikey)>) (free tier available)

### Installation

```bash
# Install dependencies
pnpm install

# Start development server
pnpm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### First run

On first launch, you will have to provide a Google AI Studio API key to access the interface.

## How to use

### Chat

- Pick a model and tweak parameters in Settings.
- Add an optional system prompt.
- Send messages and watch streaming updates in the chat view.

### Functions (tool calling)

- Create/edit functions in the **Functions** view (name, description, JSON Schema parameters, implementation).
- Use the built-in test runner to validate behavior.
- Attach functions to a conversation and let the model call them.
- Inspect function call arguments, results, errors, and execution time in message cards.

### Backup & restore

Use Settings → Data Management to export/import your local data (settings + conversations).

## Development

Common commands:

```bash
pnpm run dev
pnpm run build
pnpm run preview
pnpm run test
pnpm run test:coverage
pnpm run lint
pnpm run typecheck
pnpm run format
pnpm run format:check
```

## Documentation

- Architecture overview: `docs/ARCHITECTURE.md`
- Types & contracts conventions: `docs/CONVENTIONS.md`

## License

See `LICENSE`.
