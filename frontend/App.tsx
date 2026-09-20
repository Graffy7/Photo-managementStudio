import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { useAuthStore } from "./src/auth/authStore";
import { PublicPhotoSelectionScreen } from "./src/screens/public/PublicPhotoSelectionScreen";

const queryClient = new QueryClient();

// A customer's private photo-selection link (/photo-selection/<token>) is a standalone page: no
// login, no studio navigation, its own query cache. It's recognised before the authenticated app
// mounts, so none of the owner's auth/hydration code runs for it.
function photoSelectionToken(): string | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  const match = window.location.pathname.match(/^\/photo-selection\/([^/?#]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

export default function App() {
  const [token] = useState(photoSelectionToken);
  return token ? <PublicPhotoSelection token={token} /> : <AuthenticatedApp />;
}

const publicQueryClient = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });

function PublicPhotoSelection({ token }: { token: string }) {
  return (
    <QueryClientProvider client={publicQueryClient}>
      <PublicPhotoSelectionScreen token={token} />
      <StatusBar style="light" />
    </QueryClientProvider>
  );
}

function AuthenticatedApp() {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <QueryClientProvider client={queryClient}>
      <RootNavigator />
      <StatusBar style="light" />
    </QueryClientProvider>
  );
}
