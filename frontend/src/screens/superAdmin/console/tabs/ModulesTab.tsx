import { useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { featuresApi } from "../../../../api/featuresApi";
import { extractErrorMessage } from "../../../../api/errorMessage";
import { Toggle } from "../../../../components/Toggle";
import { C, Card, ConfirmDialog, ErrorState, Loading, s } from "../ui";
import type { StudioFeature } from "../../../../types/feature";

// The order the admin reads them in, and an icon for each.
const ORDER: { code: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { code: "DASHBOARD", icon: "grid-outline" },
  { code: "LEADS", icon: "person-add-outline" },
  { code: "CUSTOMERS", icon: "people-outline" },
  { code: "EVENTS", icon: "calendar-outline" },
  { code: "QUOTATIONS", icon: "document-text-outline" },
  { code: "PAYMENTS", icon: "cash-outline" },
  { code: "EXPENSES", icon: "receipt-outline" },
  { code: "WORKERS", icon: "briefcase-outline" },
  { code: "PHOTO_SELECTION", icon: "images-outline" },
  { code: "PHOTO_DELIVERY", icon: "folder-open-outline" },
  { code: "WHATSAPP", icon: "logo-whatsapp" },
  { code: "REPORTS", icon: "bar-chart-outline" },
  { code: "GALLERY", icon: "globe-outline" },
  { code: "NOTIFICATIONS", icon: "notifications-outline" },
  { code: "SETTINGS", icon: "settings-outline" },
  { code: "SERVICES", icon: "pricetags-outline" },
  { code: "DAY_BOARD", icon: "today-outline" },
];

export function ModulesTab({ studioId, studioName }: { studioId: number; studioName: string }) {
  const queryClient = useQueryClient();
  const [pendingOff, setPendingOff] = useState<StudioFeature | null>(null);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["studio-features", studioId],
    queryFn: () => featuresApi.getForStudio(studioId),
  });

  const toggle = useMutation({
    mutationFn: ({ code, on }: { code: string; on: boolean }) => (on ? featuresApi.enable(studioId, code) : featuresApi.disable(studioId, code)),
    onSuccess: (updated) => {
      queryClient.setQueryData<StudioFeature[]>(["studio-features", studioId], (old) =>
        old?.map((f) => (f.featureCode === updated.featureCode ? updated : f)));
      queryClient.invalidateQueries({ queryKey: ["admin-activity"] });
      setPendingOff(null);
    },
  });

  if (isPending) return <Loading />;
  if (isError || !data) return <ErrorState text="Couldn't load the modules." onRetry={refetch} />;

  const byCode = new Map(data.map((f) => [f.featureCode, f]));
  const ordered = [
    ...ORDER.filter((o) => byCode.has(o.code)).map((o) => ({ feature: byCode.get(o.code)!, icon: o.icon })),
    ...data.filter((f) => !ORDER.some((o) => o.code === f.featureCode)).map((f) => ({ feature: f, icon: "cube-outline" as const })),
  ];
  const offCount = data.filter((f) => !f.isEnabled).length;

  return (
    <Card
      title="Modules"
      action={<Text style={s.faint}>{offCount === 0 ? "All modules on" : `${offCount} switched off`}</Text>}
    >
      <Text style={s.faint}>
        A module that is off is hidden from the studio and its data can't be reached through the API. Nothing is deleted —
        switching it back on brings everything back.
      </Text>
      <View style={styles.grid}>
        {ordered.map(({ feature, icon }) => {
          const busy = toggle.isPending && toggle.variables?.code === feature.featureCode;
          return (
            <View key={feature.featureCode} style={[styles.item, !feature.isEnabled && styles.itemOff]}>
              <View style={[styles.icon, !feature.isEnabled && { opacity: 0.5 }]}>
                <Ionicons name={icon} size={16} color={feature.isEnabled ? C.accent : C.faint} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, !feature.isEnabled && { color: C.muted }]}>{feature.featureName}</Text>
                <Text style={s.faint} numberOfLines={2}>{feature.description ?? ""}</Text>
              </View>
              {busy ? <ActivityIndicator size="small" color={C.accent} /> : (
                <Toggle
                  value={feature.isEnabled}
                  onValueChange={(on) => (on ? toggle.mutate({ code: feature.featureCode, on: true }) : setPendingOff(feature))}
                />
              )}
            </View>
          );
        })}
      </View>
      {toggle.isError && !pendingOff && <Text style={s.errorText}>{extractErrorMessage(toggle.error)}</Text>}

      <ConfirmDialog
        visible={!!pendingOff}
        title={`Switch off ${pendingOff?.featureName}?`}
        message={`${studioName} won't see ${pendingOff?.featureName} any more, and its API is blocked for them. Their data stays and comes back when you switch it on again.`}
        confirmLabel="Switch off"
        danger
        busy={toggle.isPending}
        error={toggle.isError ? extractErrorMessage(toggle.error) : null}
        onConfirm={() => pendingOff && toggle.mutate({ code: pendingOff.featureCode, on: false })}
        onCancel={() => { setPendingOff(null); toggle.reset(); }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  item: {
    flexGrow: 1, flexBasis: 300, flexDirection: "row", alignItems: "center", gap: 12, padding: 12,
    borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.raised,
  },
  itemOff: { backgroundColor: C.surface, borderStyle: "dashed" },
  icon: { width: 32, height: 32, borderRadius: 8, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" },
  name: { color: C.text, fontSize: 13.5, fontWeight: "700" },
});
