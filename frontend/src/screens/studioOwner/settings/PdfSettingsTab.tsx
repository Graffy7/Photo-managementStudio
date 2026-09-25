import { useEffect, useState, type ReactNode } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Image, Platform } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { settingsApi } from "../../../api/settingsApi";
import { extractErrorMessage } from "../../../api/errorMessage";
import { Toggle } from "../../../components/Toggle";
import { API_BASE_URL } from "../../../constants/config";
import { downloadAndSharePdf } from "../../../utils/downloadPdf";
import type { PdfHeaderStyle, PdfLogoPlacement, PdfSettings, PdfTemplate } from "../../../types/settings";

const TEMPLATES: { key: PdfTemplate; name: string; text: string; header: PdfHeaderStyle; swatch: string }[] = [
  { key: "Classic", name: "Classic", text: "Your current design — blue header row, faint logo watermark.", header: "Standard", swatch: "#1976D2" },
  { key: "Modern", name: "Modern", text: "Coloured banner header, striped rows, bold total.", header: "Banner", swatch: "#1F3A5F" },
  { key: "Minimal", name: "Minimal", text: "Clean lines, no colour blocks — prints well in black & white.", header: "Standard", swatch: "#263238" },
  { key: "Elegant", name: "Elegant", text: "Centred letterhead with a fine accent line and soft tints.", header: "Centered", swatch: "#6D4C41" },
];

const PRESET_COLORS = ["#1976D2", "#1F3A5F", "#0E7C66", "#6D4C41", "#8E24AA", "#C62828", "#EF6C00", "#263238"];
const HEADERS: { key: PdfHeaderStyle; label: string }[] = [
  { key: "Standard", label: "Standard" }, { key: "Banner", label: "Colour banner" }, { key: "Centered", label: "Centred letterhead" },
];
const LOGOS: { key: PdfLogoPlacement; label: string }[] = [
  { key: "Watermark", label: "Faint watermark" }, { key: "Header", label: "In the header" }, { key: "Both", label: "Both" }, { key: "None", label: "No logo" },
];

const HEX = /^#[0-9a-fA-F]{6}$/;

