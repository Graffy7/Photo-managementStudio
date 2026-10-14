import { useEffect, useState } from "react";
import { View, Text, TextInput, ScrollView, StyleSheet, useWindowDimensions } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { adminConsoleApi } from "../../../api/adminConsoleApi";
import type { StudioStorage } from "../../../types/adminConsole";
import { Button, C, Card, ErrorState, Loading, PageHeader, StatCard, ago, bytes, bytesBinary } from "./ui";

const PRICE_KEY = "studio_os_storage_price_per_gb";

function readPrice(): number | null {
  try {
    const v = localStorage.getItem(PRICE_KEY);
    return v === null ? null : Number(v);
  } catch {
    return null;
  }
}

function cost(bytesUsed: number, pricePerGb: number): number {
  return (bytesUsed / 1_000_000_000) * pricePerGb;
}

function money(v: number, currency: string): string {
  const symbol = currency === "INR" ? "₹" : `${currency} `;
  return `${symbol}${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const AREA_LABELS: Record<string, string> = {
  "photo-gallery": "Photo previews & thumbnails",
  logos: "Studio logos",
  signatures: "Quotation signatures",
};

// Super Admin → Storage: what the app really stores on the server, measured from the files themselves.
// Originals are never stored by the app; they are shown separately for context (where they live).
export function AdminStorageScreen() {
  const wide = useWindowDimensions().width >= 1100;
  const [refreshing, setRefreshing] = useState(false);
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["admin-storage"], queryFn: () => adminConsoleApi.storage(false) });

  // Price per decimal GB per month: starts from the server's setting (StorageReport:PricePerGbMonth);
  // the admin can try another price here (remembered in this browser).
  const [priceText, setPriceText] = useState("");
  useEffect(() => {
    if (!data) return;
    const saved = readPrice();
    setPriceText(String(saved ?? data.pricePerGbMonth));
  }, [data?.pricePerGbMonth]);
  const price = Number(priceText);
  const priceOk = priceText.trim() !== "" && Number.isFinite(price) && price >= 0;
  const savePrice = (v: string) => {
    setPriceText(v.replace(/[^0-9.]/g, ""));
    try { localStorage.setItem(PRICE_KEY, v.replace(/[^0-9.]/g, "")); } catch { /* private window */ }
  };

  const remeasure = async () => {
    setRefreshing(true);
    try {
      await adminConsoleApi.storage(true);
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  if (isPending) return <View style={styles.screen}><Loading /></View>;
  if (isError || !data) return <View style={styles.screen}><ErrorState text="Couldn't measure storage." onRetry={() => refetch()} /></View>;

  const d = data;
  const sum = (f: (x: StudioStorage) => number) => d.studios.reduce((t, x) => t + f(x), 0);
  const previews = sum((x) => x.previewBytes);
  const thumbs = sum((x) => x.thumbnailBytes);
  const pending = sum((x) => x.awaitingCleanupBytes) + sum((x) => x.orphanBytes) + d.unassignedOrphanBytes;
  const neverSent = sum((x) => x.neverSentBytes);
  const activeGalleries = sum((x) => x.activeGalleryCount);
  const photosWithPreviews = sum((x) => x.photosWithPreviews);
  const monthly = priceOk ? cost(d.totalStoredBytes, price) : 0;
  const studios = d.studios.filter((x) => x.photoCount > 0 || x.galleryCount > 0);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <PageHeader
        title="Storage"
        subtitle={`Measured from the files on the server · ${ago(d.measuredAt)}`}
        actions={<Button label="Measure again" icon="refresh" onPress={remeasure} busy={refreshing} />}
      />

      <View style={styles.stats}>
        <StatCard label="Total server storage" value={bytes(d.totalStoredBytes)} icon="server-outline"
          hint={`${bytesBinary(d.totalStoredBytes)} · ${d.totalStoredFiles.toLocaleString("en-IN")} files`} />
        <StatCard label="Photo previews" value={bytes(previews)} icon="image-outline"
          hint={`+ ${bytes(thumbs)} thumbnails · ${photosWithPreviews.toLocaleString("en-IN")} photos`} />
        <StatCard label="Active galleries" value={String(activeGalleries)} icon="images-outline"
          hint="Galleries whose previews are on the server" />
        <StatCard label="Pending cleanup" value={bytes(pending)} icon="trash-outline" tone={pending > 0 ? C.warn : C.good}
          hint="Expired previews + files no photo uses" />
        <StatCard label="Estimated monthly cost" value={priceOk ? money(monthly, d.currency) : "—"} icon="wallet-outline"
          hint={priceOk ? `${bytes(d.totalStoredBytes)} × ${money(price, d.currency)} per GB` : "Enter a price per GB below"} />
      </View>

      <View style={[styles.row, wide && styles.rowWide]}>
        <Card title="Monthly cost" style={styles.grow1}>
          <Text style={styles.text}>Price your storage provider charges per GB per month ({d.currency}). 1 GB = 1,000,000,000 bytes, which is how providers bill.</Text>
          <View style={styles.priceRow}>
            <Text style={styles.text}>{d.currency === "INR" ? "₹" : d.currency}</Text>
            <TextInput
              value={priceText}
              onChangeText={savePrice}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={C.faint}
              style={styles.priceInput}
              accessibilityLabel="Price per GB per month"
            />
            <Text style={styles.text}>per GB per month</Text>
          </View>
          {priceOk && (
            <View style={{ gap: 4 }}>
              <Text style={styles.text}>Today: <Text style={styles.strong}>{money(monthly, d.currency)}</Text> a month for {bytes(d.totalStoredBytes)}.</Text>
              <Text style={styles.muted}>Cleaning up what is pending would save {money(cost(pending, price), d.currency)} a month.</Text>
            </View>
          )}
          <Text style={styles.muted}>The server's default is set in StorageReport:PricePerGbMonth; a price typed here is remembered in this browser.</Text>
        </Card>

        <Card title="What is stored" style={styles.grow1}>
          {Object.entries(d.storedBytesByArea).filter(([, v]) => v > 0).map(([area, v]) => (
            <View key={area} style={styles.line}>
              <Text style={styles.text}>{AREA_LABELS[area] ?? area}</Text>
              <Text style={styles.value}>{bytes(v)}</Text>
            </View>
          ))}
          <View style={styles.line}>
            <Text style={styles.text}>Never-sent galleries (not covered by cleanup)</Text>
            <Text style={[styles.value, neverSent > 0 && { color: C.warn }]}>{bytes(neverSent)}</Text>
          </View>
          <View style={styles.line}>
            <Text style={styles.text}>Files of deleted galleries</Text>
            <Text style={[styles.value, d.unassignedOrphanBytes > 0 && { color: C.warn }]}>{bytes(d.unassignedOrphanBytes)} ({d.unassignedOrphanFiles})</Text>
          </View>
          <Text style={styles.muted}>
            Previews {d.previewMaxDimension}px WebP q{d.previewQuality}; thumbnails {d.thumbnailMaxDimension}px q{d.thumbnailQuality}.
            Previews are removed {d.previewRetentionDays} days after a link is sent, once it has expired. Original photos are never stored by the app.
          </Text>
        </Card>
      </View>

      <Card title="By studio">
        <ScrollView horizontal>
          <View style={{ minWidth: 1180 }}>
            <View style={[styles.tr, styles.th]}>
              {["Studio", "Galleries (active)", "Photos (with previews)", "Previews", "Thumbnails", "Stored total", "Pending cleanup", "Never sent", "Originals on server", "Originals on studio PCs", "Monthly cost"].map((h, i) => (
                <Text key={h} style={[styles.thText, { width: COLS[i] }, i > 0 && styles.right]}>{h}</Text>
              ))}
            </View>
            {studios.map((x) => {
              const storedHere = x.appBytes + x.orphanBytes;
              const pendingHere = x.awaitingCleanupBytes + x.orphanBytes;
              return (
                <View key={x.studioId} style={styles.tr}>
                  <Text style={[styles.td, styles.strong, { width: COLS[0] }]} numberOfLines={1}>{x.studioName}</Text>
                  <Text style={[styles.td, styles.right, { width: COLS[1] }]}>{x.galleryCount} ({x.activeGalleryCount})</Text>
                  <Text style={[styles.td, styles.right, { width: COLS[2] }]}>{x.photoCount.toLocaleString("en-IN")} ({x.photosWithPreviews.toLocaleString("en-IN")})</Text>
                  <Text style={[styles.td, styles.right, { width: COLS[3] }]}>{bytes(x.previewBytes)}</Text>
                  <Text style={[styles.td, styles.right, { width: COLS[4] }]}>{bytes(x.thumbnailBytes)}</Text>
                  <Text style={[styles.td, styles.right, styles.strong, { width: COLS[5] }]}>{bytes(storedHere)}</Text>
                  <Text style={[styles.td, styles.right, { width: COLS[6] }, pendingHere > 0 && { color: C.warn }]}>{bytes(pendingHere)}</Text>
                  <Text style={[styles.td, styles.right, { width: COLS[7] }, x.neverSentBytes > 0 && { color: C.warn }]}>{bytes(x.neverSentBytes)}</Text>
                  <Text style={[styles.td, styles.right, { width: COLS[8] }]}>{x.originalsOnServerCount ? `${bytes(x.originalsOnServerBytes)} (${x.originalsOnServerCount})` : "—"}</Text>
                  <Text style={[styles.td, styles.right, { width: COLS[9] }]}>
                    {x.originalsOnComputerCount ? `${bytes(x.originalsOnComputerBytes)} (${x.originalsOnComputerCount})` : "—"}
                    {x.missingOriginals ? `  · ${x.missingOriginals} not measurable` : ""}
                  </Text>
                  <Text style={[styles.td, styles.right, { width: COLS[10] }]}>{priceOk ? money(cost(storedHere, price), d.currency) : "—"}</Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
        <Text style={styles.muted}>
          Stored total = previews + thumbnails + leftover files in the studio's gallery folders. "Originals on server" are read in place from the
          studio's photo folder (they belong to the studio, not to the app's storage); "on studio PCs" were never uploaded.
        </Text>
      </Card>
    </ScrollView>
  );
}

const COLS = [190, 110, 140, 90, 90, 100, 110, 90, 140, 160, 100];

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.page },
  content: { padding: 24, gap: 16, width: "100%", maxWidth: 1600, alignSelf: "center" },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  row: { gap: 16 },
  rowWide: { flexDirection: "row", alignItems: "flex-start" },
  grow1: { flex: 1, minWidth: 0 },
  text: { color: C.text, fontSize: 14, lineHeight: 20 },
  muted: { color: C.muted, fontSize: 13, lineHeight: 18 },
  strong: { color: C.text, fontWeight: "700" },
  value: { color: C.text, fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"] },
  line: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.border },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  priceInput: { minWidth: 110, minHeight: 40, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, color: C.text, backgroundColor: C.page, fontSize: 15 },
  tr: { flexDirection: "row", alignItems: "center", minHeight: 44, borderBottomWidth: 1, borderBottomColor: C.border },
  th: { minHeight: 36 },
  thText: { color: C.muted, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.3, paddingHorizontal: 6 },
  td: { color: C.text, fontSize: 13, paddingHorizontal: 6, fontVariant: ["tabular-nums"] },
  right: { textAlign: "right" },
});

