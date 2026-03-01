# Implementation Guide — Function Calling

## Purpose

This guide covers the implementation of **function calling** (tool use) as the next major feature phase after the MVP. Function calling lets users define JavaScript functions, attach them to conversations, and watch the model invoke them during chat — making the playground a true API experimentation tool rather than just a chat wrapper.

## Scope

This phase focuses exclusively on:

- Defining, editing, and managing user-created functions
- Sandboxed execution of user code in a Web Worker
- Wiring function declarations into provider API requests
- Handling function-call / function-result turn loops in chat
- UI for the full function calling workflow

Out of scope (deferred):

- Multi-provider support (OpenAI, Anthropic)
- Provider abstraction refactoring
- Vision/multimodal inputs
- Cost tracking, parameter presets, conversation search

## What Already Exists

The MVP laid significant groundwork:

| Layer                  | What exists                                                                                           | Status             |
| ---------------------- | ----------------------------------------------------------------------------------------------------- | ------------------ |
| **Types**              | `FunctionDefinition`, `FunctionCall`, `FunctionResult`, `JSONSchema` in `src/types/`                  | Complete           |
| **DB**                 | `functions` table in Dexie schema, full CRUD in `src/db/operations.ts`                                | Complete           |
| **Provider types**     | `ChatRequest.functions`, `StreamChunk.functionCall`, `FinishReason = "function_call"`                 | Defined but unused |
| **Model capabilities** | `ModelInfo.capabilities.functionCalling` boolean per model                                            | Complete           |
| **UI indicator**       | `ModelDetails` component shows function calling capability badge                                      | Complete           |
| **Google SDK**         | `@google/genai` supports `tools`, `FunctionDeclaration`, `FunctionCall`, `FunctionResponse` in `Part` | Available          |

What does **not** exist:

- No function management store or UI
- No code editor component
- No Web Worker sandbox (`src/workers/` directory missing)
- No function call detection in streaming/chat responses
- No function-result turn injection into conversation
- No feature flags system

## Development Principles

Same as MVP — atomic changes, vertical slices, testable milestones, < 400 lines per PR.

---

## Implementation Roadmap

### Phase 1: Infrastructure (Week 1)

**Goal**: Function management store, code editor, and sandbox execution engine

---

#### Milestone 1.1: Feature Flags

**Tasks**:

- [x] Create `src/config/features.ts` with feature flag definitions
- [x] Add `functionCalling` flag (default: `false` during development, `true` when complete)
- [x] Use flags to conditionally render function calling UI throughout the app

**Acceptance Criteria**:

- Feature flags can be imported and checked anywhere
- `features.functionCalling` gates all new function calling UI
- `features.debugMode` is `true` in dev, `false` in production

**Estimated Time**: 0.5 days

**Files to Create**:

```
src/config/features.ts
```

---

#### Milestone 1.2: Function Store

**Tasks**:

- [x] Create `src/stores/functions.ts` Zustand store
- [x] Implement state: `functions`, `isLoading`, `error`
- [x] Implement actions: `loadFunctions`, `createFunction`, `updateFunction`, `deleteFunction`, `getFunction`
- [x] Connect to existing Dexie `functions` CRUD operations
- [x] Wire function attachment to conversations (add `functionIds: string[]` field to `Conversation` type)
- [x] Write unit tests for the store

**Acceptance Criteria**:

- Functions persist to IndexedDB and reload on app start
- CRUD operations work and update UI reactively
- Conversations can reference attached function IDs
- Tests verify all state transitions

**Estimated Time**: 1.5 days

**Files to Create**:

```
src/stores/functions.ts
src/stores/__tests__/functions.test.ts
```

**Files to Modify**:

```
src/types/schema.ts        (add functionIds to Conversation)
src/stores/index.ts        (export new store)
```

---

#### Milestone 1.3: Web Worker Sandbox

**Tasks**:

