import { useEffect } from "react";
import { Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { PublicPhotoSelectionScreen } from "./src/screens/public/PublicPhotoSelectionScreen";
import { useAuthStore } from "./src/auth/authStore";

const queryClient = new QueryClient();

// A customer's photo-selection link is a public, tokenized URL with no studio session at all —
// rather than bolt a deep-linking config onto the whole authenticated app's navigator (risking
// every other screen's URL behavior), we just check the URL directly, before any auth state or
// RootNavigator is ever touched, and render a fully standalone screen for this one path shape.
function getPublicPhotoSelectionToken(): string | null {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return null;
  }
  const match = window.location.pathname.match(/^\/photo-selection\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

export default function App() {
  const publicToken = getPublicPhotoSelectionToken();

  if (publicToken) {
    return <PublicPhotoSelectionScreen token={publicToken} />;
  }

  return <AuthenticatedApp />;
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
