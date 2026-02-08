import { SendIcon } from "lucide-react";
import type { SubmitEvent } from "react";
import { useState } from "react";

function App() {
  const [messages, setMessages] = useState<string[]>(["Hello"]);
  const [input, setInput] = useState("");

  const sendMessage = (event: SubmitEvent) => {
    event.preventDefault();
    if (!input.trim()) return;

    setMessages([...messages, input]);
    setInput("");
  };

  return (
    <main className="flex h-dvh flex-col">
      <div className="flex flex-1 flex-col-reverse items-end gap-2 overflow-y-auto bg-gray-50 py-4">
        {[...messages].reverse().map((message, index) => (
          <div
            key={index}
            className="mx-2 rounded-lg bg-blue-400 px-4 py-2 text-xl text-white"
          >
            {message}
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

export default App;