- [x] Create `src/workers/functionExecutor.worker.ts` Web Worker
- [x] Implement sandboxed execution environment:
  - Restricted global scope (no `document`, `window`, `fetch` by default)
  - Configurable API whitelist (`allowedAPIs` from `FunctionDefinition`)
  - Timeout enforcement (default 5s, configurable per function)
- [x] Create `src/services/executor.ts` manager class:
  - `execute(func, args, options)` — run function, return result
  - `validate(code)` — syntax check without execution
  - `terminate()` — kill running worker
- [x] Handle structured cloning for data transfer
- [x] Write unit tests for executor and worker

**Acceptance Criteria**:

- User code runs in isolated Web Worker (no DOM access)
- Functions that exceed timeout are terminated with clear error
- `validate()` catches syntax errors before execution
- Malicious code (infinite loops, memory bombs) is contained
- Tests cover success, timeout, syntax error, and runtime error cases

**Estimated Time**: 2.5 days

**Files to Create**:

```
src/workers/functionExecutor.worker.ts
src/services/executor.ts
src/services/__tests__/executor.test.ts
```

**Vite Config Change**:

```
vite.config.ts    (add worker plugin config if needed)
```

---

#### Milestone 1.4: Code Editor Integration

**Tasks**:

- [x] Install CodeMirror 6 (`@codemirror/view`, `@codemirror/state`, `@codemirror/lang-javascript`, `@codemirror/theme-one-dark`)
- [x] Create `src/components/chat/functions/CodeEditor.tsx` wrapper component
- [x] Support JavaScript/TypeScript syntax highlighting
- [x] Support light/dark theme (connected to app theme preference)
- [x] Add basic editor features: line numbers, bracket matching, auto-indent
- [x] Lazy-load CodeMirror (dynamic import) to avoid bundle bloat

**Acceptance Criteria**:

- Editor renders with syntax highlighting
- Theme switches with app theme
- Editor is lazy-loaded (not in initial bundle)
- Component is reusable for function implementation editing

**Estimated Time**: 1.5 days

**Files to Create**:

```
src/components/chat/functions/CodeEditor.tsx
```

---

### Phase 2: Function Management UI (Week 2)

**Goal**: Users can create, edit, and manage function definitions

---

#### Milestone 2.1: Function Definition Form

**Tasks**:

- [x] Create `src/components/chat/functions/FunctionForm.tsx`
  - Name input (validated: `a-z`, `A-Z`, `0-9`, `_`, `.`, `-`, max 64 chars)
  - Description textarea
  - Parameter schema builder (visual JSON Schema editor)
  - Implementation code editor (CodeMirror)
  - Timeout setting
- [x] Create `src/components/chat/functions/ParameterSchemaEditor.tsx`
  - Add/remove parameters
  - Set name, type (`string`, `number`, `boolean`, `array`, `object`), description
  - Mark required/optional
  - Nested object support (v1.1 stretch goal — keep flat for now)
- [x] Validate form before save (name uniqueness, valid schema, syntax check on implementation)
- [x] Connect to function store for create/update

**Acceptance Criteria**:

- User can fill out all function fields
- Validation prevents invalid function names and malformed schemas
- Code editor validates syntax on blur
- Saving persists to IndexedDB
- Form works for both create and edit modes

**Estimated Time**: 3 days

**Files to Create**:

```
src/components/chat/functions/FunctionForm.tsx
src/components/chat/functions/ParameterSchemaEditor.tsx
```

---

#### Milestone 2.2: Function List & Management Panel

**Tasks**:

- [ ] Create `src/components/chat/functions/FunctionList.tsx`
  - Lists all saved functions with name, description, parameter count
  - Edit button → opens FunctionForm in edit mode
  - Delete button → confirmation dialog
  - "New Function" button
- [ ] Create `src/components/chat/functions/FunctionPanel.tsx`
  - Container component for function management
  - Tab or section within the chat settings area
  - Responsive: side panel on desktop, sheet/drawer on mobile
