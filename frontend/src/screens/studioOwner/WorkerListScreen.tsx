import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { SubscriptionLock } from "../../components/SubscriptionLock";
import { workersApi } from "../../api/workersApi";
import { lookupApis } from "../../api/lookupsApi";
import type { Worker } from "../../types/worker";
import { StatusPill } from "../../components/StatusPill";
import { SearchInput } from "../../components/SearchInput";
import { useRefetchOnFocus } from "../../hooks/useRefetchOnFocus";
import { Screen } from "../../ui/Screen";
import { PageHeader } from "../../ui/PageHeader";
import { FilterChips } from "../../ui/FilterChips";
import { EmptyState } from "../../ui/EmptyState";
import { Button } from "../../ui/Button";
import { DataList, CellSub, CellTitle, type Column } from "../../ui/DataList";
import { colors, space, type } from "../../ui/theme";

const PAGE_SIZE = 20;

export function WorkerListScreen({ onCreate, onEdit, onView }: { onCreate: () => void; onEdit: (worker: Worker) => void; onView: (worker: Worker) => void }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [workerTypeId, setWorkerTypeId] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  const { data: workerTypes } = useQuery({ queryKey: ["lookups", "workerTypes"], queryFn: lookupApis.workerTypes.getAll });

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["workers", search, workerTypeId, page],
    queryFn: () => workersApi.search({ search: search || undefined, workerTypeId: workerTypeId ?? undefined, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  useRefetchOnFocus(refetch);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["workers"] });
  const activate = useMutation({ mutationFn: workersApi.activate, onSuccess: invalidate });
  const deactivate = useMutation({ mutationFn: workersApi.deactivate, onSuccess: invalidate });

  const actions = (w: Worker) => (
    <View style={styles.actionRow}>
      <SubscriptionLock compact>
        <Button label="Edit" variant="link" onPress={() => onEdit(w)} />
      </SubscriptionLock>
      <Button
        label={w.isActive ? "Deactivate" : "Activate"}
        variant="link"
        onPress={() => (w.isActive ? deactivate.mutate(w.workerId) : activate.mutate(w.workerId))}
      />
    </View>
  );

  const columns: Column<Worker>[] = [
    { key: "name", label: "Name", flex: 2, render: (w) => (<><CellTitle>{w.fullName}</CellTitle>{w.notes ? <CellSub>{w.notes}</CellSub> : null}</>) },
    { key: "role", label: "Role", flex: 1, render: (w) => <CellSub>{w.workerTypeName ?? "—"}</CellSub> },
    { key: "contact", label: "Contact", flex: 2, render: (w) => (<><CellTitle>{w.mobileNumber ?? "—"}</CellTitle><CellSub>{w.email ?? "No email"}</CellSub></>) },
    { key: "status", label: "Status", width: 110, render: (w) => <StatusPill label={w.isActive ? "Active" : "Inactive"} tone={w.isActive ? "good" : "neutral"} /> },
    { key: "actions", label: "", width: 180, align: "right", render: actions },
  ];

  const filtered = !!search || workerTypeId !== null;

  return (
    <Screen>
      <PageHeader
        title="Workers"
        subtitle={data ? `${data.totalCount} worker${data.totalCount === 1 ? "" : "s"}` : null}
        actions={<SubscriptionLock><Button label="New worker" icon="add" variant="primary" onPress={onCreate} /></SubscriptionLock>}
      />
      <SearchInput style={{ marginBottom: space.md }} value={search} onChangeText={(v) => { setSearch(v); setPage(1); }} placeholder="Search by name or mobile number" />
      {workerTypes && workerTypes.length > 0 && (
        <View style={{ marginBottom: space.lg }}>
          <FilterChips<number | null>
            options={[{ value: null, label: "All" }, ...workerTypes.map((t) => ({ value: t.id, label: t.name }))]}
            value={workerTypeId}
            onChange={(v) => { setWorkerTypeId(v); setPage(1); }}
          />
        </View>
      )}

      <DataList
        items={data?.items}
        keyOf={(w) => w.workerId}
        columns={columns}
        onRowPress={onView}
        loading={isPending}
        error={isError ? "Couldn't load workers. Check your connection and try again." : null}
        onRetry={() => refetch()}
        page={page}
        pageSize={PAGE_SIZE}
        totalCount={data?.totalCount ?? 0}
        onPageChange={setPage}
        empty={filtered ? (
          <EmptyState icon="search-outline" title="No workers match" text="Try a different name, mobile number or role."
            action={<Button label="Clear filters" onPress={() => { setSearch(""); setWorkerTypeId(null); setPage(1); }} />} />
        ) : (
          <EmptyState icon="people-outline" title="No workers yet" text="Add your photographers, videographers and editors so you can assign them to events."
            action={<Button label="New worker" icon="add" variant="primary" onPress={onCreate} />} />
        )}
        renderCard={(w) => (
          <>
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle} numberOfLines={1}>{w.fullName}</Text>
              <StatusPill label={w.isActive ? "Active" : "Inactive"} tone={w.isActive ? "good" : "neutral"} />
            </View>
            <Text style={styles.cardSub} numberOfLines={1}>
              {[w.workerTypeName, w.mobileNumber].filter(Boolean).join(" · ") || "No details"}
            </Text>
            {w.email ? <Text style={styles.cardMeta} numberOfLines={1}>{w.email}</Text> : null}
            <View style={styles.cardActions}>{actions(w)}</View>
          </>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  actionRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap" },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  cardTitle: { ...type.heading, color: colors.text, flex: 1 },
  cardSub: { ...type.small, color: colors.textMuted },
  cardMeta: { ...type.caption, color: colors.textFaint },
  cardActions: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: space.xs, paddingTop: space.xs, marginHorizontal: -space.sm },
});