// This studio's quotation PDF style. Everything is stored for this studio only; with nothing
// changed, PDFs keep the original Classic design.
export function PdfSettingsTab() {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ["pdf-settings"], queryFn: settingsApi.getPdfSettings });
  const [form, setForm] = useState<PdfSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (data) setForm(data); }, [data]);
  const set = <K extends keyof PdfSettings>(k: K, v: PdfSettings[K]) => { setForm((f) => (f ? { ...f, [k]: v } : f)); setSaved(false); };

  const colorsValid = !!form && (form.primaryColor === "" || HEX.test(form.primaryColor)) && (form.accentColor === "" || HEX.test(form.accentColor));

  const save = useMutation({
    mutationFn: () => settingsApi.updatePdfSettings(form!),
    onSuccess: (s) => { queryClient.setQueryData(["pdf-settings"], s); setError(null); setSaved(true); },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  const preview = useMutation({
    mutationFn: () => settingsApi.previewPdf(form!),
    onSuccess: async (bytes) => {
      setError(null);
      if (Platform.OS === "web") {
        const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
        // Opens in a new tab; if the browser blocks pop-ups, it downloads instead.
        if (!window.open(url, "_blank")) await downloadAndSharePdf(bytes, "quotation-preview.pdf");
      } else {
        await downloadAndSharePdf(bytes, "quotation-preview.pdf");
      }
    },
    onError: (err) => setError(extractErrorMessage(err, "Couldn't create the preview.")),
  });

  const signature = useMutation({
    mutationFn: async (asset: ImagePicker.ImagePickerAsset | null) => {
      if (!asset) return settingsApi.removeSignature();
      if (asset.fileSize && asset.fileSize > 1024 * 1024) throw new Error("The signature image must be 1MB or smaller.");
      if (Platform.OS === "web") {
        const blob = await fetch(asset.uri).then((r) => r.blob());
        return settingsApi.uploadSignature(blob, asset.fileName ?? "signature.png");
      }
      return settingsApi.uploadSignature({ uri: asset.uri, name: asset.fileName ?? "signature.png", type: asset.mimeType ?? "image/png" });
    },
    onSuccess: (s) => {
      queryClient.setQueryData(["pdf-settings"], s);
      setForm((f) => (f ? { ...f, signatureUrl: s.signatureUrl } : f));
      setError(null);
    },
    onError: (err) => setError(err instanceof Error && !("response" in err) ? err.message : extractErrorMessage(err)),
  });

  const pickSignature = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
    if (!result.canceled && result.assets[0]) signature.mutate(result.assets[0]);
  };

  if (isPending || !form) return <ActivityIndicator color="#7fc0e6" style={{ marginTop: 30 }} />;

  return (
    <View style={{ gap: 18 }}>
      <Text style={styles.intro}>
        How your quotation PDFs look. These settings are yours only — another studio never sees them. Contact details, address and
        GST come from your Studio Profile; the show/hide switches for them are on the Quotations tab.
      </Text>

      <Section title="Template">
        <View style={styles.templates}>
          {TEMPLATES.map((t) => {
            const on = form.template === t.key;
            return (
              <Pressable key={t.key} style={[styles.template, on && styles.templateOn]} accessibilityRole="radio" accessibilityState={{ checked: on }}
                onPress={() => { set("template", t.key); set("headerStyle", t.header); }}>
                <View style={styles.templateTop}>
                  <View style={[styles.swatch, { backgroundColor: t.swatch }]} />
                  <Text style={styles.templateName}>{t.name}</Text>
                  {t.key === "Classic" && <Text style={styles.defaultTag}>Default</Text>}
                  {on && <Ionicons name="checkmark-circle" size={16} color="#ff9a4d" style={{ marginLeft: "auto" }} />}
                </View>
                <Text style={styles.small}>{t.text}</Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section title="Colours">
        <ColorField label="Main colour" value={form.primaryColor} onChange={(v) => set("primaryColor", v)} hint="Headings, table header and total. Empty = the template's own." />
        <ColorField label="Accent colour" value={form.accentColor} onChange={(v) => set("accentColor", v)} hint="Status and accent lines. Empty = the main colour." />
      </Section>

      <Section title="Header & logo">
        <Label>Header style</Label>
        <Chips options={HEADERS} value={form.headerStyle} onChange={(v) => set("headerStyle", v)} />
        <Label>Logo</Label>
        <Chips options={LOGOS} value={form.logoPlacement} onChange={(v) => set("logoPlacement", v)} />
        <Text style={styles.small}>Uses the logo from the Logo & Branding tab.</Text>
        <View style={styles.row}>
          <Field label="Name on the PDF" value={form.displayName} onChange={(v) => set("displayName", v)} placeholder="Empty = your studio name" max={150} />
          <Field label="Tagline" value={form.tagline} onChange={(v) => set("tagline", v)} placeholder="e.g. Wedding & Portrait Photography" max={200} />
        </View>
        <SwitchRow label="Show website" value={form.showWebsite} onChange={(v) => set("showWebsite", v)} />
      </Section>

      <Section title="Footer & terms">
        <Field label="Footer text" value={form.footerText} onChange={(v) => set("footerText", v)} placeholder="e.g. Thank you for choosing us!" max={500} />
        <SwitchRow label="Show page numbers" value={form.showPageNumbers} onChange={(v) => set("showPageNumbers", v)} />
        <SwitchRow label="Print my default terms when a quotation has none" value={form.useDefaultTerms} onChange={(v) => set("useDefaultTerms", v)} />
        <Text style={styles.small}>Default terms are set on the Quotations tab. A quotation's own terms always come first.</Text>
      </Section>

      <Section title="Signature">
        <SwitchRow label="Show a signature block" value={form.showSignature} onChange={(v) => set("showSignature", v)} />
        {form.showSignature && (
          <>
            <View style={styles.sigRow}>
              {form.signatureUrl ? (
                <Image source={{ uri: `${API_BASE_URL}${form.signatureUrl}` }} style={styles.sigImage} resizeMode="contain" />
              ) : (
                <View style={[styles.sigImage, styles.sigEmpty]}><Text style={styles.small}>No signature image</Text></View>
              )}
              <View style={{ gap: 8 }}>
                <Pressable style={styles.secondary} onPress={pickSignature} disabled={signature.isPending}>
                  <Text style={styles.secondaryText}>{signature.isPending ? "Uploading…" : form.signatureUrl ? "Replace image" : "Upload image"}</Text>
                </Pressable>
                {!!form.signatureUrl && (
                  <Pressable onPress={() => signature.mutate(null)} disabled={signature.isPending}>
                    <Text style={styles.remove}>Remove image</Text>
                  </Pressable>
                )}
              </View>
            </View>
            <Text style={styles.small}>A PNG with a transparent background looks best (1MB max). The image is saved straight away.</Text>
            <View style={styles.row}>
              <Field label="Signatory name" value={form.signatoryName} onChange={(v) => set("signatoryName", v)} max={100} />
              <Field label="Title" value={form.signatoryTitle} onChange={(v) => set("signatoryTitle", v)} placeholder="Authorised signatory" max={100} />
            </View>
          </>
        )}
      </Section>

      <Section title="Payment details">
        <SwitchRow label="Show payment details" value={form.showPaymentDetails} onChange={(v) => set("showPaymentDetails", v)} />
        {form.showPaymentDetails && (
          <>
            <View style={styles.row}>
              <Field label="Bank name" value={form.bankName} onChange={(v) => set("bankName", v)} max={100} />
              <Field label="Account name" value={form.accountName} onChange={(v) => set("accountName", v)} max={100} />
            </View>
            <View style={styles.row}>
              <Field label="Account number" value={form.accountNumber} onChange={(v) => set("accountNumber", v.replace(/[^0-9A-Za-z]/g, ""))} max={40} />
              <Field label="IFSC" value={form.ifsc} onChange={(v) => set("ifsc", v.toUpperCase())} max={20} />
              <Field label="UPI ID" value={form.upiId} onChange={(v) => set("upiId", v.trim())} placeholder="name@bank" max={100} />
            </View>
            <Field label="Note" value={form.paymentNote} onChange={(v) => set("paymentNote", v)} placeholder="e.g. 50% advance to confirm the date" max={300} />
          </>
        )}
      </Section>

      {!!error && <Text style={styles.error}>{error}</Text>}
      {saved && <Text style={styles.success}>Saved. New and existing quotation PDFs now use this style.</Text>}

      <View style={styles.actions}>
        <Pressable style={[styles.secondary, (!colorsValid || preview.isPending) && styles.disabled]} disabled={!colorsValid || preview.isPending} onPress={() => preview.mutate()}>
          {preview.isPending ? <ActivityIndicator size="small" color="#7fc0e6" /> : <Ionicons name="eye-outline" size={15} color="#7fc0e6" />}
          <Text style={styles.secondaryText}>Preview sample PDF</Text>
        </Pressable>
        <Pressable style={[styles.save, (!colorsValid || save.isPending) && styles.disabled]} disabled={!colorsValid || save.isPending} onPress={() => save.mutate()}>
          {save.isPending ? <ActivityIndicator color="#0d1826" /> : <Text style={styles.saveText}>Save PDF style</Text>}
        </Pressable>
        <Pressable onPress={() => data && setForm(data)}><Text style={styles.reset}>Discard changes</Text></Pressable>
      </View>
      <Text style={styles.small}>The preview uses a sample quotation and your current (unsaved) choices.</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Label({ children }: { children: string }) {
  return <Text style={styles.label}>{children}</Text>;
}

function Field({ label, value, onChange, placeholder, max }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; max?: number }) {
  return (
    <View style={styles.field}>
      <Label>{label}</Label>
      <TextInput style={styles.input} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#6f83a0" maxLength={max} />
    </View>
  );
}

function SwitchRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.switchLabel}>{label}</Text>
      <Toggle value={value} onValueChange={onChange} />
    </View>
  );
}

function Chips<T extends string>({ options, value, onChange }: { options: { key: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.chips}>
      {options.map((o) => (
        <Pressable key={o.key} style={[styles.chip, value === o.key && styles.chipOn]} onPress={() => onChange(o.key)}>
          <Text style={[styles.chipText, value === o.key && styles.chipTextOn]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function ColorField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint: string }) {
  const invalid = value !== "" && !HEX.test(value);
  return (
    <View style={{ gap: 6 }}>
      <Label>{label}</Label>
      <View style={styles.colors}>
        <Pressable style={[styles.colorDot, styles.colorAuto, value === "" && styles.colorOn]} onPress={() => onChange("")} accessibilityLabel="Template colour">
          <Text style={styles.autoText}>Auto</Text>
        </Pressable>
        {PRESET_COLORS.map((c) => (
          <Pressable key={c} style={[styles.colorDot, { backgroundColor: c }, value.toUpperCase() === c && styles.colorOn]} onPress={() => onChange(c)} accessibilityLabel={c} />
        ))}
        <TextInput style={[styles.input, styles.hexInput, invalid && styles.inputBad]} value={value} placeholder="#1976D2" placeholderTextColor="#6f83a0"
          onChangeText={(v) => onChange(v.trim().slice(0, 7))} autoCapitalize="characters" />
      </View>
      <Text style={[styles.small, invalid && { color: "#ff7a72" }]}>{invalid ? "Use a colour like #1976D2." : hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { color: "#a7b7cb", fontSize: 13, lineHeight: 19 },
  section: { borderWidth: 1, borderColor: "#1b2c42", borderRadius: 12, padding: 16, gap: 10, backgroundColor: "#0f1e30" },
  sectionTitle: { color: "#e8edf3", fontSize: 15, fontWeight: "700" },
  templates: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  template: { flexGrow: 1, flexBasis: 200, borderWidth: 1, borderColor: "#23405c", borderRadius: 10, padding: 12, gap: 6, backgroundColor: "#132540" },
  templateOn: { borderColor: "#ff9a4d", backgroundColor: "rgba(255,154,77,0.08)" },
  templateTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  swatch: { width: 14, height: 14, borderRadius: 4 },
  templateName: { color: "#e8edf3", fontSize: 14, fontWeight: "700" },
  defaultTag: { color: "#7fc0e6", fontSize: 10, fontWeight: "700", borderWidth: 1, borderColor: "#23405c", borderRadius: 100, paddingHorizontal: 6 },
  small: { color: "#6f83a0", fontSize: 12 },
  label: { fontSize: 13, color: "#a7b7cb", marginTop: 2 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  field: { flexGrow: 1, flexBasis: 200, gap: 6 },
  input: { borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: "#e8edf3", backgroundColor: "#132540" },
  inputBad: { borderColor: "#ff7a72" },
  hexInput: { width: 110 },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, paddingVertical: 4 },
  switchLabel: { color: "#e8edf3", fontSize: 14, fontWeight: "600", flexShrink: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#23405c", borderRadius: 100, paddingVertical: 7, paddingHorizontal: 14, backgroundColor: "#132540" },
  chipOn: { borderColor: "#ff9a4d", backgroundColor: "rgba(255,154,77,0.14)" },
  chipText: { color: "#a7b7cb", fontSize: 12, fontWeight: "600" },
  chipTextOn: { color: "#ff9a4d" },
  colors: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  colorDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: "transparent" },
  colorAuto: { width: 44, backgroundColor: "#132540", borderColor: "#23405c", alignItems: "center", justifyContent: "center" },
  autoText: { color: "#a7b7cb", fontSize: 10, fontWeight: "700" },
  colorOn: { borderColor: "#e8edf3" },
  sigRow: { flexDirection: "row", alignItems: "center", gap: 14, flexWrap: "wrap" },
  sigImage: { width: 200, height: 70, borderRadius: 8, backgroundColor: "#ffffff" },
  sigEmpty: { backgroundColor: "#132540", borderWidth: 1, borderColor: "#23405c", borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  secondary: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: "#132540" },
  secondaryText: { color: "#7fc0e6", fontWeight: "700", fontSize: 13 },
  remove: { color: "#ff7a72", fontSize: 12.5, fontWeight: "600" },
  actions: { flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" },
  save: { backgroundColor: "#ff9a4d", borderRadius: 8, paddingVertical: 11, paddingHorizontal: 24, alignItems: "center" },
  saveText: { color: "#0d1826", fontWeight: "700" },
  reset: { color: "#6f83a0", fontSize: 13, fontWeight: "600" },
  disabled: { opacity: 0.5 },
  error: { color: "#ff7a72", fontSize: 13 },
  success: { color: "#4cc493", fontSize: 13, fontWeight: "600" },
});