- [ ] Add "Functions" tab to `ChatSettings` or `SettingsModal`
- [ ] Wire up to function store

**Acceptance Criteria**:

- User can see all saved functions
- Can create new functions from the panel
- Can edit existing functions
- Can delete functions (with confirmation)
- Panel integrates naturally with existing settings UI

**Estimated Time**: 2 days

**Files to Create**:

```
src/components/chat/functions/FunctionList.tsx
src/components/chat/functions/FunctionPanel.tsx
src/components/chat/functions/index.ts
```

**Files to Modify**:

```
src/components/chat/settings/ChatSettings.tsx    (add Functions tab/section)
```

---

#### Milestone 2.3: Function Test Runner

**Tasks**:

- [ ] Create `src/components/chat/functions/FunctionTestRunner.tsx`
  - Input fields generated from parameter schema
  - "Run" button to execute function via executor service
  - Output display (result or error)
  - Execution time display
- [ ] Integrate into `FunctionForm` as a "Test" tab/section
- [ ] Show console output from worker (via message passing)

**Acceptance Criteria**:

- User can test function without sending a chat message
- Input fields match the function's parameter schema
- Result displays as formatted JSON
- Errors display with clear context
- Execution time visible

**Estimated Time**: 1.5 days

**Files to Create**:

```
src/components/chat/functions/FunctionTestRunner.tsx
```

---

### Phase 3: Provider Integration (Week 3)

**Goal**: Function declarations sent to the API, function calls detected and executed

---

#### Milestone 3.1: Google API — Function Declaration Mapping

**Tasks**:

- [ ] Create `src/services/api/functionMapping.ts`
  - Map `FunctionDefinition` → Google SDK `FunctionDeclaration`
  - Map `JSONSchema` → Google SDK `Schema` format
  - Map `FunctionResult` → Google SDK `FunctionResponse`
- [ ] Update `GoogleAPIClient.chat()` to include `tools` in config when functions are provided
- [ ] Update `GoogleAPIClient.streamChat()` to include `tools` in config
- [ ] Add function calling mode support (`AUTO`, `ANY`, `NONE`) to `ChatRequest`
- [ ] Write unit tests for all mapping functions

**Acceptance Criteria**:

- `FunctionDefinition` correctly maps to Google's `FunctionDeclaration` format
- `tools` config is included in API requests when functions are attached
- Non-function-calling conversations are unaffected
- Tests verify mapping correctness for various schema types

**Estimated Time**: 1.5 days

**Files to Create**:

```
src/services/api/functionMapping.ts
src/services/api/__tests__/functionMapping.test.ts
```

**Files to Modify**:

```
src/services/api/google.ts          (include tools in chat/streamChat config)
src/types/provider.ts               (add functionCallingMode to ChatRequest)
```

---

#### Milestone 3.2: Function Call Detection in Streaming

**Tasks**:

- [ ] Update `GoogleAPIClient.streamChat()` to detect `functionCall` parts in chunks
- [ ] Yield `StreamChunk` with `functionCall` data when model requests a function call
- [ ] Handle `finishReason: "function_call"` to signal the model wants tool use
- [ ] Update `GoogleAPIClient.chat()` similarly for non-streaming
- [ ] Map Google's `FunctionCall` (with `args`) to our `FunctionCall` (with `arguments`)

**Acceptance Criteria**:

- When model returns a function call, `StreamChunk.functionCall` is populated
- `finishReason` is correctly set to `"function_call"`
- Text content and function calls in the same response are both captured
- Non-function responses are unaffected

**Estimated Time**: 1.5 days

**Files to Modify**:

```
src/services/api/google.ts
```

---

#### Milestone 3.3: Function Call Execution Loop in Chat Service

**Tasks**:

- [ ] Update `ChatService.executeChat()` to detect function call finish reason
- [ ] When function call detected:
  1. Pause streaming
  2. Look up `FunctionDefinition` by name from the attached functions
  3. Execute function via `FunctionExecutor`
  4. Create `FunctionResult` message
  5. Send function result back to API as next turn
  6. Resume streaming with model's final response
