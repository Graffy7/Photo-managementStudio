import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { adminConsoleApi } from "../../../../api/adminConsoleApi";
import { BarChart } from "../BarChart";
import { Button, C, Card, DateRange, ErrorState, Field, Loading, StatCard, ago, bytes, dateTime, isoDay, minutes, s } from "../ui";

function last30() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 29);
  return { from: isoDay(start), to: isoDay(end) };
}

export function UsageTab({ studioId }: { studioId: number }) {
  const [range, setRange] = useState(last30);
  const [refresh, setRefresh] = useState(0);

  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ["admin-usage", studioId, range.from, range.to, refresh],
    queryFn: () => adminConsoleApi.usage(studioId, { ...range, refresh: refresh > 0 }),
    placeholderData: keepPreviousData,
  });

  if (isPending) return <Loading />;
  if (isError || !data) return <ErrorState text="Couldn't load usage." onRetry={refetch} />;

  const st = data.storage;
  const total = st.previewBytes + st.thumbnailBytes;
  const activeTotal = data.daily.reduce((sum, d) => sum + d.activeMinutes, 0);
  const activeDays = data.daily.filter((d) => d.activeMinutes > 0 || d.requests > 0).length;

  return (
    <View style={{ gap: 16 }}>
      <Card
        title="Storage"
        action={<Button label="Measure again" icon="refresh" small busy={isFetching && refresh > 0} onPress={() => setRefresh((n) => n + 1)} />}
      >
        <View style={styles.stats}>
          <StatCard label="Original photos" value={bytes(st.originalBytes)} icon="camera-outline"
            hint={st.missingOriginals > 0 ? `${st.missingOriginals} not found on disk` : "On the studio's own disk"} />
          <StatCard label="WebP previews" value={bytes(st.previewBytes)} icon="image-outline" hint="1600px, what customers view" />
          <StatCard label="Thumbnails" value={bytes(st.thumbnailBytes)} icon="grid-outline" hint="360px, for the grid" />
          <StatCard label="Total app storage" value={bytes(total)} icon="server-outline"
            hint={`${st.photoCount.toLocaleString("en-IN")} photos`} />
        </View>
        <Text style={s.faint}>Measured {dateTime(data.storageMeasuredAt)}. Originals are read in place and never copied into the app.</Text>
      </Card>

      <View style={styles.row}>
        <Card title="Records" style={styles.flex}>
          <View style={styles.fields}>
            {Object.entries(data.records).map(([k, v]) => <Field key={k} label={k} value={v.toLocaleString("en-IN")} />)}
          </View>
        </Card>
        <Card title="Feature usage" style={styles.flex}>
          <View style={{ gap: 8 }}>
            {data.featureUsage.map((f) => (
              <View key={f.name} style={styles.featureRow}>
                <Text style={styles.featureName}>{f.name}</Text>
                <Text style={styles.featureCount}>{f.count.toLocaleString("en-IN")}</Text>
              </View>
            ))}
          </View>
        </Card>
      </View>

      <Card title="Daily active time" action={<DateRange from={range.from} to={range.to} onChange={(from, to) => setRange({ from, to })} />}>
        <View style={styles.fields}>
          <Field label="Active in range" value={minutes(activeTotal)} />
          <Field label="Days used" value={`${activeDays} of ${data.daily.length}`} />
          <Field label="Average per active day" value={activeDays ? minutes(Math.round(activeTotal / activeDays)) : "—"} />
          <Field label="Last activity" value={ago(data.lastActivityAt)} />
        </View>
        {activeTotal === 0 ? (
          <Text style={s.faint}>No activity recorded in this range. Active time is counted from when this console was added.</Text>
        ) : (
          <BarChart
            height={130}
            data={data.daily.map((d) => ({
              label: new Date(d.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
              value: d.activeMinutes,
            }))}
            format={minutes}
            color={C.accent}
          />
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  flex: { flexGrow: 1, flexBasis: 340, minWidth: 0 },
  fields: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  featureRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: C.border },
  featureName: { color: C.muted, fontSize: 13 },
  featureCount: { color: C.text, fontSize: 13, fontWeight: "700", fontVariant: ["tabular-nums"] },
});
