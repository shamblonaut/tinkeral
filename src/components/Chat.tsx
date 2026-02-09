import { ApiError, GoogleGenAI } from "@google/genai";
import { SendIcon } from "lucide-react";
import type { SubmitEvent } from "react";
import { useMemo, useState } from "react";

interface ChatProps {
  apiKey: string;
}

interface Message {
  sender: "user" | "model" | "system";
  content: string;
}

function Chat({ apiKey }: ChatProps) {
  if (!apiKey) {
    throw new Error("Please provide an API key to use the Gemini API");
  }

  const ai = useMemo(() => new GoogleGenAI({ apiKey }), [apiKey]);
  const chat = useMemo(
    () =>
      ai.chats.create({
        model: "gemma-3-1b-it",
      }),
    [ai],
  );

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  const getAIResponse = async (prompt: string) => {
    chat
      .sendMessage({ message: prompt })
      .then((response) => {
        setMessages((messages) => [
          ...messages,
          {
            sender: "model",
            content: response.text || "",
          },
        ]);
      })
      .catch((errorResponse: ApiError) => {
        const error = JSON.parse(errorResponse.message).error;

        setMessages((messages) => [
          ...messages,
          {
            sender: "system",
            content: `${errorResponse.name}: ${error.message}`,
          },
        ]);
      });
  };

  const sendMessage = (event: SubmitEvent) => {
    event.preventDefault();
    if (!input.trim()) return;

    setMessages((messages) => [
      ...messages,
      {
        sender: "user",
        content: input,
      },
    ]);

    getAIResponse(input);

    setInput("");
  };

  return (
    <main className="flex h-dvh flex-col">
      <div className="flex flex-1 flex-col-reverse items-end gap-2 overflow-y-auto bg-gray-50 py-4">
        {[...messages].reverse().map((message, index) => (
          <div
            key={index}
            className={`flex w-full ${message.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`mx-2 max-w-[80vw] rounded-lg border border-gray-300 ${message.sender === "user" ? "bg-blue-400" : message.sender === "model" ? "bg-white" : "bg-red-400"} px-4 py-2 text-lg whitespace-pre-wrap ${message.sender === "model" ? "text-black" : "text-white"}`}
            >
              {message.content}
            </div>
          </div>
        ))}
      </div>
      <form
        className="flex gap-2 border-t border-gray-300 p-2"
        onSubmit={sendMessage}
      >
        <input
          type="text"
          name="prompt"
          id="prompt"
          className="flex-1 rounded-lg border border-gray-400 p-4"
          value={input}
          placeholder="Enter something to send to the LLM..."
          onChange={(event) => setInput(event.target.value)}
        />
        <button type="submit" className="rounded-lg bg-blue-600 p-4 text-white">
          <SendIcon />
        </button>
      </form>
    </main>
  );
}

export default Chat;
