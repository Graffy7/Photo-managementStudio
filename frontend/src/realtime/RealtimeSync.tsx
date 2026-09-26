import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { HubConnectionBuilder, HubConnectionState, LogLevel, type HubConnection } from "@microsoft/signalr";
import { useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "../constants/config";
import { getFreshAccessToken, setRealtimeConnectionId } from "../api/client";
import { AREA_QUERIES } from "./areas";

// Keeps this device in step with the studio's other signed-in devices (phone, office PCs...).
// The server sends only "these areas changed"; the data itself is re-fetched through the normal
// API, so nothing here bypasses authorisation or tenant checks.
//
// Recovery: SignalR retries on its own for a while; if it gives up, or the device was offline or
// asleep, it reconnects when the network/app comes back and then re-loads everything, since
// changes made meanwhile weren't heard.
const RETRY_DELAYS_MS = [0, 2_000, 5_000, 10_000, 30_000];
const DEBOUNCE_MS = 400;

export function RealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let stopped = false;
    let pending = new Set<string>();
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    // Several saves in a row (e.g. an event and its payment) become one round of re-fetching.
    const flush = () => {
      flushTimer = null;
      const keys = new Set<string>();
      pending.forEach((area) => (AREA_QUERIES[area] ?? []).forEach((k) => keys.add(k)));
      pending = new Set();
      keys.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
    };
    const refreshAll = () => queryClient.invalidateQueries();

    const connection: HubConnection = new HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}/hubs/studio`, {
        accessTokenFactory: async () => (await getFreshAccessToken()) ?? "",
        withCredentials: false,
      })
      .withAutomaticReconnect(RETRY_DELAYS_MS)
      .configureLogging(LogLevel.None)
      .build();

    connection.on("changed", (message: { areas?: string[] }) => {
      (message?.areas ?? []).forEach((a) => pending.add(a));
      flushTimer ??= setTimeout(flush, DEBOUNCE_MS);
    });
    connection.onreconnecting(() => setRealtimeConnectionId(null));
    connection.onreconnected((id) => {
      setRealtimeConnectionId(id ?? null);
      refreshAll();
    });
    connection.onclose(() => {
      setRealtimeConnectionId(null);
      scheduleRetry();
    });

    const start = async (catchUp: boolean) => {
      if (stopped || connection.state !== HubConnectionState.Disconnected) return;
      try {
        await connection.start();
        setRealtimeConnectionId(connection.connectionId);
        if (catchUp) refreshAll();
      } catch {
        scheduleRetry();
      }
    };
    function scheduleRetry() {
      if (stopped || retryTimer) return;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        start(true);
      }, 30_000);
    }

    start(false);

    // Back online / back in the foreground: reconnect now rather than waiting for the next retry.
    const wake = () => start(true);
    let removeListeners: () => void;
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const onVisible = () => { if (document.visibilityState === "visible") wake(); };
      window.addEventListener("online", wake);
      document.addEventListener("visibilitychange", onVisible);
      removeListeners = () => {
        window.removeEventListener("online", wake);
        document.removeEventListener("visibilitychange", onVisible);
      };
    } else {
      const sub = AppState.addEventListener("change", (s) => { if (s === "active") wake(); });
      removeListeners = () => sub.remove();
    }

    return () => {
      stopped = true;
      removeListeners();
      if (flushTimer) clearTimeout(flushTimer);
      if (retryTimer) clearTimeout(retryTimer);
      setRealtimeConnectionId(null);
      connection.stop();
    };
  }, [queryClient]);

  return null;
}
