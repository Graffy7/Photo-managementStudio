import type { ReactNode } from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useMySubscription } from "../screens/studioOwner/subscription/SubscriptionScreens";

// True while the studio may make changes. Read-only (subscription lapsed, or set by the platform
// admin) is false. While the status is still loading it counts as true - the server refuses the
// change anyway if it isn't allowed.
export function useCanWrite(): boolean {
  const { data } = useMySubscription();
  return !data || data.accessLevel === "Full";
}

// Wraps an action that creates or changes something. While the studio is read-only the action is
// replaced by a clear locked button that leads to the Subscription page.
export function SubscriptionLock({ children, compact }: { children: ReactNode; compact?: boolean }) {
  const canWrite = useCanWrite();
  const navigation = useNavigation<any>();
  if (canWrite) return <>{children}</>;

  return (
    <Pressable
      style={[styles.locked, compact && styles.compact]}
      onPress={() => navigation.navigate("Subscription")}
      accessibilityRole="button"
      accessibilityLabel="Subscription required. Open the subscription page to renew."
    >
      <Ionicons name="lock-closed" size={compact ? 11 : 13} color="#f2bd5c" />
      <Text style={[styles.text, compact && styles.textCompact]}>{compact ? "Locked" : "Subscription Required"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  locked: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    borderWidth: 1, borderColor: "rgba(242,189,92,0.45)", backgroundColor: "rgba(242,189,92,0.08)",
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9,
  },
  compact: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 },
  text: { color: "#f2bd5c", fontWeight: "700", fontSize: 13 },
  textCompact: { fontSize: 11.5 },
});
