import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { adminConsoleApi } from "../../../api/adminConsoleApi";
import { studiosApi } from "../../../api/studiosApi";
import { extractErrorMessage } from "../../../api/errorMessage";
import { SearchInput } from "../../../components/SearchInput";
import { useRefetchOnFocus } from "../../../hooks/useRefetchOnFocus";
import {
  Button, C, Chips, ConfirmDialog, DaysLeft, EmptyState, ErrorState, Loading, PageHeader, Pagination, StatusBadge,
  ago, bytes, money, s,
} from "./ui";
import type { AdminStudioRow, AdminStudioStatus } from "../../../types/adminConsole";

const PAGE_SIZE = 10;

const STATUS_FILTERS: { key: AdminStudioStatus | "All"; label: string }[] = [
  { key: "All", label: "All" },
  { key: "Active", label: "Active" },
  { key: "Trial", label: "Trial" },
  { key: "Expired", label: "Expired" },
  { key: "NoPlan", label: "No plan" },
  { key: "Blocked", label: "Blocked" },
  { key: "Inactive", label: "Inactive" },
];

const SORTS = [
  { key: "name", label: "Name" },
  { key: "daysRemaining", label: "Ending soonest" },
  { key: "lastActive", label: "Recently active" },
  { key: "totalPaid", label: "Most paid" },
  { key: "storage", label: "Most storage" },
  { key: "newest", label: "Newest" },
] as const;

type SortKey = (typeof SORTS)[number]["key"];

// Column widths for the wide table (it scrolls sideways inside its card when space runs out).
const COLS = { studio: 230, status: 105, plan: 95, days: 95, months: 75, paid: 105, storage: 90, active: 110, actions: 150 };
const TABLE_WIDTH = Object.values(COLS).reduce((a, b) => a + b, 0) + 32;