- [ ] Handle multi-turn function calls (model may call multiple functions sequentially)
- [ ] Handle execution errors gracefully (send error as function result)
- [ ] Add new callbacks: `onFunctionCall`, `onFunctionResult` to `ChatCallbacks`
- [ ] Update `ChatRequest` in chat service to accept functions

**Acceptance Criteria**:

- Model's function call triggers automatic execution
- Function result is sent back to the model
- Model's response after function result renders normally
- Execution errors are sent back as error results (model can retry or explain)
- Multi-turn function calling works (model calls function A, then function B)
- User can see function calls and results in the conversation

**Estimated Time**: 3 days

**Files to Modify**:

```
src/services/chat.ts
```

---

#### Milestone 3.4: Conversation Store Integration

**Tasks**:

- [ ] Update `chatSlice.sendMessage()` to include attached functions in chat request
- [ ] Add function call messages to conversation (role: `"model"`, with `functionCall` field)
- [ ] Add function result messages to conversation (role: `"user"`, with `functionResult` field, auto-generated)
- [ ] Update `chatSlice.executeChat()` to handle new `onFunctionCall` and `onFunctionResult` callbacks
- [ ] Persist function call/result messages to IndexedDB
- [ ] Handle function attachment per conversation (load attached function definitions)

**Acceptance Criteria**:

- Function calls and results appear as messages in the conversation
- Conversations with function calls persist and reload correctly
- Attached functions survive page refresh
- Editing/retrying messages before a function call correctly replays

**Estimated Time**: 2 days

**Files to Modify**:

```
src/stores/conversation/chatSlice.ts
src/stores/conversation/types.ts
```

---

### Phase 4: Chat UI for Function Calling (Week 4)

**Goal**: Function calls and results are visible and interactive in the chat

---

#### Milestone 4.1: Function Call Message Display

**Tasks**:

- [ ] Create `src/components/chat/message/FunctionCallDisplay.tsx`
  - Shows function name and arguments in a styled card
  - Expandable/collapsible argument details
  - Visual indicator (icon, color) to distinguish from text messages
- [ ] Create `src/components/chat/message/FunctionResultDisplay.tsx`
  - Shows function name and result
  - Format result as JSON with syntax highlighting
  - Show error state if function failed
  - Show execution time
- [ ] Update `Message` component to render function call/result variants
- [ ] Style function messages distinctly from user/model text messages

**Acceptance Criteria**:

- Function call messages display function name + arguments clearly
- Function result messages display result or error
- Messages are visually distinct (users can immediately identify function turns)
- Long arguments/results are collapsible

**Estimated Time**: 2 days

**Files to Create**:

```
src/components/chat/message/FunctionCallDisplay.tsx
src/components/chat/message/FunctionResultDisplay.tsx
```

**Files to Modify**:

```
src/components/chat/message/Message.tsx     (render new display components)
```

---

#### Milestone 4.2: Function Attachment UI

**Tasks**:

- [ ] Create `src/components/chat/functions/FunctionAttachmentBar.tsx`
  - Shows which functions are attached to the current conversation
  - Toggle functions on/off per conversation
  - Quick link to create new function
  - Badge count in chat header
- [ ] Add function attachment controls to `ChatSettings` panel
  - Checklist of available functions to attach
  - Function calling mode selector (`Auto`, `Required`, `None`)
- [ ] Update `ChatHeader` to show function count indicator
- [ ] Connect to conversation store (function IDs per conversation)

**Acceptance Criteria**:

- User can attach/detach functions to a conversation
- Attached functions are visually indicated in the chat header
- Function calling mode can be set per conversation
- Attachments persist across page refresh

**Estimated Time**: 2 days

**Files to Create**:

```
src/components/chat/functions/FunctionAttachmentBar.tsx
```

**Files to Modify**:

