import { useCallback, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";

// Screens live inside React Navigation stacks, not separate browser pages, so the
// window never blurs/refocuses when moving between them — react-query's built-in
// refetchOnWindowFocus never fires. This re-fetches whenever a screen becomes focused.
//
// The focus callback is kept identity-stable (empty deps) via a ref so react-query's
// refetch — whose reference isn't guaranteed stable across renders — can't cause
// useFocusEffect to resubscribe every render and refetch in a loop.
export function useRefetchOnFocus(refetch: () => void) {
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useFocusEffect(
    useCallback(() => {
      refetchRef.current();
    }, [])
  );
}