export function AdminStudiosScreen({ initialStatus, onOpen, onCreate, onEdit }: {
  initialStatus?: AdminStudioStatus;
  onOpen: (studioId: number) => void;
  onCreate: () => void;
  onEdit: (studioId: number) => void;
}) {
  const queryClient = useQueryClient();
  const narrow = useWindowDimensions().width < 900;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AdminStudioStatus | "All">(initialStatus ?? "All");
  const [sort, setSort] = useState<SortKey>("name");
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<{ row: AdminStudioRow; action: "block" | "unblock" } | null>(null);

  useEffect(() => setPage(1), [search, status, sort]);
  useEffect(() => { if (initialStatus) setStatus(initialStatus); }, [initialStatus]);

  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ["admin-studios", search, status, sort, page],
    queryFn: () => adminConsoleApi.studios({
      search: search || undefined, status: status === "All" ? undefined : status, sort, page, pageSize: PAGE_SIZE,
    }),
    placeholderData: keepPreviousData,
  });
  useRefetchOnFocus(refetch);

  const toggleBlock = useMutation({
    mutationFn: ({ row, action }: { row: AdminStudioRow; action: "block" | "unblock" }) =>
      action === "block" ? studiosApi.block(row.studioId) : studiosApi.unblock(row.studioId),
    onSuccess: () => {
      setPending(null);
      queryClient.invalidateQueries({ queryKey: ["admin-studios"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
  });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <PageHeader
        title="Studios"
        subtitle={data ? `${data.totalCount} studio${data.totalCount === 1 ? "" : "s"}` : "Every studio on the platform"}
        actions={<Button label="New studio" icon="add" kind="primary" onPress={onCreate} />}
      />

      <View style={styles.filters}>
        <SearchInput style={styles.search} value={search} onChangeText={setSearch} placeholder="Search studio, owner, email or phone" />
        <Chips options={STATUS_FILTERS} value={status} onChange={setStatus} />
        <View style={styles.sortRow}>
          <Ionicons name="swap-vertical" size={14} color={C.faint} />
          <Chips options={SORTS.map((x) => ({ key: x.key, label: x.label }))} value={sort} onChange={(v) => setSort(v as SortKey)} />
        </View>
      </View>

      <View style={styles.tableCard}>
        {isPending ? <Loading /> : isError || !data ? <ErrorState text="Couldn't load the studios." onRetry={refetch} /> :
          data.items.length === 0 ? (
            <EmptyState icon="business-outline" title="No studios match" text="Try a different search or status." />
          ) : narrow ? (
            <View style={{ gap: 10, padding: 12 }}>
              {data.items.map((r) => <StudioCard key={r.studioId} row={r} onOpen={() => onOpen(r.studioId)} />)}
            </View>
          ) : (
            <ScrollView horizontal contentContainerStyle={{ minWidth: "100%" }}>
              <View style={{ width: "100%", minWidth: TABLE_WIDTH }}>
                <View style={[styles.tr, styles.thead]}>
                  <Th w={COLS.studio}>Studio</Th>
                  <Th w={COLS.status}>Status</Th>
                  <Th w={COLS.plan}>Plan</Th>
                  <Th w={COLS.days}>Days left</Th>
                  <Th w={COLS.months} right>Months</Th>
                  <Th w={COLS.paid} right>Total paid</Th>
                  <Th w={COLS.storage} right>Storage</Th>
                  <Th w={COLS.active}>Last active</Th>
                  <Th w={COLS.actions} right>Actions</Th>
                </View>
                {data.items.map((r) => (
                  <Pressable
                    key={r.studioId}
                    onPress={() => onOpen(r.studioId)}
                    style={({ hovered }: any) => [styles.tr, hovered && styles.trHover]}
                    // No "button" role: the row holds its own action buttons, and a button can't
                    // contain buttons. The name and the › action are keyboard-reachable instead.
                    accessibilityLabel={`Open ${r.studioName}`}
                  >
                    <View style={[styles.td, { width: COLS.studio, flexGrow: 1 }]}>
                      <Text style={styles.name} numberOfLines={1}>{r.studioName}</Text>
                      <Text style={s.faint} numberOfLines={1}>{r.ownerName ?? "—"} · {r.ownerEmail ?? "no email"}</Text>
                    </View>
                    <View style={[styles.td, { width: COLS.status }]}><StatusBadge status={r.status} /></View>
                    <View style={[styles.td, { width: COLS.plan }]}><Text style={styles.cell}>{r.planName ?? "—"}</Text></View>
                    <View style={[styles.td, { width: COLS.days }]}><DaysLeft status={r.status} days={r.daysRemaining} /></View>
                    <View style={[styles.td, { width: COLS.months }]}><Text style={[styles.cell, styles.right]}>{r.monthsSubscribed}</Text></View>
                    <View style={[styles.td, { width: COLS.paid }]}><Text style={[styles.cell, styles.right]}>{money(r.totalPaid)}</Text></View>
                    <View style={[styles.td, { width: COLS.storage }]}><Text style={[styles.cell, styles.right]}>{bytes(r.appStorageBytes)}</Text></View>
                    <View style={[styles.td, { width: COLS.active }]}><Text style={styles.cellMuted}>{ago(r.lastActiveAt)}</Text></View>
                    <View style={[styles.td, styles.actions, { width: COLS.actions }]}>
                      <IconAction icon="create-outline" label={`Edit ${r.studioName}`} onPress={() => onEdit(r.studioId)} />
                      <IconAction
                        icon={r.isBlocked ? "lock-open-outline" : "ban-outline"}
                        label={`${r.isBlocked ? "Unblock" : "Block"} ${r.studioName}`}
                        danger={!r.isBlocked}
                        onPress={() => setPending({ row: r, action: r.isBlocked ? "unblock" : "block" })}
                      />
                      <IconAction icon="chevron-forward" label={`Open ${r.studioName}`} onPress={() => onOpen(r.studioId)} />
                    </View>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          )}
        {data && <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
          <Pagination page={page} pageSize={PAGE_SIZE} total={data.totalCount} onPage={setPage} />
        </View>}
        {isFetching && !isPending && <View style={styles.refreshing} />}
      </View>

      <ConfirmDialog
        visible={!!pending}
        title={pending?.action === "block" ? `Block ${pending.row.studioName}?` : `Unblock ${pending?.row.studioName}?`}
        message={pending?.action === "block"
          ? "The owner won't be able to sign in and the studio's customer links stop working until it is unblocked. No data is deleted."
          : "The owner can sign in again and customer links work again."}
        confirmLabel={pending?.action === "block" ? "Block studio" : "Unblock"}
        danger={pending?.action === "block"}
        busy={toggleBlock.isPending}
        error={toggleBlock.isError ? extractErrorMessage(toggleBlock.error) : null}
        onConfirm={() => pending && toggleBlock.mutate(pending)}
        onCancel={() => { setPending(null); toggleBlock.reset(); }}
      />
    </ScrollView>
  );
}

function Th({ w, right, children }: { w: number; right?: boolean; children: string }) {
  return (
    <View style={[styles.td, { width: w }, w === COLS.studio && { flexGrow: 1 }]}>
      <Text style={[styles.th, right && styles.right]}>{children}</Text>
    </View>
  );
}

function IconAction({ icon, label, onPress, danger }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable
      onPress={(e) => { e.stopPropagation?.(); onPress(); }}
      style={({ hovered }: any) => [styles.iconBtn, hovered && styles.iconBtnHover]}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
    >
      <Ionicons name={icon} size={15} color={danger ? C.bad : C.muted} />
    </Pressable>
  );
}

function StudioCard({ row, onOpen }: { row: AdminStudioRow; onOpen: () => void }) {
  return (
    <Pressable style={styles.mCard} onPress={onOpen} accessibilityRole="button">
      <View style={styles.mTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{row.studioName}</Text>
          <Text style={s.faint} numberOfLines={1}>{row.ownerName ?? "—"}</Text>
        </View>
        <StatusBadge status={row.status} />
      </View>
      <View style={styles.mGrid}>
        <Mini label="Plan" value={row.planName ?? "—"} />
        <Mini label="Days left" value={row.status === "Active" || row.status === "Trial" ? String(row.daysRemaining) : "—"} />
        <Mini label="Paid" value={money(row.totalPaid)} />
        <Mini label="Storage" value={bytes(row.appStorageBytes)} />
        <Mini label="Last active" value={ago(row.lastActiveAt)} />
      </View>
    </Pressable>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ minWidth: 90, flexGrow: 1 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <Text style={styles.cell}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.page },
  content: { padding: 24, gap: 16, maxWidth: 1400, width: "100%", alignSelf: "center" },
  filters: { gap: 10 },
  search: { maxWidth: 420 },
  sortRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  tableCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, overflow: "hidden", position: "relative" },
  tr: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  thead: { backgroundColor: C.raised },
  trHover: { backgroundColor: "rgba(127,192,230,0.05)" },
  td: { paddingVertical: 12, paddingRight: 12, justifyContent: "center" },
  th: { color: C.faint, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  name: { color: C.text, fontSize: 13.5, fontWeight: "700" },
  cell: { color: C.text, fontSize: 13, fontVariant: ["tabular-nums"] },
  cellMuted: { color: C.muted, fontSize: 12.5 },
  right: { textAlign: "right" },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 4 },
  iconBtn: { width: 30, height: 30, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  iconBtnHover: { backgroundColor: C.raised },
  refreshing: { position: "absolute", top: 0, left: 0, right: 0, height: 2, backgroundColor: C.accent, opacity: 0.6 },
  mCard: { backgroundColor: C.raised, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 14, gap: 10 },
  mTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  mGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
});
