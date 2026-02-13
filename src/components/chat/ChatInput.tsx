import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SendHorizontal, Square } from "lucide-react";
import { useRef, useState } from "react";

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  isStreaming?: boolean;
  onStop?: () => void;
}

export function ChatInput({
  onSend,
  disabled,
  isStreaming,
  onStop,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (input.trim() && !disabled) {
      onSend(input);
      setInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  return (
    <div className="bg-background relative flex items-end gap-1 border-t p-4">
      <Textarea
        ref={textareaRef}
        value={input}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
        className="max-h-[200px] min-h-[40px] flex-1 resize-none py-3"
        disabled={disabled}
        rows={1}
      />
      {isStreaming && onStop ? (
        <Button
          variant="destructive"
          size="icon"
          onClick={onStop}
          className="m-1 h-10 w-10 shrink-0 rounded-full"
        >
          <Square className="h-3 w-3 fill-current" />
          <span className="sr-only">Stop</span>
        </Button>
      ) : (
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!input.trim() || disabled}
          className="m-1 h-10 w-10 shrink-0 rounded-full"
        >
          <SendHorizontal className="h-5 w-5" />
          <span className="sr-only">Send</span>
        </Button>
      )}
    </div>
  );
}
