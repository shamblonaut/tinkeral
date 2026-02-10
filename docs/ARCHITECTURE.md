# Architecture

## System Overview

This is a client-side web application that provides an interactive playground for exploring LLM API capabilities. The platform allows users to experiment with various LLM parameters, features, and configurations without writing code, while maintaining transparency into the underlying API mechanics.

**Core Problem Solved**: Bridge the gap between simple chat interfaces and raw API usage, giving users a powerful, visual way to understand and experiment with LLM capabilities through parameter tuning and feature exploration.

**Primary Architectural Approach**: Client-only React application with local state management, provider-abstracted API clients, and secure sandboxed execution for user-defined functions.

**Key Characteristics**:

- Zero backend infrastructure (runs entirely in browser)
- Provider-agnostic design (easy to add new LLM providers)
- Educational focus (transparency into API mechanics)
- Progressive enhancement (core features first, advanced features later)

## High-Level Architecture

```
┌────────────────────────────────────────────────────────────┐
│                        Browser Client                      │
│                                                            │
│   ┌────────────────────────────────────────────────────┐   │
│   │              React UI Layer (Vite)                 │   │
│   │                                                    │   │
│   │  ┌──────────────┐  ┌──────────────┐  ┌─────────┐   │   │
│   │  │ Chat         │  │ Parameters   │  │ Model   │   │   │
│   │  │ Interface    │  │ Panel        │  │ Selector│   │   │
│   │  └──────────────┘  └──────────────┘  └─────────┘   │   │
│   │  ┌──────────────┐  ┌──────────────┐  ┌─────────┐   │   │
│   │  │ Function     │  │ Conversation │  │ Settings│   │   │
│   │  │ Editor       │  │ Manager      │  │ Modal   │   │   │
│   │  └──────────────┘  └──────────────┘  └─────────┘   │   │
│   └────────────────────────────────────────────────────┘   │
│                            │                               │
│   ┌────────────────────────────────────────────────────┐   │
│   │         State Management (Zustand)                 │   │
│   │                                                    │   │
│   │  ┌──────────────┐  ┌──────────────┐  ┌─────────┐   │   │
│   │  │ Conversation │  │ Settings     │  │ UI      │   │   │
│   │  │ Store        │  │ Store        │  │ Store   │   │   │
│   │  └──────────────┘  └──────────────┘  └─────────┘   │   │
│   └────────────────────────────────────────────────────┘   │
│                            │                               │
│   ┌────────────────────────────────────────────────────┐   │
│   │            Service Layer                           │   │
│   │                                                    │   │
│   │  ┌──────────────┐  ┌──────────────┐  ┌─────────┐   │   │
│   │  │ API Client   │  │ Function     │  │ Storage │   │   │
│   │  │ Abstraction  │  │ Executor     │  │ Service │   │   │
│   │  └──────────────┘  └──────────────┘  └─────────┘   │   │
│   └────────────────────────────────────────────────────┘   │
│         │                    │                   │         │
│         │              ┌─────▼──────┐            │         │
│         │              │ Web Worker │            │         │
│         │              │ (Sandboxed │            │         │
│         │              │ Execution) │            │         │
│         │              └────────────┘            │         │
│         │                                        │         │
└─────────┼────────────────────────────────────────┼─────────┘
          │                                        │
          ▼                                        ▼
    ┌─────────────┐                        ┌─────────────┐
    │   LLM API   │                        │  IndexedDB  │
    │  Providers  │                        │   (Dexie)   │
    │  (Google,   │                        │ - Convos    │
    │  OpenAI,    │                        │ - Settings  │
    │  etc.)      │                        │ - API Keys  │
    └─────────────┘                        └─────────────┘
```

## Key Architectural Layers

### 1. UI Layer (React Components)

**Responsibility**: User interaction and presentation

**Key Components**:

- **ChatInterface**: Message display, user input, streaming response rendering
- **ParametersPanel**: API parameter controls (responsive: side panel on desktop, modal on mobile)
- **ModelSelector**: Model selection with capability indicators
- **FunctionEditor**: Code editor for function definitions and implementations
- **ConversationManager**: List, create, switch, and manage conversations

