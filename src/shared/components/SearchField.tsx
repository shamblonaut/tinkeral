import { Loader2, Search, X } from "lucide-react";

import { Button, Input } from "@/shared/components/ui";

interface SearchFieldProps {
  placeholder: string;
  value: string;
  isSearching: boolean;
  onChange: (value: string) => void;
  onClear: () => void;
  ariaLabel?: string;
  clearAriaLabel?: string;
}

export function SearchField({
  placeholder,
  value,
  isSearching,
  onChange,
  onClear,
  ariaLabel,
  clearAriaLabel,
}: SearchFieldProps) {
  return (
    <div className="relative">
      <Search className="text-muted-foreground absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2" />
      <Input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        aria-label={ariaLabel}
        className="h-8 pr-8 pl-8 text-xs focus-visible:ring-1"
      />
      <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
        {isSearching && (
          <Loader2 className="text-muted-foreground h-3 w-3 animate-spin" />
        )}
        {value && !isSearching && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-transparent"
            onClick={onClear}
            aria-label={clearAriaLabel}
          >
            <X className="text-muted-foreground h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
