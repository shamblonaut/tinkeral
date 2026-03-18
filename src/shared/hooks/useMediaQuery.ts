import { useEffect, useState } from "react";

export function useMediaQuery(query: string) {
  const [value, setValue] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    function onChange(event: MediaQueryListEvent) {
      setValue(event.matches);
    }

    const result = matchMedia(query);
    result.addEventListener("change", onChange);

    return () => result.removeEventListener("change", onChange);
  }, [query]);

  return value;
}
