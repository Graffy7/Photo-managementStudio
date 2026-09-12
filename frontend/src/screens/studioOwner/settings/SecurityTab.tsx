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
              <ActivityIndicator color="#ff7a72" size="small" />
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
    borderWidth: 1, borderColor: "#23405c", borderRadius: 10, backgroundColor: "#132540", overflow: "hidden", marginBottom: 16,
  },
  row: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#1b2c42",
  },
  linkRow: {},
  rowLabel: { color: "#e8edf3", fontSize: 14, fontWeight: "600" },
  rowValue: { color: "#a7b7cb", fontSize: 13 },
  chevron: { color: "#6f83a0", fontSize: 18 },
  error: { color: "#ff7a72", fontSize: 13, marginBottom: 8 },
  dangerButton: {
    borderWidth: 1, borderColor: "#ff7a72", borderRadius: 8, paddingVertical: 11, paddingHorizontal: 20, alignSelf: "flex-start",
  },
  dangerButtonText: { color: "#ff7a72", fontWeight: "700", fontSize: 13 },
  confirmRow: {
    flexDirection: "row", alignItems: "center", gap: 16, padding: 12,
    borderWidth: 1, borderColor: "#23405c", borderStyle: "dashed", borderRadius: 8, backgroundColor: "#0f1e30",
  },
  confirmText: { color: "#e8edf3", fontSize: 13, flex: 1 },
  cancelLink: { color: "#a7b7cb", fontSize: 13, fontWeight: "600" },
  confirmLink: { color: "#ff7a72", fontSize: 13, fontWeight: "700" },
});
