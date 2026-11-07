import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "../../../api/authApi";
import { useAuthStore } from "../../../auth/authStore";
import { extractErrorMessage } from "../../../api/errorMessage";
import { StatusPill } from "../../../components/StatusPill";
import { hoverGlow } from "../../../ui/webHover";
import { ConfirmDialog } from "../../../ui/ConfirmDialog";

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
      <View {...hoverGlow} style={styles.card}>
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

      <Pressable style={styles.dangerButton} onPress={() => setConfirming(true)}>
        <Text style={styles.dangerButtonText}>Sign out of all devices</Text>
      </Pressable>
      <ConfirmDialog
        visible={confirming}
        icon="log-out-outline"
        title="Sign out everywhere?"
        message="You'll be signed out on every device where you're logged in, including this one."
        confirmLabel="Sign out"
        busy={logoutEverywhereMutation.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() => logoutEverywhereMutation.mutate()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1, borderColor: "#2E4377", borderRadius: 10, backgroundColor: "#111E3F", overflow: "hidden", marginBottom: 16,
  },
  row: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#1E2D57",
  },
  linkRow: {},
  rowLabel: { color: "#F2F5FF", fontSize: 14, fontWeight: "600" },
  rowValue: { color: "#A4AFCF", fontSize: 13 },
  chevron: { color: "#A4AFCF", fontSize: 18 },
  error: { color: "#FF5C75", fontSize: 13, marginBottom: 8 },
  dangerButton: {
    borderWidth: 1, borderColor: "#FF5C75", borderRadius: 8, paddingVertical: 11, paddingHorizontal: 20, alignSelf: "flex-start",
  },
  dangerButtonText: { color: "#FF5C75", fontWeight: "700", fontSize: 13 },
  confirmRow: {
    flexDirection: "row", alignItems: "center", gap: 16, padding: 12,
    borderWidth: 1, borderColor: "#2E4377", borderStyle: "dashed", borderRadius: 8, backgroundColor: "#0C1733",
  },
  confirmText: { color: "#F2F5FF", fontSize: 13, flex: 1 },
  cancelLink: { color: "#A4AFCF", fontSize: 13, fontWeight: "600" },
  confirmLink: { color: "#FF5C75", fontSize: 13, fontWeight: "700" },
});
