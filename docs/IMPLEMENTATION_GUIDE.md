# Implementation Guide

## Purpose

This guide provides a practical roadmap for building the LLM API Playground incrementally. It's designed to enable:

- **Atomic changes**: Each task is self-contained and independently deployable
- **Parallel development**: Multiple developers can work without conflicts
- **Progressive delivery**: Ship working features continuously
- **Clear milestones**: Know when you've achieved each goal

## Development Principles

### 1. Atomic Changes

- Each PR should be < 400 lines (excluding generated/test files)
- Single concern per PR (one feature, one fix, one refactor)
- Always maintain a working main branch
- Use feature flags for incomplete features

### 2. Vertical Slices

Build complete user-facing features end-to-end rather than horizontal layers:

- ❌ Bad: "Implement all Zustand stores" → nothing works
- ✅ Good: "Basic chat with one model" → users can chat immediately

### 3. Testable Milestones

Each milestone has clear acceptance criteria that can be tested.

### 4. Mock-First Development

Use mock data and responses to develop UI independently of API integration.

## MVP Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

**Goal**: Infrastructure and core services working

#### Milestone 1.1: Project Setup

**Tasks**:

- [x] Initialize Vite + React + TypeScript project
- [x] Configure Tailwind CSS
- [x] Setup ESLint + Prettier
- [x] Configure path aliases (`@/`)
- [x] Add basic CI (lint + type check)

**Acceptance Criteria**:

- `npm run dev` starts dev server
- `npm run build` creates production build
- `npm run lint` passes
- GitHub Actions run on PR

**Estimated Time**: 1 day

---

#### Milestone 1.2: Database Layer

**Tasks**:

- [x] Install and configure Dexie.js
- [x] Define database schema (`src/db/schema.ts`)
- [x] Create basic CRUD operations
- [x] Write unit tests for database operations

**Acceptance Criteria**:

- Can create/read/update/delete conversations in IndexedDB
- Settings persist across page refreshes
- Tests verify CRUD operations work
- Fallback to in-memory storage if IndexedDB unavailable

**Estimated Time**: 2 days

---

#### Milestone 1.3: State Management Setup

**Tasks**:

- [x] Install Zustand
- [x] Create ConversationStore skeleton with types
- [x] Create SettingsStore skeleton with types
- [x] Create UIStore skeleton with types
- [x] Connect stores to Dexie persistence
- [x] Write unit tests for stores

**Acceptance Criteria**:

- Stores can be imported and used
- State updates trigger re-renders
- State persists to IndexedDB
- Tests verify state transitions

**Estimated Time**: 2 days

**Files to Create**:

```
src/stores/conversation.ts
src/stores/settings.ts
src/stores/ui.ts
src/stores/conversation.test.ts
src/stores/settings.test.ts
```

---

#### Milestone 1.4: Provider Abstraction

**Tasks**:

- [x] Define `LLMProvider` interface (`src/types/provider.ts`)
- [x] Define request/response types
- [x] Create GoogleAPIClient skeleton
- [x] Implement API key validation
- [x] Implement basic chat (non-streaming first)
- [x] Add error normalization
- [x] Write unit tests with mocked fetch

**Acceptance Criteria**:

- GoogleAPIClient implements LLMProvider interface
- Can validate API key (with mock)
- Can send chat request and receive response (with mock)
- Errors are normalized consistently
- Tests cover success and error cases

**Estimated Time**: 3 days

**Files to Create**:

```
src/types/provider.ts
src/types/conversation.ts
src/services/api/base.ts
src/services/api/google.ts
src/services/api/google.test.ts
```

---

### Phase 2: Core Chat Experience (Week 3-4)

**Goal**: Users can chat with one model

#### Milestone 2.1: Basic UI Components

**Tasks**:

- [x] Setup shadcn/ui
- [x] Create Message component (user + model variants)
- [x] Create MessageList component
- [x] Create ChatInput component
- [x] Add basic styling with Tailwind
- [x] Create Storybook stories (optional but recommended)

**Acceptance Criteria**:

