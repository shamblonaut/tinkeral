import type { Message as MessageType } from "@/types/conversation";
import { useState } from "react";
import { ChatInput } from "./ChatInput";
import { MessageList } from "./MessageList";

// Mock data for verification
const MOCK_MESSAGES: MessageType[] = [
  {
    id: "1",
    role: "system",
    content: "You are a helpful AI assistant.",
    timestamp: Date.now() - 100000,
  },
  {
    id: "2",
    role: "user",
    content: "Hi! Can you help me write some code?",
    timestamp: Date.now() - 60000,
  },
  {
    id: "3",
    role: "model",
    content:
      "Of course! I'd be happy to help. What kind of code do you need help with?\n\nHere's a simple example in TypeScript:\n\n```typescript\nfunction greet(name: string) {\n  return `Hello, ${name}!`;\n}\n```",
    timestamp: Date.now() - 30000,
    metadata: {
      model: "gemini-pro",
    },
  },
];

export function ChatInterface() {
  const [messages, setMessages] = useState<MessageType[]>(MOCK_MESSAGES);

  const handleSend = (content: string) => {
    const newMessage: MessageType = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, newMessage]);

    // Simulate model response
    setTimeout(() => {
      const modelMessage: MessageType = {
        id: (Date.now() + 1).toString(),
        role: "model",
        content: `I received your message: "${content}". This is a mock response.`,
        timestamp: Date.now(),
        metadata: {
          model: "gemini-pro",
        },
      };
      setMessages((prev) => [...prev, modelMessage]);
    }, 1000);
  };

  return (
    <div className="bg-background flex h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <h1 className="text-xl font-bold">🧩 Tinkeral</h1>
      </header>
      <div className="flex-1 overflow-hidden">
        <MessageList messages={messages} className="h-full px-4" />
      </div>
      <ChatInput onSend={handleSend} />
    </div>
  );
}
