import { Loader2, Search, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button, Input } from "@/components/ui";
import { useDebounce } from "@/hooks";
import { useConversationStore } from "@/stores";

export function SearchInput() {
  const searchQuery = useConversationStore((state) => state.searchQuery);
  const setSearchQuery = useConversationStore((state) => state.setSearchQuery);
  const isSearching = useConversationStore((state) => state.isSearching);
  const setIsSearching = useConversationStore((state) => state.setIsSearching);

  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);

  // Update isSearching immediately when local input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearchQuery(value);
    if (value !== searchQuery) {
      setIsSearching(true);
    }
  };

  const debouncedSearchQuery = useDebounce(localSearchQuery, 300);

  useEffect(() => {
    setSearchQuery(debouncedSearchQuery);
    setIsSearching(false);
  }, [debouncedSearchQuery, setSearchQuery, setIsSearching]);

  // Sync local search query if store changes (e.g. from clear button or external reset)
  useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);

  return (
    <div className="relative">
      <Search className="text-muted-foreground absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2" />
      <Input
        placeholder="Search conversations..."
        value={localSearchQuery}
        onChange={handleInputChange}
        className="h-8 pr-8 pl-8 text-xs focus-visible:ring-1"
      />
      <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
        {isSearching && (
          <Loader2 className="text-muted-foreground h-3 w-3 animate-spin" />
        )}
        {searchQuery && !isSearching && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-transparent"
            onClick={() => setSearchQuery("")}
          >
            <X className="text-muted-foreground h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