- Messages render correctly with mock data
- User can type in input (not yet functional)
- UI is responsive on mobile and desktop
- Components are visually polished

**Estimated Time**: 3 days

**Files to Create**:

```
src/components/chat/Message.tsx
src/components/chat/MessageList.tsx
src/components/chat/ChatInput.tsx
src/components/chat/ChatInterface.tsx
```

---

#### Milestone 2.2: Chat Flow Integration

**Tasks**:

- [x] Connect ChatInput to ConversationStore
- [x] Implement send message action
- [x] Display messages from store
- [x] Add loading state while waiting for response
- [x] Handle errors and display to user
- [x] Add simple toast notification system

**Acceptance Criteria**:

- User can type and send a message
- Message appears in conversation
- API is called (verify in Network tab)
- Response appears in conversation
- Errors show toast notification
- **End-to-end: User can have a basic conversation**

**Estimated Time**: 3 days

**Integration Test Required**: Full chat flow

---

#### Milestone 2.3: Streaming Support

**Tasks**:

- [x] Update GoogleAPIClient for streaming
- [x] Update ConversationStore to handle chunks
- [x] Update MessageList for incremental rendering
- [x] Debounce renders to 60fps
- [x] Add "streaming" indicator
- [x] Optimize re-renders with React.memo

**Acceptance Criteria**:

- Response streams in token by token
- UI remains smooth (no jank)
- Streaming indicator shows while active
- Performance: maintains 60fps during streaming

**Estimated Time**: 2 days

**Performance Test Required**: Stream 1000 tokens, verify smooth rendering

---

### Phase 3: Parameter Control (Week 5)

**Goal**: Users can adjust model parameters

#### Milestone 3.1: Model Selection

**Tasks**:

- [x] Create ModelSelector component
- [x] Fetch available models from provider
- [x] Display model metadata (context window, etc.)
- [x] Connect to ConversationStore
- [x] Validate API key on model selection
- [x] Handle API key errors gracefully

**Acceptance Criteria**:

- User can select from available models
- Model metadata displays without disrupting UI
- Invalid API key shows clear error
- Selected model persists in conversation

**Estimated Time**: 2 days

**Files to Create**:

```
src/components/model/ModelSelector.tsx
```

---

#### Milestone 3.2: Parameters Panel

**Tasks**:

- [ ] Create ParametersPanel component
- [ ] Add parameter controls (sliders, inputs):
  - Temperature
  - Max tokens
  - Top-P
  - Top-K
- [ ] Implement responsive layout (side panel / modal)
- [ ] Add tooltips with parameter explanations
- [ ] Connect to SettingsStore
- [ ] Persist parameter changes

**Acceptance Criteria**:

- Desktop: side panel visible
- Mobile: modal overlay triggered by button
- Parameter changes update in real-time
- Tooltips explain each parameter
- Parameters persist per conversation

**Estimated Time**: 3 days

**Files to Create**:

```
src/components/parameters/ParametersPanel.tsx
src/components/parameters/ParameterControl.tsx
```

---

### Phase 4: Conversation Management (Week 6)

**Goal**: Users can manage multiple conversations

#### Milestone 4.1: Conversation List

**Tasks**:

- [ ] Create ConversationList component
- [ ] Display all saved conversations
- [ ] Show conversation title, last updated, model
- [ ] Implement conversation switching
- [ ] Add "new conversation" button
- [ ] Responsive layout (sidebar / bottom sheet)

**Acceptance Criteria**:

- All conversations load from IndexedDB
- Click conversation to switch to it
- "New" button creates empty conversation
- List updates when conversations change
- Works on mobile and desktop

**Estimated Time**: 2 days

**Files to Create**:

```
src/components/conversations/ConversationList.tsx
src/components/conversations/ConversationItem.tsx
```

---

#### Milestone 4.2: Conversation Operations

**Tasks**:

- [ ] Add rename conversation
- [ ] Add delete conversation (with confirmation)
- [ ] Add duplicate conversation
- [ ] Implement auto-title generation (from first message)
- [ ] Add conversation metadata (created, updated)

**Acceptance Criteria**:

- User can rename any conversation
- Delete shows confirmation dialog
- Duplicate creates exact copy
- New conversations auto-generate title after first exchange
- Metadata displays correctly

**Estimated Time**: 2 days

---

#### Milestone 4.3: Message Operations

**Tasks**:

- [ ] Add edit message functionality
- [ ] Add retry message functionality
- [ ] Add delete message functionality
- [ ] Update conversation on message changes
- [ ] Handle edge cases (edit middle message, etc.)

**Acceptance Criteria**:

- Edit message: conversation continues from edit point
- Retry: resends message with same parameters
- Delete: removes message and all following
- All operations update IndexedDB
- **End-to-end: User can edit and retry messages**

**Estimated Time**: 2 days

---

### Phase 5: Polish & Stability (Week 7-8)

**Goal**: Production-ready MVP

#### Milestone 5.1: Error Handling

**Tasks**:

- [ ] Implement error classification system
- [ ] Add rate limit detection and handling
- [ ] Add retry logic with exponential backoff
- [ ] Improve error messages (user-friendly)
- [ ] Add error recovery UI (retry buttons)
- [ ] Handle network offline/online

**Acceptance Criteria**:

- Rate limit: user sees wait time, auto-retries
- Network error: clear message + retry button
- Auth error: prompts to check API key
- All errors logged to console in dev mode

**Estimated Time**: 2 days

**Files to Create**:

```
src/utils/error-handling.ts
src/services/rate-limiter.ts
```

---

#### Milestone 5.2: Import/Export

**Tasks**:

- [ ] Implement configuration export (JSON)
- [ ] Implement configuration import with validation
- [ ] Implement conversation export (JSON)
- [ ] Add error handling for corrupted imports
- [ ] Add UI for import/export actions

**Acceptance Criteria**:

- Export creates valid JSON file
- Import validates and loads configuration
- Conversation export includes all messages
- Corrupted files show clear error
- **End-to-end: Export → modify file → import works**

**Estimated Time**: 2 days

**Files to Create**:

```
src/services/import-export.ts
src/components/settings/ImportExport.tsx
```

---

#### Milestone 5.3: System Prompts

**Tasks**:

- [ ] Add system prompt textarea in parameters panel
- [ ] Add token counter for system prompt
- [ ] Connect to ConversationStore
- [ ] Include in API requests
- [ ] Persist per conversation

**Acceptance Criteria**:

- User can enter system prompt
- Token counter updates in real-time
- System prompt affects conversation behavior
- Persists across page refresh

**Estimated Time**: 1 day

---

#### Milestone 5.4: Testing & Bug Fixes

**Tasks**:

- [ ] Write integration tests for critical paths
- [ ] Cross-browser testing (Chrome, Firefox, Safari)
- [ ] Mobile testing (iOS Safari, Chrome Android)
- [ ] Performance audit with Lighthouse
- [ ] Fix all critical and high-priority bugs
- [ ] Add error boundaries for crash recovery

**Acceptance Criteria**:

- Integration tests cover: chat flow, conversation management, import/export
- Works on all target browsers
- Lighthouse score > 90 on all metrics
- No critical bugs remain
- App doesn't crash on errors

**Estimated Time**: 3 days

---

## Feature Flags

Use feature flags to ship incomplete features safely:

```typescript
// src/config/features.ts
export const features = {
  // Implemented features
  streamingChat: true,
  conversationManagement: true,
  parameterControls: true,

  // Work in progress (hidden from users)
  functionCalling: false,
  visionInput: false,
  multiProvider: false,

  // Development helpers
  debugMode: import.meta.env.DEV,
  mockAPI: import.meta.env.VITE_MOCK_API === "true",
};
```

Usage in components:

```typescript
{features.functionCalling && <FunctionEditor />}
```

## Parallel Development Tracks

Multiple developers can work simultaneously:

### Track A: UI Components

- Chat interface
- Parameters panel
- Model selector
- Conversation list
- Settings modal

### Track B: Core Services

- Provider implementations
- Storage service
- Error handling
- Rate limiting

### Track C: State Management

- Zustand stores
- Persistence logic
- Store tests

