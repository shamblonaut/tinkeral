# Tinkeral

**A powerful, privacy-first playground for exploring LLM API capabilities.**

Tinkeral bridges the gap between simple chat interfaces and raw API usage, giving you a visual way to understand and experiment with Large Language Model capabilities through parameter tuning and feature exploration—all running entirely in your browser.

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/en/download)
- [pnpm](https://pnpm.io/installation)
- An API key from [Google AI Studio](https://aistudio.google.com/app/apikey) (free tier available)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/tinkeral.git
cd tinkeral

# Install dependencies
pnpm install

# Start development server
pnpm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## 🧰 Function Calling

Tinkeral includes built-in function calling so you can test tool-use flows end-to-end in the browser.

### What you can do

- Create and edit JavaScript functions in the **Functions** view
- Define structured input parameters with JSON Schema fields
- Run functions in an isolated Web Worker sandbox before using them in chat
- Attach functions to a conversation and let Gemini call them during responses
- Inspect function-call arguments, results, errors, and execution time in chat messages

### How to use it

1. Open **Functions** from the header toggle.
2. Create a function (name, description, parameters, implementation).
3. Use the built-in test runner to validate behavior.
4. Switch back to **Chat** and attach one or more functions to the current conversation.
5. Send a prompt that requires tool use and review the function call/result cards.

### Safety and performance notes

- Function code executes in a Web Worker, not the DOM thread.
- Execution timeouts are enforced per function.
- Function result rendering is truncated in the UI for large payloads.
- The CodeMirror editor is lazy-loaded to keep initial bundle load smaller.
