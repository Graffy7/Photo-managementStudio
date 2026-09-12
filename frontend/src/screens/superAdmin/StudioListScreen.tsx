import { useState } from "react";
import { View, Text, TextInput, FlatList, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { studiosApi } from "../../api/studiosApi";
import type { Studio } from "../../types/studio";
import { StatusPill } from "../../components/StatusPill";
import { useAuthStore } from "../../auth/authStore";
import { useRefetchOnFocus } from "../../hooks/useRefetchOnFocus";

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

export function StudioListScreen({
  onCreate,
  onEdit,
  onViewActivity,
  onManageFeatures,
  onRenew,
  onViewDashboard,
}: {
  onCreate: () => void;
  onEdit: (studio: Studio) => void;
  onViewActivity: () => void;
  onManageFeatures: (studio: Studio) => void;
  onRenew: (studio: Studio) => void;
  onViewDashboard: () => void;
}) {
  const navigation = useNavigation<any>();
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const logout = useAuthStore((s) => s.logout);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["studios", search],
    queryFn: () => studiosApi.search({ search: search || undefined, page: 1, pageSize: 50 }),
  });
  useRefetchOnFocus(refetch);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["studios"] });
    queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
  };

  const activate = useMutation({ mutationFn: studiosApi.activate, onSuccess: invalidate });
  const deactivate = useMutation({ mutationFn: studiosApi.deactivate, onSuccess: invalidate });
  const block = useMutation({ mutationFn: studiosApi.block, onSuccess: invalidate });
  const unblock = useMutation({ mutationFn: studiosApi.unblock, onSuccess: invalidate });

  const renderItem = ({ item }: { item: Studio }) => (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <Text style={styles.studioName}>{item.studioName}</Text>
        <Text style={styles.owner}>{item.ownerName} · {item.email}</Text>
        {item.address ? <Text style={styles.address}>{item.address}</Text> : null}

        <View style={styles.pillRow}>
          <StatusPill label={item.isActive ? "Active" : "Inactive"} tone={item.isActive ? "good" : "neutral"} />
          {item.isBlocked && <StatusPill label="Blocked" tone="bad" />}
          {item.planName && <StatusPill label={item.planName} tone="neutral" />}
        </View>

        {item.subscriptionStartDate && (
          <Text style={styles.subMeta}>
            Started {formatDate(item.subscriptionStartDate)} · Renews {formatDate(item.subscriptionEndDate)}
          </Text>
        )}
      </View>
      <View style={styles.actions}>
        <Pressable style={styles.actionBtn} onPress={() => onManageFeatures(item)}>
          <Text style={styles.actionText}>Modules</Text>
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={() => onEdit(item)}>
          <Text style={styles.actionText}>Edit</Text>
        </Pressable>
        <Pressable
          style={styles.actionBtn}
          onPress={() => (item.isActive ? deactivate.mutate(item.studioId) : activate.mutate(item.studioId))}
        >
          <Text style={styles.actionText}>{item.isActive ? "Deactivate" : "Activate"}</Text>
        </Pressable>
        <Pressable
          style={[styles.actionBtn, item.isBlocked ? undefined : styles.actionBtnDanger]}
          onPress={() => (item.isBlocked ? unblock.mutate(item.studioId) : block.mutate(item.studioId))}
        >
          <Text style={[styles.actionText, !item.isBlocked && styles.actionTextDanger]}>
            {item.isBlocked ? "Unblock" : "Block"}
          </Text>
        </Pressable>
        {item.planName && (
          <Pressable style={styles.actionBtn} onPress={() => onRenew(item)}>
            <Text style={styles.actionText}>Renew</Text>
          </Pressable>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Studios</Text>
          <Text style={styles.subtitle}>{data?.totalCount ?? 0} total</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.activityButton} onPress={onViewDashboard}>
            <Text style={styles.activityButtonText}>Dashboard</Text>
          </Pressable>
          <Pressable style={styles.activityButton} onPress={onViewActivity}>
            <Text style={styles.activityButtonText}>Activity</Text>
          </Pressable>
          <Pressable style={styles.newButton} onPress={onCreate}>
            <Text style={styles.newButtonText}>+ New Studio</Text>
          </Pressable>
          <Pressable style={styles.signOutButton} onPress={() => navigation.navigate("ChangePassword")}>
            <Text style={styles.signOutText}>Change password</Text>
          </Pressable>
          <Pressable style={styles.signOutButton} onPress={() => logout()}>
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>
      </View>

      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="Search by name or email"
        placeholderTextColor="#6f83a0"
      />

      {isLoading ? (
        <ActivityIndicator color="#ff9a4d" style={{ marginTop: 40 }} />
      ) : isError ? (
        <Text style={styles.error}>Couldn't load studios.</Text>
      ) : (
        <FlatList
          data={data?.items ?? []}
          keyExtractor={(item) => String(item.studioId)}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={<Text style={styles.empty}>No studios yet — create the first one.</Text>}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d1826", padding: 24 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 },
  headerActions: { flexDirection: "row", gap: 10 },
  title: { fontSize: 24, fontWeight: "700", color: "#e8edf3" },
  subtitle: { fontSize: 13, color: "#6f83a0", marginTop: 2 },
  newButton: { backgroundColor: "#ff9a4d", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 },
  newButtonText: { color: "#0d1826", fontWeight: "700", fontSize: 13 },
  activityButton: { backgroundColor: "#132540", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: "#23405c" },
  activityButtonText: { color: "#7fc0e6", fontWeight: "600", fontSize: 13 },
  signOutButton: { backgroundColor: "#132540", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: "#23405c" },
  signOutText: { color: "#a7b7cb", fontWeight: "600", fontSize: 13 },
  search: {
    borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10,
    color: "#e8edf3", backgroundColor: "#132540", marginBottom: 16, fontSize: 14,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 14 },
  rowMain: { flex: 1, gap: 4 },
  studioName: { color: "#e8edf3", fontSize: 16, fontWeight: "600" },
  owner: { color: "#a7b7cb", fontSize: 13 },
  address: { color: "#6f83a0", fontSize: 12 },
  pillRow: { flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap" },
  subMeta: { color: "#6f83a0", fontSize: 12, marginTop: 4 },
  actions: { flexDirection: "row", gap: 8 },
  actionBtn: { borderWidth: 1, borderColor: "#23405c", borderRadius: 6, paddingVertical: 7, paddingHorizontal: 12 },
  actionBtnDanger: { borderColor: "rgba(255, 122, 114, 0.4)" },
  actionText: { color: "#a7b7cb", fontSize: 12, fontWeight: "600" },
  actionTextDanger: { color: "#ff7a72" },
  separator: { height: 1, backgroundColor: "#1b2c42" },
  error: { color: "#ff7a72", marginTop: 40, textAlign: "center" },
  empty: { color: "#6f83a0", marginTop: 40, textAlign: "center" },
});
