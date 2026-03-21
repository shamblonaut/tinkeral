import { Check, Copy, X } from "lucide-react";
import { useTheme } from "next-themes";
import {
  Children,
  isValidElement,
  useState,
  type ComponentPropsWithoutRef,
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { Button, Textarea } from "@/shared/components/ui";
import {
  oneDark,
  oneLight,
  SyntaxHighlighter,
} from "@/shared/lib/syntaxHighlighter";
import { cn } from "@/shared/lib/utils";

const PreBlock = ({
  children,
  ...props
}: ComponentPropsWithoutRef<"pre"> & { node?: unknown }) => {
  const [isCopied, setIsCopied] = useState(false);
  const { resolvedTheme } = useTheme();

  let codeString = "";
  let language = "text";

  const childArray = Children.toArray(children);
  const firstChild = childArray[0];

  if (isValidElement(firstChild)) {
    const childProps = firstChild.props as {
      className?: string;
      children?: React.ReactNode;
    };
    codeString = String(childProps.children || "").replace(/\n$/, "");
    const match = /language-(\w+)/.exec(childProps.className || "");
    if (match) {
      language = match[1];
    }
  } else {
    codeString = String(children).replace(/\n$/, "");
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(codeString);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="group relative my-5 overflow-hidden rounded-lg shadow-md">
      <div
        className={cn(
          "text-muted-foreground flex items-center justify-between px-4 py-2 text-xs",
          resolvedTheme === "light" ? "bg-black/5" : "bg-black/40",
        )}
      >
        <span className="font-mono">{language}</span>
        <button
          onClick={copyToClipboard}
          className="hover:text-foreground flex items-center gap-1.5 transition-colors"
          title="Copy code"
          aria-label="Copy code"
        >
          {isCopied ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          <span>{isCopied ? "Copied!" : "Copy"}</span>
        </button>
      </div>
      <SyntaxHighlighter
        {...props}
        style={resolvedTheme === "light" ? oneLight : oneDark}
        language={language}
        PreTag="div"
        customStyle={{
          margin: 0,
          padding: "1rem",
          fontSize: "0.875rem",
          borderTopLeftRadius: "0",
          borderTopRightRadius: "0",
        }}
        codeTagProps={{
          style: {
            fontFamily: "var(--font-mono)",
          },
        }}
      >
        {codeString}
      </SyntaxHighlighter>
    </div>
  );
};

const InlineCode = ({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"code"> & { inline?: boolean; node?: unknown }) => {
  return (
    <code
      className={cn(
        "bg-muted-foreground/20 text-foreground rounded-md px-1.5 py-0.5 font-mono text-sm",
        className,
      )}
      {...props}
    >
      {children}
    </code>
  );
};

const markdownComponents: Components = {
  pre: PreBlock,
  code: InlineCode,
  p({ children }) {
    return <p className="mb-4 leading-7 last:mb-0">{children}</p>;
  },
  ul({ children }) {
    return <ul className="mb-4 list-disc space-y-1 pl-6">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="mb-4 list-decimal space-y-1 pl-6">{children}</ol>;
  },
  li({ children }) {
    return <li className="leading-7">{children}</li>;
  },
  a({ href, children }) {
    return (
      <a
        href={href}
        className="text-primary font-medium underline-offset-4 hover:underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    );
  },
  table({ children }) {
    return (
      <div className="border-border my-4 overflow-x-auto rounded-lg border">
        <table className="divide-border min-w-full divide-y">{children}</table>
      </div>
    );
  },
  th({ children }) {
    return (
      <th className="bg-muted/50 text-foreground px-4 py-2.5 text-left font-semibold">
        {children}
      </th>
    );
  },
  td({ children }) {
    return (
      <td className="border-border/50 border-t px-4 py-2.5">{children}</td>
    );
  },
  blockquote({ children }) {
    return (
      <blockquote className="border-primary/50 bg-muted/20 text-muted-foreground my-4 rounded-r-lg border-l-4 py-1 pl-4 italic">
        {children}
      </blockquote>
    );
  },
  h1({ children }) {
    return <h1 className="mt-8 mb-4 text-2xl font-bold">{children}</h1>;
  },
  h2({ children }) {
    return (
      <h2 className="border-border/40 mt-6 mb-3 border-b pb-2 text-xl font-bold">
        {children}
      </h2>
    );
  },
  h3({ children }) {
    return <h3 className="mt-5 mb-2 text-lg font-bold">{children}</h3>;
  },
  hr() {
    return <hr className="border-border/50 my-6 border-t" />;
  },
  br() {
    return <br className="block pb-1 content-['']" />;
  },
};

interface MessageContentProps {
  content: string;
  isUser: boolean;
  isEditing: boolean;
  isStreaming?: boolean;
  isEmbedded?: boolean;
  editContent: string;
  onEditContentChange: (content: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function MessageContent({
  content,
  isUser,
  isEditing,
  isStreaming,
  isEmbedded = false,
  editContent,
  onEditContentChange,
  onSave,
  onCancel,
}: MessageContentProps) {
  return (
    <div
      className={cn(
        "prose prose-neutral dark:prose-invert relative w-full leading-relaxed wrap-break-word transition-colors duration-200",
        isEditing
          ? "bg-background rounded-xl border p-2 shadow-sm"
          : isEmbedded
            ? "bg-transparent p-0 shadow-none"
            : isUser
              ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2 shadow-sm"
              : "bg-muted rounded-2xl rounded-tl-sm px-4 py-2 shadow-sm",
        isEmbedded && isUser && "text-primary-foreground",
      )}
    >
      {isEditing ? (
        <div className="flex w-full flex-col gap-2">
          <Textarea
            ref={(el) => {
              if (el) {
                el.style.height = "auto";
                el.style.height = el.scrollHeight + "px";
              }
            }}
            value={editContent}
            onChange={(e) => {
              e.target.style.height = "auto";
              e.target.style.height = e.target.scrollHeight + "px";
              onEditContentChange(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSave();
              }
            }}
            className="text-foreground min-h-10 w-full resize-none overflow-hidden border-none bg-transparent px-2 py-1 shadow-none focus-visible:ring-0"
            autoFocus
            rows={2}
          />
          <div className="flex justify-end gap-1.5 p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="hover:bg-background/50 h-7 px-3 text-xs"
            >
              <X className="mr-1 h-3 w-3" /> Cancel
            </Button>
            <Button
              size="sm"
              onClick={onSave}
              className="bg-foreground text-background hover:bg-foreground/90 h-7 px-3 text-xs"
            >
              <Check className="mr-1 h-3 w-3" /> Save & Submit
            </Button>
          </div>
        </div>
      ) : isUser ? (
        <div className={cn("relative", "[&_p]:mb-0 [&_p]:last:mb-0")}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
          >
            {content}
          </ReactMarkdown>
        </div>
      ) : !content && isStreaming ? (
        <div className="flex h-6 items-center gap-1">
          <span className="bg-muted-foreground/40 h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.3s]" />
          <span className="bg-muted-foreground/40 h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.15s]" />
          <span className="bg-muted-foreground/40 h-1.5 w-1.5 animate-bounce rounded-full" />
        </div>
      ) : (
        <div
          className={cn(
            "relative",
            isStreaming &&
              "[&>*:last-child]:after:bg-primary [&>*:last-child]:after:ml-1 [&>*:last-child]:after:inline-block [&>*:last-child]:after:h-4 [&>*:last-child]:after:w-2 [&>*:last-child]:after:animate-pulse [&>*:last-child]:after:align-middle [&>*:last-child]:after:content-['']",
          )}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
          >
            {content}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}