```
src/components/chat/settings/ChatSettings.tsx   (add function attachment section)
src/components/chat/layout/ChatHeader.tsx        (add function indicator)
```

---

#### Milestone 4.3: Function Execution Status UI

**Tasks**:

- [ ] Show "Executing function..." indicator during function execution
- [ ] Show execution progress/status in the message area
- [ ] Add "Cancel" button to abort function execution
- [ ] Handle timeout visually (show timeout error inline)
- [ ] Animate function call → execution → result flow

**Acceptance Criteria**:

- User sees clear status during function execution
- Can cancel a running function
- Timeout errors display inline with context
- The function call → result transition feels smooth and understandable

**Estimated Time**: 1.5 days

**Files to Modify**:

```
src/components/chat/message/FunctionCallDisplay.tsx
src/components/chat/message/FunctionResultDisplay.tsx
src/components/chat/message/MessageList.tsx
```

---

### Phase 5: Testing & Polish (Week 5)

**Goal**: Robust, tested, production-ready function calling

---

#### Milestone 5.1: Example Functions & Templates

**Tasks**:

- [ ] Create `src/lib/functionTemplates.ts` with built-in example functions:
  - `getCurrentWeather(location)` — returns mock weather data
  - `calculateExpression(expression)` — evaluates math expressions
  - `searchDatabase(query)` — returns mock search results
  - `formatDate(date, format)` — date formatting utility
- [ ] Add "Templates" section to `FunctionPanel`
- [ ] One-click import of template functions
- [ ] Include helpful comments in template implementations

**Acceptance Criteria**:

- User can browse pre-built function templates
- One-click import creates a new function from template
- Templates serve as learning examples
- All templates work correctly when tested

**Estimated Time**: 1 day

**Files to Create**:

```
src/lib/functionTemplates.ts
```

**Files to Modify**:

```
src/components/chat/functions/FunctionPanel.tsx  (add templates section)
```

---

#### Milestone 5.2: Import/Export Updates

**Tasks**:

- [ ] Update `exportData()` to include functions
- [ ] Update `importData()` to handle functions (merge, not overwrite)
- [ ] Validate imported function definitions with Zod schema
- [ ] Handle conversations with function references to missing functions

**Acceptance Criteria**:

