import type { ReactNode } from "react";
import { Platform, View, StyleSheet } from "react-native";
import type { NavigationContainerRefWithCurrent } from "@react-navigation/native";
import { Sidebar } from "./Sidebar";

interface WebAppShellProps {
  children: ReactNode;
  navigationRef: NavigationContainerRefWithCurrent<any>;
  activeRoute: string;
}

// Sidebar navigation is a web-only layout for now — native (iOS/Android) keeps rendering
// screens full-width with no shell, since a fixed desktop sidebar doesn't translate to a
// phone-sized viewport.
export function WebAppShell({ children, navigationRef, activeRoute }: WebAppShellProps) {
  if (Platform.OS !== "web") {
    return <>{children}</>;
  }

  return (
    <View style={styles.shell}>
      <Sidebar navigationRef={navigationRef} activeRoute={activeRoute} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, flexDirection: "row", backgroundColor: "#0d1826" },
  content: { flex: 1 },
});
