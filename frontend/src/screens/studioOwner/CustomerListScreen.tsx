import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { SubscriptionLock } from "../../components/SubscriptionLock";
import { customersApi } from "../../api/customersApi";
import type { Customer } from "../../types/customer";
import { StatusPill } from "../../components/StatusPill";
import { SearchInput } from "../../components/SearchInput";
import { useRefetchOnFocus } from "../../hooks/useRefetchOnFocus";
import { Screen } from "../../ui/Screen";
import { PageHeader } from "../../ui/PageHeader";
import { FilterChips } from "../../ui/FilterChips";
import { EmptyState } from "../../ui/EmptyState";
import { Button } from "../../ui/Button";
import { DataList, CellSub, CellTitle, type Column, type SortState } from "../../ui/DataList";
import { colors, space, type } from "../../ui/theme";

const PAGE_SIZE = 20;
type ActiveFilter = "all" | "active" | "inactive";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

export function CustomerListScreen({ onCreate, onEdit, onView }: { onCreate: () => void; onEdit: (customer: Customer) => void; onView: (customer: Customer) => void }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<ActiveFilter>("all");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState | null>(null);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["customers", search, active, page, sort?.by, sort?.desc],
    queryFn: () => customersApi.search({
      search: search || undefined,
      isActive: active === "all" ? undefined : active === "active",
      page,
      pageSize: PAGE_SIZE,
      sortBy: sort?.by,
      sortDesc: sort?.desc,
    }),
    placeholderData: keepPreviousData,
  });
  useRefetchOnFocus(refetch);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["customers"] });
  const activate = useMutation({ mutationFn: customersApi.activate, onSuccess: invalidate });
  const deactivate = useMutation({ mutationFn: customersApi.deactivate, onSuccess: invalidate });

  const actions = (c: Customer) => (
    <View style={styles.actionRow}>
      <SubscriptionLock compact>
        <Button label="Edit" variant="link" onPress={() => onEdit(c)} />
      </SubscriptionLock>
      <Button
        label={c.isActive ? "Deactivate" : "Activate"}
        variant="link"
        onPress={() => (c.isActive ? deactivate.mutate(c.customerId) : activate.mutate(c.customerId))}
      />
    </View>
  );

  const columns: Column<Customer>[] = [
    { key: "name", label: "Name", flex: 2, sortKey: "name", render: (c) => (<><CellTitle>{c.fullName}</CellTitle>{c.notes ? <CellSub>{c.notes}</CellSub> : null}</>) },
    { key: "contact", label: "Contact", flex: 2, render: (c) => (<><CellTitle>{c.mobileNumber}</CellTitle><CellSub>{c.email ?? "No email"}</CellSub></>) },
    { key: "address", label: "Address", flex: 2, render: (c) => <CellSub>{c.address ?? "—"}</CellSub> },
    { key: "status", label: "Status", width: 110, render: (c) => <StatusPill label={c.isActive ? "Active" : "Inactive"} tone={c.isActive ? "good" : "neutral"} /> },
    { key: "created", label: "Added", width: 120, sortKey: "created", render: (c) => <CellSub>{formatDate(c.createdAt)}</CellSub> },
    { key: "actions", label: "", width: 180, align: "right", render: actions },
  ];

  const setFilter = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };
  const filtered = !!search || active !== "all";

  return (
    <Screen>
      <PageHeader
        title="Customers"
        subtitle={data ? `${data.totalCount} customer${data.totalCount === 1 ? "" : "s"}` : null}
        actions={<SubscriptionLock><Button label="New customer" icon="add" variant="primary" onPress={onCreate} /></SubscriptionLock>}
      />
      <SearchInput style={{ marginBottom: space.md }} value={search} onChangeText={setFilter(setSearch)} placeholder="Search by name or mobile number" />
      <View style={{ marginBottom: space.lg }}>
        <FilterChips<ActiveFilter>
          options={[{ value: "all", label: "All" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]}
          value={active}
          onChange={setFilter(setActive)}
        />
      </View>

      <DataList
        items={data?.items}
        keyOf={(c) => c.customerId}
        columns={columns}
        onRowPress={onView}
        loading={isPending}
        error={isError ? "Couldn't load customers. Check your connection and try again." : null}
        onRetry={() => refetch()}
        sort={sort}
        onSortChange={(s) => { setSort(s); setPage(1); }}
        page={page}
        pageSize={PAGE_SIZE}
        totalCount={data?.totalCount ?? 0}
        onPageChange={setPage}
        empty={filtered ? (
          <EmptyState icon="search-outline" title="No customers match" text="Try a different name or mobile number."
            action={<Button label="Clear search" onPress={() => { setSearch(""); setActive("all"); setPage(1); }} />} />
        ) : (
          <EmptyState icon="people-outline" title="No customers yet" text="Add your first customer, or convert an enquiry into a customer."
            action={<Button label="New customer" icon="add" variant="primary" onPress={onCreate} />} />
        )}
        renderCard={(c) => (
          <>
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle} numberOfLines={1}>{c.fullName}</Text>
              <StatusPill label={c.isActive ? "Active" : "Inactive"} tone={c.isActive ? "good" : "neutral"} />
            </View>
            <Text style={styles.cardSub} numberOfLines={1}>{c.mobileNumber}{c.email ? ` · ${c.email}` : ""}</Text>
            {c.address ? <Text style={styles.cardMeta} numberOfLines={1}>{c.address}</Text> : null}
            <View style={styles.cardActions}>{actions(c)}</View>
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