**Design Principles**:

- Presentation-container pattern (UI components are purely presentational)
- Responsive design (mobile-first approach)
- Accessibility considerations (ARIA labels, keyboard navigation)

### 2. State Management Layer (Zustand)

**Responsibility**: Application state and business logic

**Three Separate Stores** (separation of concerns):

1. **ConversationStore**: Current conversation state, messages, model selection, parameters
2. **SettingsStore**: Global settings, API keys, defaults, function definitions
3. **UIStore**: Transient UI state (modals, panels, notifications)

**Why Zustand**: Lightweight, excellent TypeScript support, minimal boilerplate, works well with React

**Persistence Strategy**:

- Zustand stores sync to IndexedDB asynchronously (debounced 500ms)
- Optimistic UI updates (update state immediately, persist in background)
- Multi-tab synchronization via BroadcastChannel

### 3. Service Layer

**Responsibility**: Business logic isolated from UI and state

**API Client Abstraction**:

- Provider-agnostic interface (`LLMProvider`)
- Concrete implementations per provider (GoogleAPIClient, OpenAIAPIClient, etc.)
- Uniform streaming support across providers
- Normalized error handling

**Function Executor**:

- Executes user-defined functions in Web Workers (security isolation)
- Timeout mechanisms (default 5s)
- Error boundaries with debugging information
- Controlled access to browser APIs

**Storage Service**:

- Abstracts IndexedDB operations via Dexie.js
- Handles versioning and schema migrations
- Provides import/export functionality
- Fallback to in-memory storage if IndexedDB unavailable

### 4. Data Layer (IndexedDB via Dexie)

**Responsibility**: Persistent storage

**Why IndexedDB over localStorage**:

