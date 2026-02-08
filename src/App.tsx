import { ApiKeyForm, Chat } from "@/components";
import { useLocalStorage } from "@/hooks";

function App() {
  const [apiKey, setApiKey] = useLocalStorage("api-key", "");

  if (!apiKey) {
    return (
      <main className="flex h-svh items-center justify-center">
        <ApiKeyForm onSubmit={(key: string) => setApiKey(key)}></ApiKeyForm>
      </main>
    );
  }

  return <Chat apiKey={apiKey} />;
}

export default App;
