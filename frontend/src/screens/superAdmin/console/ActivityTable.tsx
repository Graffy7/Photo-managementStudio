import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, useWindowDimensions } from "react-native";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { adminConsoleApi } from "../../../api/adminConsoleApi";
import { SearchInput } from "../../../components/SearchInput";
import { C, Card, Chips, DateRange, EmptyState, ErrorState, Loading, Pagination, dateTime, isoDay, s } from "./ui";

const PAGE_SIZE = 20;

function last30() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 29);
  return { from: isoDay(start), to: isoDay(end) };
}

// Who did what, where: used for one studio (its Activity tab) and for the whole platform.
export function ActivityTable({ studioId }: { studioId?: number }) {
  const narrow = useWindowDimensions().width < 820;
  const [range, setRange] = useState(last30);
  const [module, setModule] = useState("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [range, module, search]);

  const { data: modules } = useQuery({
    queryKey: ["admin-activity-modules", studioId ?? "all"],
    queryFn: () => adminConsoleApi.activityModules(studioId),
  });

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["admin-activity", studioId ?? "all", range.from, range.to, module, search, page],
    queryFn: () => adminConsoleApi.activity({
      studioId, from: range.from, to: range.to, module: module === "All" ? undefined : module,
      search: search || undefined, page, pageSize: PAGE_SIZE,
    }),
    placeholderData: keepPreviousData,
  });

  const showStudio = studioId === undefined;

  return (
    <Card>
      <View style={styles.filters}>
        <SearchInput style={styles.search} value={search} onChangeText={setSearch} placeholder={showStudio ? "Search action, studio or user" : "Search action or user"} />
        <DateRange from={range.from} to={range.to} onChange={(from, to) => setRange({ from, to })} />
      </View>
      <Chips options={["All", ...(modules ?? [])].map((m) => ({ key: m, label: m === "All" ? "All modules" : m }))} value={module} onChange={setModule} />

      {isPending ? <Loading /> : isError || !data ? <ErrorState text="Couldn't load activity." onRetry={refetch} /> :
        data.items.length === 0 ? <EmptyState icon="time-outline" title="No activity in this range" text="Try a wider date range or another module." /> :
          narrow ? (
            <View style={{ gap: 8 }}>
              {data.items.map((a) => (
                <View key={a.id} style={styles.mRow}>
                  <Text style={styles.action}>{a.action}</Text>
                  <Text style={s.faint}>{dateTime(a.createdAt)} · {a.module}{showStudio && a.studioName ? ` · ${a.studioName}` : ""}</Text>
                  <Text style={s.faint}>{who(a.userName, a.userType)}{a.device ? ` · ${a.device}` : ""}{a.ipAddress ? ` · ${a.ipAddress}` : ""}</Text>
                </View>
              ))}
            </View>
          ) : (
            <ScrollView horizontal contentContainerStyle={{ minWidth: "100%" }}>
              <View style={{ width: "100%", minWidth: showStudio ? 980 : 820 }}>
                <View style={[styles.tr, styles.thead]}>
                  <Text style={[styles.th, { width: 150 }]}>Date / time</Text>
                  {showStudio && <Text style={[styles.th, { width: 160 }]}>Studio</Text>}
                  <Text style={[styles.th, { width: 120 }]}>Module</Text>
                  <Text style={[styles.th, { flex: 1 }]}>Action</Text>
                  <Text style={[styles.th, { width: 150 }]}>User</Text>
                  <Text style={[styles.th, { width: 170 }]}>Device / IP</Text>
                </View>
                {data.items.map((a) => (
                  <View key={a.id} style={styles.tr}>
                    <Text style={[styles.cellMuted, { width: 150 }]}>{dateTime(a.createdAt)}</Text>
                    {showStudio && <Text style={[styles.cell, { width: 160 }]} numberOfLines={1}>{a.studioName ?? "Platform"}</Text>}
                    <View style={{ width: 120 }}><Text style={styles.module}>{a.module}</Text></View>
                    <Text style={[styles.action, { flex: 1 }]} numberOfLines={2}>{a.action}</Text>
                    <Text style={[styles.cell, { width: 150 }]} numberOfLines={1}>{who(a.userName, a.userType)}</Text>
                    <View style={{ width: 170 }}>
                      <Text style={styles.cellMuted} numberOfLines={1}>{a.device ?? "—"}</Text>
                      {!!a.ipAddress && <Text style={s.faint} numberOfLines={1}>{a.ipAddress}</Text>}
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
      {data && <Pagination page={page} pageSize={PAGE_SIZE} total={data.totalCount} onPage={setPage} />}
    </Card>
  );
}

function who(name: string | null, type: string | null): string {
  if (!name) return "System";
  return type === "SUPER_ADMIN" ? `${name} (admin)` : name;
}

const styles = StyleSheet.create({
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" },
  search: { flexGrow: 1, maxWidth: 380, minWidth: 220 },
  tr: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  thead: { paddingVertical: 8 },
  th: { color: C.faint, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  cell: { color: C.text, fontSize: 12.5 },
  cellMuted: { color: C.muted, fontSize: 12 },
  action: { color: C.text, fontSize: 13, fontWeight: "600" },
  module: { alignSelf: "flex-start", color: C.accent, fontSize: 11, fontWeight: "700", borderWidth: 1, borderColor: C.border, borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2 },
  mRow: { borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12, gap: 3, backgroundColor: C.raised },
});