- Asynchronous (doesn't block UI thread)
- Much larger storage capacity (~100s of MB vs ~5-10 MB)
- Better query performance for large datasets
- Structured data with indexes

**Why Dexie.js**:

- Excellent TypeScript support
- Clean async/await API
- Built-in versioning and migrations
- Better DX than raw IndexedDB

**Schema**: Conversations, Settings, Function Definitions (see DATABASE.md for details)

## Core Architectural Patterns

### Provider Pattern (API Abstraction)

**Problem**: Different LLM providers have different APIs, but we want a consistent interface

**Solution**: Define `LLMProvider` interface; each provider implements it

```typescript
interface LLMProvider {
  name: string;
  models: ModelInfo[];
  chat(request: ChatRequest): Promise<ChatResponse>;
  streamChat(request: ChatRequest): AsyncIterator<StreamChunk>;
  validateKey(apiKey: string): Promise<boolean>;
  getModelCapabilities(modelId: string): ModelCapabilities;
  normalizeError(error: unknown): NormalizedError;
}
```

**Benefits**:

- Add new providers without touching UI code
- Consistent error handling across providers
- Easy to test with mock providers
- Provider-specific features exposed through capabilities

### Repository Pattern (Storage)

**Problem**: Direct coupling to storage mechanism makes testing hard and limits flexibility

**Solution**: StorageService abstracts persistence details

**Benefits**:

- Easy to swap storage mechanisms
- Centralized serialization/deserialization
- Testable with in-memory implementation
- Single source of truth for data access

### Observer Pattern (State Management)

**Problem**: Components need to react to state changes efficiently

**Solution**: Zustand's subscription model with granular selectors

**Benefits**:

- Components only re-render when relevant state changes
- No prop drilling
- Predictable state updates
- Easy to debug state flow

### Sandbox Pattern (Function Execution)

**Problem**: User-provided code could be malicious or block the UI

**Solution**: Execute in Web Worker with restricted global scope and timeout

**Benefits**:

- Security isolation from main application
- No UI blocking (runs on separate thread)
- Controlled API access (whitelist safe APIs)
- Easy to terminate runaway code

## Data Flow

### Primary Chat Flow

```
1. User enters message in ChatInterface
   ↓
2. ChatInterface validates and dispatches to ConversationStore
   ↓
3. ConversationStore adds user message, updates state
   ↓
4. ConversationStore calls API Client with current parameters
   ↓
5. API Client prepares request, calls LLM Provider API (streaming)
   ↓
6. Stream chunks received, processed by ConversationStore
   ↓
7. ChatInterface re-renders with each chunk (debounced to 60fps)
   ↓
8. [If function call detected] → FunctionExecutor (Web Worker)
   ↓
9. Function result added to conversation, sent back to API
   ↓
10. Final response rendered, conversation persisted to IndexedDB
```

### State Persistence Flow

```
State Change (Zustand)
   ↓
Debounce (500ms)
   ↓
StorageService.save()
   ↓
Dexie.put() → IndexedDB
   ↓
BroadcastChannel → notify other tabs
```

## Technology Choices & Rationale

### Core Stack

| Technology         | Purpose            | Why This Choice                                                                      |
| ------------------ | ------------------ | ------------------------------------------------------------------------------------ |
| **React**          | UI framework       | Mature, excellent streaming support (Suspense, Concurrent features), large ecosystem |
| **Vite**           | Build tool         | Fast dev experience, modern features, better than CRA/Webpack for SPAs               |
| **TypeScript**     | Type safety        | Critical for provider abstraction, prevents runtime errors, better DX                |
| **Zustand**        | State management   | Simpler than Redux, better DX than Context API, small bundle size                    |
| **shadcn/ui**      | UI components      | Accessible, customizable, doesn't bloat bundle (copy-paste components)               |
| **Tailwind CSS**   | Styling            | Rapid development, consistent design system, excellent for responsive design         |
| **Dexie.js**       | IndexedDB wrapper  | TypeScript-first, migrations built-in, much better DX than raw IndexedDB             |
| **CodeMirror 6**   | Code editor        | Modern, extensible, better performance than Monaco for our use case                  |
| **react-markdown** | Markdown rendering | Safe (no dangerouslySetInnerHTML), extensible with plugins                           |
| **Zod**            | Runtime validation | TypeScript integration, clear error messages, good for API response validation       |

### Why Client-Only Architecture

**Advantages**:

- Zero infrastructure costs
- Complete user privacy (API keys never leave browser)
- Works offline after initial load
- Simple deployment (static hosting)
- No server maintenance

**Trade-offs**:

- API keys stored in browser (security consideration)
- No cross-device sync (unless user exports/imports)
- Can't do server-side rate limiting
- Limited to browser capabilities

**Mitigation**:

- Clear warnings about API key security
- Export/import for manual sync
- Client-side rate limiting and usage tracking
- Optional backend for advanced features in future (v3.0+)

## Key Design Decisions

### Decision: Multiple Zustand Stores vs. Single Store

**Choice**: Three separate stores (Conversation, Settings, UI)

**Rationale**:

- Separation of concerns (conversation logic separate from UI state)
- Better performance (components subscribe to specific slices)
- Easier testing (test stores independently)
- Clearer mental model (each store has one responsibility)

### Decision: IndexedDB vs. localStorage

**Choice**: IndexedDB from day one (via Dexie)

**Rationale**:

- Async operations don't block UI (critical for smooth streaming)
- 50-100x more storage capacity
- Better performance for large conversations
- Easier migrations with Dexie's version system
- Worth the small complexity increase for long-term benefits

### Decision: Web Workers for Function Execution

**Choice**: Execute user code in dedicated Web Worker

**Rationale**:

- Security: sandboxed execution environment
- Performance: doesn't block main thread/UI
- Safety: easy to terminate with timeout
- Standard approach for untrusted code execution

**Trade-off**: Communication overhead, serialization limitations
**Mitigation**: Structured message passing, clear error messages

### Decision: Provider Abstraction vs. Direct Integration

**Choice**: Abstract provider interface with concrete implementations

**Rationale**:

- Easy to add providers (main product goal)
- Consistent UI regardless of provider
- Testable (mock providers for testing)
- Isolates provider-specific quirks

**Trade-off**: Abstractions can leak, lowest common denominator
**Mitigation**: Provider capabilities system, feature flags for provider-specific features

## Security Considerations

### API Key Storage

- Stored in IndexedDB (accessible to JavaScript)
- Transmitted only over HTTPS
- Clear user warnings about key security
- Future: encryption before storage (v1.1+)

### User-Defined Code Execution

- Runs in Web Worker (isolated from main app)
- Timeout protection (5s default)
- Whitelisted APIs only (no DOM access)
- Structured cloning for data transfer (prevents prototype pollution)

### XSS Prevention

- React's built-in XSS protection
- react-markdown for safe rendering (no dangerouslySetInnerHTML)
- Content Security Policy headers
- Input validation with Zod

See SECURITY.md for comprehensive security documentation.

## Performance Strategy

### Bundle Size Target

- Initial bundle: < 500KB gzipped
- Code splitting by route
- Lazy load heavy components (CodeMirror, Function Editor)
- Tree-shake unused UI components

### Streaming Performance

- Debounce UI updates to 60fps (16ms)
- React.memo for message components
- Virtual scrolling for long conversations (v1.2+)
- RequestAnimationFrame for smooth rendering

### State Update Optimization

- Granular Zustand selectors (minimize re-renders)
- Immer for immutable updates (built into Zustand)
- Debounced persistence (500ms)
- Optimistic UI updates

## Testing Approach

**Unit Tests** (Vitest):

- Zustand stores (state transitions, edge cases)
- API clients (request formatting, error handling)
- Utility functions (token counting, validation)

**Integration Tests** (Vitest + Testing Library):

- Complete chat flows
- Function calling workflow
- Import/export round trips

**E2E Tests** (Playwright, v1.2+):

- Critical user journeys
- Cross-browser compatibility
- Responsive behavior

See TESTING.md for detailed testing strategy.

## Deployment

**Platform**: Vercel (primary), Netlify (alternative)

**Why**: Zero-config SPA hosting, global CDN, automatic HTTPS, preview deployments for PRs

**CI/CD**: GitHub Actions

1. Lint & type check
2. Run tests
3. Build
4. Deploy (preview for PRs, production for main branch)

**Configuration**:

- SPA fallback (all routes → index.html)
- Cache headers for static assets
- CSP headers for security

## Project Structure

```
src/
├── components/         # React components (UI layer)
├── stores/            # Zustand stores (state layer)
├── services/          # Business logic (service layer)
│   ├── api/          # Provider implementations
│   ├── storage.ts    # Storage service
│   └── executor.ts   # Function executor
├── db/               # Database schema (Dexie)
├── workers/          # Web Workers
├── types/            # TypeScript definitions
├── hooks/            # Custom React hooks
├── utils/            # Utility functions
├── config/           # Configuration & feature flags
└── lib/              # Third-party setup
```

See CODE_ORGANIZATION.md for detailed structure and naming conventions.

## Evolution & Extensibility

### Adding a New LLM Provider

1. Create `src/services/api/[provider].ts` implementing `LLMProvider` interface
2. Add provider configuration to `src/lib/providers/`
3. Update model selector to include new models
4. Add provider-specific types if needed
5. Test with mock API responses

**No UI changes required** - that's the power of the abstraction!

### Adding a New Parameter

1. Update `ModelParameters` type in `src/types/`
2. Add control to `ParametersPanel` component
3. Update provider implementations to include in API request
4. Update default parameters in `SettingsStore`

### Scaling Considerations

**When to introduce a backend** (v3.0+):

- Multi-device sync requirement
- Centralized API key management
- Usage analytics
- Collaborative features

**Current architecture supports**:

- 1000s of saved conversations
- Real-time streaming from any provider
- Complex function calling workflows
- Multi-tab usage

## Related Documentation

- **IMPLEMENTATION_GUIDE.md** - Week-by-week development roadmap
- **API_DESIGN.md** - Complete TypeScript interfaces and contracts
- **DATABASE.md** - IndexedDB schema and migration strategy
- **SECURITY.md** - Security considerations and best practices
- **ERROR_HANDLING.md** - Error classification and recovery strategies
- **TESTING.md** - Comprehensive testing strategy
- **CONTRIBUTING.md** - Development setup and contribution guidelines

---

**Document Maintenance**: This architecture document should be updated whenever major architectural decisions are made or core patterns change. For implementation details, code examples, and procedural information, see the related documents above.
