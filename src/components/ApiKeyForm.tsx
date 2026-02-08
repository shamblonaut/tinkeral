import { GoogleGenAI } from "@google/genai";
import { useState, type SubmitEvent } from "react";

interface ApiKeyFormProps {
  onSubmit: (apiKey: string) => void;
}

function ApiKeyForm({ onSubmit }: ApiKeyFormProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submitHandler = (event: SubmitEvent) => {
    event.preventDefault();
    if (!input) return;

    const ai = new GoogleGenAI({ apiKey: input });
    ai.models
      .list()
      .then(() => {
        onSubmit(input);
      })
      .catch((errorResponse) => {
        setError(JSON.parse(errorResponse.message).error.message);
      });
  };

  return (
    <form
      className="flex w-80 flex-col rounded-lg border border-gray-300 p-4"
      onSubmit={submitHandler}
    >
      <h1 className="text-center text-2xl font-bold">TINKERAL</h1>
      <div className="my-4 flex flex-col gap-2">
        <label htmlFor="key" className="text-gray-500">
          Enter your Gemini API key:
        </label>
        <input
          type="text"
          name="key"
          id="key"
          className="rounded-lg border border-gray-300 p-1"
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
      <button type="submit" className="rounded-lg bg-blue-600 p-2 text-white">
        Get Started
      </button>
    </form>
  );
}

export default ApiKeyForm;
