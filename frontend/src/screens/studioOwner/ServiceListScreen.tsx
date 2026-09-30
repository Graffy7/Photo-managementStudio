import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { SubscriptionLock } from "../../components/SubscriptionLock";
import { servicesApi } from "../../api/servicesApi";
import type { StudioService } from "../../types/service";
import { StatusPill } from "../../components/StatusPill";
import { SearchInput } from "../../components/SearchInput";
import { useRefetchOnFocus } from "../../hooks/useRefetchOnFocus";
import { Screen } from "../../ui/Screen";
import { PageHeader } from "../../ui/PageHeader";
import { FilterChips } from "../../ui/FilterChips";
import { EmptyState } from "../../ui/EmptyState";
import { Button } from "../../ui/Button";
import { DataList, CellMoney, CellSub, CellTitle, type Column } from "../../ui/DataList";
import { colors, space, type } from "../../ui/theme";

const PAGE_SIZE = 20;
type ActiveFilter = "all" | "active" | "inactive";

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function ServiceListScreen({ onCreate, onEdit }: { onCreate: () => void; onEdit: (service: StudioService) => void }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<ActiveFilter>("all");
  const [page, setPage] = useState(1);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["services", search, active, page],
    queryFn: () => servicesApi.search({
      search: search || undefined,
      isActive: active === "all" ? undefined : active === "active",
      page,
      pageSize: PAGE_SIZE,
    }),
    placeholderData: keepPreviousData,
  });
  useRefetchOnFocus(refetch);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["services"] });
  const activate = useMutation({ mutationFn: servicesApi.activate, onSuccess: invalidate });
  const deactivate = useMutation({ mutationFn: servicesApi.deactivate, onSuccess: invalidate });

  const actions = (s: StudioService) => (
    <View style={styles.actionRow}>
      <SubscriptionLock compact>
        <Button label="Edit" variant="link" onPress={() => onEdit(s)} />
      </SubscriptionLock>
      <Button
        label={s.isActive ? "Deactivate" : "Activate"}
        variant="link"
        onPress={() => (s.isActive ? deactivate.mutate(s.serviceId) : activate.mutate(s.serviceId))}
      />
    </View>
  );

  const columns: Column<StudioService>[] = [
    { key: "name", label: "Service", flex: 3, render: (s) => (<><CellTitle>{s.serviceName}</CellTitle>{s.description ? <CellSub>{s.description}</CellSub> : null}</>) },
    { key: "price", label: "Default price", width: 140, align: "right", render: (s) => <CellMoney>{formatCurrency(s.defaultPrice)}</CellMoney> },
    { key: "status", label: "Status", width: 120, render: (s) => <StatusPill label={s.isActive ? "Active" : "Inactive"} tone={s.isActive ? "good" : "neutral"} /> },
    { key: "actions", label: "", width: 180, align: "right", render: actions },
  ];

  const filtered = !!search || active !== "all";

  return (
    <Screen>
      <PageHeader
        title="Services"
        subtitle={data ? `${data.totalCount} service${data.totalCount === 1 ? "" : "s"}` : null}
        actions={<SubscriptionLock><Button label="New service" icon="add" variant="primary" onPress={onCreate} /></SubscriptionLock>}
      />
      <SearchInput style={{ marginBottom: space.md }} value={search} onChangeText={(v) => { setSearch(v); setPage(1); }} placeholder="Search by service name" />
      <View style={{ marginBottom: space.lg }}>
        <FilterChips<ActiveFilter>
          options={[{ value: "all", label: "All" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]}
          value={active}
          onChange={(v) => { setActive(v); setPage(1); }}
        />
      </View>

      <DataList
        items={data?.items}
        keyOf={(s) => s.serviceId}
        columns={columns}
        onRowPress={onEdit}
        loading={isPending}
        error={isError ? "Couldn't load services. Check your connection and try again." : null}
        onRetry={() => refetch()}
        page={page}
        pageSize={PAGE_SIZE}
        totalCount={data?.totalCount ?? 0}
        onPageChange={setPage}
        empty={filtered ? (
          <EmptyState icon="search-outline" title="No services match" text="Try a different name."
            action={<Button label="Clear search" onPress={() => { setSearch(""); setActive("all"); setPage(1); }} />} />
        ) : (
          <EmptyState icon="pricetags-outline" title="No services yet" text="Add what you offer — candid photography, albums, drone — with a default price to speed up quotations."
            action={<Button label="New service" icon="add" variant="primary" onPress={onCreate} />} />
        )}
        renderCard={(s) => (
          <>
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle} numberOfLines={1}>{s.serviceName}</Text>
              <StatusPill label={s.isActive ? "Active" : "Inactive"} tone={s.isActive ? "good" : "neutral"} />
            </View>
            <Text style={styles.cardPrice}>{formatCurrency(s.defaultPrice)}</Text>
            {s.description ? <Text style={styles.cardMeta} numberOfLines={2}>{s.description}</Text> : null}
            <View style={styles.cardActions}>{actions(s)}</View>
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
  cardPrice: { ...type.body, fontWeight: "600", color: colors.text, fontVariant: ["tabular-nums"] },
  cardMeta: { ...type.small, color: colors.textMuted },
  cardActions: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: space.xs, paddingTop: space.xs, marginHorizontal: -space.sm },
});
