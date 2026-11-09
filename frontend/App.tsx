import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { useAuthStore } from "./src/auth/authStore";
import { CameraCursor } from "./src/cameraCursor/CameraCursor";
import { installWebScrollbars } from "./src/ui/webScrollbars";
import { installWebHover } from "./src/ui/webHover";
import { SuccessPopup } from "./src/ui/SuccessPopup";
import { SignOutConfirm } from "./src/ui/SignOutConfirm";
import { installWebFont } from "./src/ui/webFont";
import { PublicPhotoSelectionScreen } from "./src/screens/public/PublicPhotoSelectionScreen";
import { ShutterProvider } from "./src/shutter";

// Data counts as fresh for 30 seconds, so moving between screens re-uses it instead of re-asking.
// Window-focus refetching is off: it would reload every screen still mounted in the navigation
// stacks. useRefetchOnFocus refreshes just the visible screen instead; saves invalidate what they change.
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

// A customer's private photo-selection link (/photo-selection/<token>) is a standalone page: no
// login, no studio navigation, its own query cache. It's recognised before the authenticated app
// mounts, so none of the owner's auth/hydration code runs for it.
function photoSelectionToken(): string | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  const match = window.location.pathname.match(/^\/photo-selection\/([^/?#]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

installWebScrollbars();
installWebHover();
installWebFont();

export default function App() {
  const [token] = useState(photoSelectionToken);
  return <ShutterProvider>{token ? <PublicPhotoSelection token={token} /> : <AuthenticatedApp />}</ShutterProvider>;
}

const publicQueryClient = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });

function PublicPhotoSelection({ token }: { token: string }) {
  return (
    <QueryClientProvider client={publicQueryClient}>
      <PublicPhotoSelectionScreen token={token} />
      <StatusBar style="dark" />
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
      {/* Optional camera-shaped pointer for the studio app (switched on from the menu). */}
      <CameraCursor />
      {/* "Created!" pop-up after saving something new (see ui/SuccessPopup). */}
      <SuccessPopup />
      {/* "Sign out?" Yes / No, for every Sign out button (see ui/SignOutConfirm). */}
      <SignOutConfirm />
      <StatusBar style="dark" />
    </QueryClientProvider>
  );
}
