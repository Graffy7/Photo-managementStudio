import { useCallback, useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";

// Refreshes a screen's data when the owner comes back to it — and only that screen.
//
// Screens live inside React Navigation stacks, so screens further back stay mounted. React Query's
// own window-focus refetch would re-load every one of them (it is switched off in App.tsx);
// instead this refetches:
//   - when the screen becomes focused again (not on its first mount — the query itself loads then),
//   - when the browser tab / app comes back to the foreground, if this screen is the visible one,
//     at most once every 30 seconds.
//
// The callback is kept identity-stable via a ref so react-query's refetch — whose reference isn't
// guaranteed stable across renders — can't cause useFocusEffect to resubscribe and refetch in a loop.
const WINDOW_REFRESH_MS = 30_000;

export function useRefetchOnFocus(refetch: () => void) {
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;
  const firstFocus = useRef(true);
  const lastRun = useRef(Date.now());
  const isFocused = useIsFocused();

  const run = () => {
    lastRun.current = Date.now();
    refetchRef.current();
  };

  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      run();
    }, [])
  );

  useEffect(() => {
    if (!isFocused) return;
    const maybeRun = () => {
      if (Date.now() - lastRun.current >= WINDOW_REFRESH_MS) run();
    };

    if (Platform.OS === "web" && typeof document !== "undefined") {
      const onVisible = () => { if (document.visibilityState === "visible") maybeRun(); };
      window.addEventListener("focus", maybeRun);
      document.addEventListener("visibilitychange", onVisible);
      return () => {
        window.removeEventListener("focus", maybeRun);
        document.removeEventListener("visibilitychange", onVisible);
      };
    }

    const sub = AppState.addEventListener("change", (state) => { if (state === "active") maybeRun(); });
    return () => sub.remove();
  }, [isFocused]);
}
