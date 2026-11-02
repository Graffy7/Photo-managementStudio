import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "../../../api/authApi";
import { useAuthStore } from "../../../auth/authStore";
import { extractErrorMessage } from "../../../api/errorMessage";
import { StatusPill } from "../../../components/StatusPill";

function formatDateTime(value: string | null): string {
  if (!value) return "This is your first login";
  return new Date(value).toLocaleString("en-IN", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Row({ label, value, right }: { label: string; value?: string; right?: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {right ?? <Text style={styles.rowValue}>{value}</Text>}
    </View>
  );
}

export function SecurityTab() {
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const logoutEverywhereMutation = useMutation({
    mutationFn: authApi.logoutEverywhere,
    onSuccess: async () => {
      await logout();
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  return (
    <View>
      <View style={styles.card}>
        <Row label="Last login" value={formatDateTime(user?.lastLoginAt ?? null)} />
        <Row
          label="Account status"
          right={<StatusPill label={user?.isActive ? "Active" : "Inactive"} tone={user?.isActive ? "good" : "bad"} />}
        />
        <Pressable style={[styles.row, styles.linkRow]} onPress={() => navigation.navigate("ChangePassword")}>
          <Text style={styles.rowLabel}>Change password</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {confirming ? (
        <View style={styles.confirmRow}>
          <Text style={styles.confirmText}>Sign out of every device where you're logged in?</Text>
          <Pressable onPress={() => setConfirming(false)}>
            <Text style={styles.cancelLink}>Cancel</Text>
          </Pressable>
          <Pressable onPress={() => logoutEverywhereMutation.mutate()} disabled={logoutEverywhereMutation.isPending}>
            {logoutEverywhereMutation.isPending ? (
              <ActivityIndicator color="#ef4444" size="small" />
            ) : (
              <Text style={styles.confirmLink}>Yes, sign out everywhere</Text>
            )}
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.dangerButton} onPress={() => setConfirming(true)}>
          <Text style={styles.dangerButtonText}>Sign out of all devices</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1, borderColor: "#d9dbec", borderRadius: 10, backgroundColor: "#f5f3ff", overflow: "hidden", marginBottom: 16,
  },
  row: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#e7e9f5",
  },
  linkRow: {},
  rowLabel: { color: "#17172f", fontSize: 14, fontWeight: "600" },
  rowValue: { color: "#74758c", fontSize: 13 },
  chevron: { color: "#74758c", fontSize: 18 },
  error: { color: "#ef4444", fontSize: 13, marginBottom: 8 },
  dangerButton: {
    borderWidth: 1, borderColor: "#ef4444", borderRadius: 8, paddingVertical: 11, paddingHorizontal: 20, alignSelf: "flex-start",
  },
  dangerButtonText: { color: "#ef4444", fontWeight: "700", fontSize: 13 },
  confirmRow: {
    flexDirection: "row", alignItems: "center", gap: 16, padding: 12,
    borderWidth: 1, borderColor: "#d9dbec", borderStyle: "dashed", borderRadius: 8, backgroundColor: "#FFFFFF",
  },
  confirmText: { color: "#17172f", fontSize: 13, flex: 1 },
  cancelLink: { color: "#74758c", fontSize: 13, fontWeight: "600" },
  confirmLink: { color: "#ef4444", fontSize: 13, fontWeight: "700" },
});
