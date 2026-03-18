import { useEffect, useState } from "react";

import { SearchField } from "@/shared/components";
import { useDebounce } from "@/shared/hooks";

import { useConversationStore } from "../../store";

export function SearchInput() {
  const searchQuery = useConversationStore((state) => state.searchQuery);
  const setSearchQuery = useConversationStore((state) => state.setSearchQuery);
  const isSearching = useConversationStore((state) => state.isSearching);
  const setIsSearching = useConversationStore((state) => state.setIsSearching);

  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);

  // Update isSearching immediately when local input changes
  const handleInputChange = (value: string) => {
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
    <SearchField
      placeholder="Search conversations..."
      value={localSearchQuery}
      isSearching={isSearching}
      onChange={handleInputChange}
      onClear={() => setSearchQuery("")}
      clearAriaLabel="Clear conversation search"
    />
  );
}