- Export includes all function definitions
- Import merges functions (doesn't delete existing)
- Invalid function definitions are rejected with clear error
- Conversations referencing deleted functions degrade gracefully

**Estimated Time**: 1 day

**Files to Modify**:

```
src/services/importExport.ts
```

---

#### Milestone 5.3: Integration Tests

**Tasks**:

- [ ] Write integration test: full function calling flow
  - Create function → attach to conversation → send message → model calls function → result sent back → model responds
- [ ] Write integration test: function management lifecycle
  - Create → edit → test → duplicate → delete
- [ ] Write integration test: error handling
  - Function timeout, runtime error, missing function
- [ ] Write integration test: conversation persistence with function calls
  - Function call messages persist and reload correctly
- [ ] Update existing chat integration tests to verify function calling doesn't break normal chat

**Acceptance Criteria**:

- All integration tests pass
- Normal chat flow unaffected by function calling changes
- Edge cases covered (timeout, errors, missing functions)
- Function call messages in persisted conversations render correctly on reload

**Estimated Time**: 2 days

**Files to Create**:

```
src/components/chat/__tests__/FunctionCalling.test.tsx
src/components/chat/__tests__/FunctionManagement.test.tsx
src/services/__tests__/executor.integration.test.ts
```

---

#### Milestone 5.4: Error Handling & Edge Cases

**Tasks**:

- [ ] Handle model calling a function that isn't attached (graceful error)
- [ ] Handle model calling a function with wrong arguments (type mismatch)
- [ ] Handle Web Worker crash/unresponsive state
- [ ] Handle concurrent function executions (queue or reject)
- [ ] Add error boundaries around function-related components
- [ ] Handle large function results (truncation, scrolling)
- [ ] Verify function calling works with all Gemini models that support it

**Acceptance Criteria**:

- No unhandled errors — every failure path shows a user-friendly message
- Worker crashes don't break the app
- Large results don't cause performance issues
- Function calling gracefully degrades on models that don't support it

**Estimated Time**: 2 days

---

#### Milestone 5.5: Enable Feature Flag & Final Polish

**Tasks**:

- [ ] Set `features.functionCalling = true`
- [ ] Review all function calling UI for consistency with existing app style
- [ ] Verify responsive behavior (mobile function management, function messages)
- [ ] Verify accessibility (keyboard navigation, screen reader labels)
- [ ] Performance check (lazy-loaded editor, worker memory cleanup)
- [ ] Update README with function calling documentation

**Acceptance Criteria**:

- Function calling feature fully visible and usable
- No visual inconsistencies with existing UI
- Mobile experience is functional
- No accessibility regressions
- CodeMirror is lazy-loaded (verify with bundle analysis)

**Estimated Time**: 1 day

---

## Architecture Decisions

### Web Worker Sandbox Design

```
Main Thread                          Web Worker
───────────                          ──────────
execute(func, args)
    │
    ├──► postMessage({               onmessage({
    │      type: 'execute',            type: 'execute',
    │      code: func.implementation,  code, args, allowedAPIs
    │      args,                     })
    │      allowedAPIs                  │
    │    })                             ├──► Restrict globals
    │                                   ├──► Create sandbox scope
    │                                   ├──► Execute code
    │                                   ├──► Return result
    │    onmessage({                    │
    │      type: 'result',         ◄────┘
    │      data: result              postMessage({
    │    })                            type: 'result',
    │                                  data: result
    ├──► resolve(result)             })
    │
    │    (or on timeout)
    ├──► worker.terminate()
    ├──► reject(TimeoutError)
```

**Global Restriction Strategy**:

```javascript
// Inside worker, before executing user code:
const BLOCKED_GLOBALS = ["importScripts", "XMLHttpRequest", "WebSocket"];
for (const name of BLOCKED_GLOBALS) {
  Object.defineProperty(self, name, { value: undefined, writable: false });
}
```

**Whitelisted APIs** (configurable per function):

- `console.log/warn/error` (captured and sent to main thread)
- `JSON.parse/stringify`
- `Math.*`
- `Date` (read-only)
- `fetch` (only if explicitly allowed)

### Function Call Turn Structure

In a conversation with function calling, messages follow this pattern:

```
Message 1:  { role: "user",  content: "What's the weather in Tokyo?" }
Message 2:  { role: "model", content: "", functionCall: { name: "getWeather", arguments: { location: "Tokyo" } } }
Message 3:  { role: "user",  content: "", functionResult: { name: "getWeather", result: { temp: 22, condition: "sunny" } } }
Message 4:  { role: "model", content: "The weather in Tokyo is currently 22°C and sunny." }
```

Function call/result messages are auto-generated — the user never manually creates them. They're displayed differently from regular messages in the UI.

### Conversation ↔ Function Relationship

Functions are defined globally (in the functions store) and **attached** to conversations by ID reference:

```
Conversation {
  ...
  functionIds: ["func-1", "func-2"]   // References
}

FunctionDefinition {
  id: "func-1"
  name: "getWeather"
  ...
}
```

This means:

- One function can be attached to multiple conversations
- Editing a function affects all conversations that use it
- Deleting a function doesn't delete conversations (they just lose that function)

### DB Schema Change

The `Conversation` type gains a `functionIds` field. Since Dexie handles schemaless properties gracefully, existing conversations without `functionIds` simply default to `[]` — **no formal migration needed**, just a type update.

---

## File Structure (New Files)

```
src/
├── config/
│   └── features.ts                          # Feature flags
├── workers/
│   └── functionExecutor.worker.ts           # Sandboxed execution
├── services/
│   ├── executor.ts                          # Worker manager
│   ├── __tests__/
│   │   ├── executor.test.ts
│   │   └── executor.integration.test.ts
│   └── api/
│       ├── functionMapping.ts               # FunctionDefinition ↔ Google SDK mapping
│       └── __tests__/
│           └── functionMapping.test.ts
├── stores/
│   ├── functions.ts                         # Function management store
│   └── __tests__/
│       └── functions.test.ts
├── lib/
│   └── functionTemplates.ts                 # Built-in example functions
└── components/
    └── chat/
        ├── functions/
        │   ├── index.ts
        │   ├── CodeEditor.tsx               # CodeMirror wrapper
        │   ├── FunctionForm.tsx             # Create/edit form
        │   ├── FunctionList.tsx             # Function list view
        │   ├── FunctionPanel.tsx            # Container panel
        │   ├── FunctionAttachmentBar.tsx    # Attach functions to conversation
        │   ├── FunctionTestRunner.tsx       # Test functions in isolation
        │   └── ParameterSchemaEditor.tsx    # Visual JSON Schema editor
        ├── message/
        │   ├── FunctionCallDisplay.tsx      # Render function call message
        │   └── FunctionResultDisplay.tsx    # Render function result message
        └── __tests__/
            ├── FunctionCalling.test.tsx
            └── FunctionManagement.test.tsx
```

## Dependencies to Add

| Package                       | Purpose                  | Size Impact                 |
| ----------------------------- | ------------------------ | --------------------------- |
| `@codemirror/view`            | Core editor              | ~50KB gzipped (lazy-loaded) |
| `@codemirror/state`           | Editor state             | Bundled with view           |
| `@codemirror/lang-javascript` | JS/TS highlighting       | ~15KB                       |
| `@codemirror/theme-one-dark`  | Dark theme               | ~5KB                        |
| `@codemirror/basic-setup`     | Common editor extensions | ~30KB                       |

All CodeMirror packages are **lazy-loaded** via dynamic import — they do not affect initial bundle size.

## Testing Strategy

| Layer            | What to Test                                            | Tool                     |
| ---------------- | ------------------------------------------------------- | ------------------------ |
| Executor service | Execution, timeout, syntax validation, sandbox security | Vitest                   |
| Function store   | CRUD, persistence, state transitions                    | Vitest                   |
| Function mapping | `FunctionDefinition` ↔ Google SDK conversion            | Vitest                   |
| Chat service     | Function call loop, multi-turn, error handling          | Vitest (mocked API)      |
| UI components    | Form validation, list interactions, message displays    | Vitest + Testing Library |
| Integration      | Full function call flow end-to-end                      | Vitest + Testing Library |

## Risk Mitigation

| Risk                                | Mitigation                                                               |
| ----------------------------------- | ------------------------------------------------------------------------ |
| Worker security bypass              | Restrict globals aggressively, use CSP headers, review sandbox quarterly |
| Worker memory leaks                 | Terminate and recreate worker after each execution; set memory limits    |
| Large function results blocking UI  | Truncate results > 100KB, use virtual scrolling for display              |
| CodeMirror bundle size              | Lazy-load entire editor, verify with bundle analyzer                     |
| Function schema complexity          | Start with flat object schemas only; defer nested objects                |
| Model calling non-existent function | Graceful error → send error result back to model                         |

---

## Definition of Done

Function calling is "done" when:

- [ ] User can create, edit, test, and delete functions
- [ ] Functions can be attached to conversations
- [ ] Model can call attached functions during chat
- [ ] Function execution happens in sandboxed Web Worker
- [ ] Function calls and results display clearly in chat
- [ ] Full flow works: message → function call → execution → result → model response
- [ ] Multi-turn function calling works
- [ ] Error cases handled gracefully (timeout, runtime error, missing function)
- [ ] All new code has tests (unit + integration)
- [ ] Feature flag enabled
- [ ] Works on desktop and mobile
- [ ] No performance regressions (lazy-loaded editor, worker cleanup)
- [ ] Import/export includes functions