### Track D: Infrastructure

- Build config
- Testing setup
- CI/CD pipeline
- Documentation

**Coordination**: Use clearly named branches and keep PRs small to minimize merge conflicts.

## Git Workflow

### Branch Naming

```
feat/chat-interface-basic
feat/streaming-support
feat/parameters-panel
fix/message-edit-bug
refactor/api-client-types
test/conversation-store
docs/setup-instructions
```

### Commit Messages

Follow conventional commits:

```
feat: add basic chat interface with message list
feat(streaming): implement real-time response rendering
fix(chat): prevent duplicate messages on retry
refactor(api): extract common error handling
test(store): add unit tests for conversation operations
docs(readme): update setup instructions with API key info
```

### Pull Request Guidelines

- **Size**: Max 400 lines changed (excluding generated files)
- **Scope**: Single feature or fix
- **Tests**: All new code has tests
- **Documentation**: Update relevant docs
- **Review**: At least one approval required
- **CI**: All checks must pass

### PR Template

```markdown
## What

Brief description of changes

## Why

Problem being solved or feature being added

## How

High-level approach

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manually tested in browser
- [ ] Works on mobile

## Screenshots (if UI change)

[Add screenshots]

## Checklist

- [ ] Code follows style guidelines
- [ ] Tests pass locally
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
```

## Testing Strategy

### Unit Tests (Vitest)

- **What**: Individual functions, stores, utilities
- **When**: Write alongside feature
- **Coverage target**: >80%

### Integration Tests (Vitest + Testing Library)

- **What**: Complete user flows
- **When**: After milestone completion
- **Key flows**: Chat, conversation management, import/export

### E2E Tests (Playwright, Phase 5+)

- **What**: Critical user journeys
- **When**: Before production deployment
- **Scenarios**: First-time setup, typical usage, error recovery

### Manual Testing Checklist

Before each release:

- [ ] Chat flow works on Chrome, Firefox, Safari
- [ ] Mobile experience works on iOS and Android
- [ ] Error handling works (disconnect network, invalid API key)
- [ ] Import/export round trip works
- [ ] Performance is smooth (no jank during streaming)

## Deployment Strategy

### Environments

- **Development**: Local (`npm run dev`)
- **Preview**: Vercel preview deployments (automatic for PRs)
- **Production**: Vercel production (automatic on main branch merge)

### Continuous Deployment

Every merge to `main` deploys to production because:

- All features behind feature flags
- All PRs tested in preview environment
- Atomic changes mean low risk
- Fast feedback loop

### Rollback Strategy

If production issue detected:

1. Revert the problematic commit
2. Push to main (auto-deploys)
3. Fix issue in new PR
4. Deploy fix

## Definition of Done

A feature is "done" when:

- [ ] Code is written and reviewed
- [ ] Unit tests pass with good coverage
- [ ] Integration test exists for user flow
- [ ] Works in all target browsers
- [ ] Works on mobile devices
- [ ] Documentation updated
- [ ] No accessibility violations
- [ ] Performance is acceptable
- [ ] Deployed to production
- [ ] Verified working in production

## Troubleshooting Common Issues

### "IndexedDB not working in incognito mode"

Expected behavior. Fallback to in-memory storage. Show user warning.

### "State not persisting"

Check: Debounce working? IndexedDB quota? Browser compatibility?

### "Streaming is janky"

Check: Debounce to 60fps? React.memo on components? Too many re-renders?

### "Tests failing in CI but passing locally"

Check: Environment variables? Timezone differences? Race conditions?

## Next Steps After MVP

Once MVP is complete (all Phase 1-5 milestones done):

### v1.1 - Enhanced Features

- Function calling with code editor
- Advanced error handling
- Request/response inspection
- Better mobile experience

### v1.2 - Polish

- Parameter presets
- Conversation search
- Cost tracking
- Performance optimizations

### v2.0 - Multi-Provider

- OpenAI support
- Anthropic support
- Provider comparison
- Vision inputs

See ROADMAP.md for detailed future planning.

---

**Remember**: The goal is continuous delivery of value. Ship small, ship often, get feedback early!
