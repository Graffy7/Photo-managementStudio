import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { settingsApi } from "../../../api/settingsApi";
import { extractErrorMessage } from "../../../api/errorMessage";
import type { StudioProfile } from "../../../types/settings";
import { Field, FieldRow, TextField } from "../../../ui/Form";
import { Button } from "../../../ui/Button";
import { StudioBrandHeader } from "../../../components/StudioBrandHeader";
import { LogoBrandingTab } from "./LogoBrandingTab";
import { colors, radius, space, type } from "../../../ui/theme";

type Values = {
  studioName: string; description: string; ownerName: string;
  phoneNumber: string; whatsAppNumber: string; email: string;
  website: string; instagramUrl: string; facebookUrl: string;
  address: string; city: string; state: string; pincode: string; gstNumber: string;
};

const EMPTY: Values = {
  studioName: "", description: "", ownerName: "", phoneNumber: "", whatsAppNumber: "", email: "",
  website: "", instagramUrl: "", facebookUrl: "", address: "", city: "", state: "", pincode: "", gstNumber: "",
};

function fromProfile(p: StudioProfile): Values {
  return {
    studioName: p.studioName, description: p.description ?? "", ownerName: p.ownerName ?? "",
    phoneNumber: p.phoneNumber ?? "", whatsAppNumber: p.whatsAppNumber ?? "", email: p.email ?? "",
    website: p.website ?? "", instagramUrl: p.instagramUrl ?? "", facebookUrl: p.facebookUrl ?? "",
    address: p.address ?? "", city: p.city ?? "", state: p.state ?? "", pincode: p.pincode ?? "", gstNumber: p.gstNumber ?? "",
  };
}

// Same rules as the server (PublicLinks): checked here first so mistakes show next to the field.
const PHONE_CHARS = /^\+?[0-9 ()-]+$/;
const digitCount = (v: string) => (v.match(/\d/g) ?? []).length;

function phoneProblem(v: string): string | null {
  if (!v.trim()) return null;
  return PHONE_CHARS.test(v.trim()) && digitCount(v) >= 7 && digitCount(v) <= 15 ? null : "Enter a valid phone number (digits, spaces, + or -).";
}

function whatsAppProblem(v: string): string | null {
  if (!v.trim()) return null;
  return PHONE_CHARS.test(v.trim()) && digitCount(v) >= 11 && digitCount(v) <= 15 ? null : "Include the country code, e.g. +91 98765 43210.";
}

function normalizeUrl(v: string): string | null {
  const text = v.trim();
  if (!text || /\s/.test(text)) return null;
  const withScheme = text.includes("://") ? text : `https://${text}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!u.hostname.includes(".") || u.hostname.startsWith(".") || u.hostname.endsWith(".") || u.username) return null;
    return u.href;
  } catch {
    return null;
  }
}

function urlProblem(v: string, example: string): string | null {
  if (!v.trim()) return null;
  return normalizeUrl(v) ? null : `Enter a valid link, e.g. ${example}.`;
}

function emailProblem(v: string): string | null {
  if (!v.trim()) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? null : "Enter a valid email address.";
}

function whatsAppLink(v: string): string | null {
  if (!v.trim() || whatsAppProblem(v)) return null;
  return `https://wa.me/${v.replace(/\D/g, "").replace(/^0+/, "")}`;
}

// Settings → Studio profile: who the studio is, and what customers see at the top of every photo
// selection link. The logo controls are the same ones as before, now part of this one page.
export function StudioProfileTab() {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ["studio-profile"], queryFn: settingsApi.getProfile });

  const [values, setValues] = useState<Values>(EMPTY);
  const [tried, setTried] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);

  const saved = useMemo(() => (data ? fromProfile(data) : EMPTY), [data]);
  useEffect(() => {
    if (data) setValues(fromProfile(data));
  }, [data]);

  const set = (key: keyof Values) => (v: string) => {
    setValues((prev) => ({ ...prev, [key]: v }));
    setMessage(null);
  };
  const dirty = JSON.stringify(values) !== JSON.stringify(saved);

  const problems = {
    studioName: values.studioName.trim() ? null : "The studio name is required.",
    phoneNumber: phoneProblem(values.phoneNumber),
    whatsAppNumber: whatsAppProblem(values.whatsAppNumber),
    email: emailProblem(values.email),
    website: urlProblem(values.website, "www.yourstudio.com"),
    instagramUrl: urlProblem(values.instagramUrl, "instagram.com/yourstudio"),
    facebookUrl: urlProblem(values.facebookUrl, "facebook.com/yourstudio"),
  };
  const shown = (key: keyof typeof problems) => (tried ? problems[key] : null);
  const hasProblems = Object.values(problems).some(Boolean);

  const mutation = useMutation({
    mutationFn: () =>
      settingsApi.updateProfile({
        studioName: values.studioName.trim(),
        ownerName: values.ownerName.trim() || undefined,
        email: values.email.trim() || undefined,
        phoneNumber: values.phoneNumber.trim() || undefined,
        address: values.address.trim() || undefined,
        city: values.city.trim() || undefined,
        state: values.state.trim() || undefined,
        pincode: values.pincode.trim() || undefined,
        gstNumber: values.gstNumber.trim() || undefined,
        website: values.website.trim() || undefined,
        whatsAppNumber: values.whatsAppNumber.trim() || undefined,
        description: values.description.trim() || undefined,
        instagramUrl: values.instagramUrl.trim() || undefined,
        facebookUrl: values.facebookUrl.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studio-profile"] });
      setTried(false);
      setMessage({ text: "Saved. Your photo-selection links show these details right away.", tone: "ok" });
    },
    onError: (err) => setMessage({ text: extractErrorMessage(err, "Couldn't save the profile. Please try again."), tone: "error" }),
  });

  const save = () => {
    setTried(true);
    if (hasProblems) {
      setMessage({ text: "Please fix the highlighted fields.", tone: "error" });
      return;
    }
    mutation.mutate();
  };

  const cancel = () => {
    setValues(saved);
    setTried(false);
    setMessage(null);
  };

  if (isPending) {
    return <ActivityIndicator color={colors.link} style={{ marginTop: 40 }} />;
  }

  // What the customer will see, built from what is typed right now (only valid links are shown).
  const preview = {
    name: values.studioName.trim() || "Your studio name",
    logoUrl: data?.logoUrl ?? null,
    description: values.description.trim() || null,
    phone: values.phoneNumber.trim() && !problems.phoneNumber ? values.phoneNumber.trim() : null,
    whatsAppUrl: whatsAppLink(values.whatsAppNumber),
    website: normalizeUrl(values.website),
    instagramUrl: normalizeUrl(values.instagramUrl),
    facebookUrl: normalizeUrl(values.facebookUrl),
  };

  return (
    <View style={{ gap: space.xl }}>
      <View style={styles.previewBox}>
        <View style={styles.previewHead}>
          <Ionicons name="eye-outline" size={16} color={colors.textMuted} />
          <Text style={styles.previewLabel}>What customers see on their photo-selection link</Text>
        </View>
        <StudioBrandHeader brand={preview} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Logo</Text>
        <LogoBrandingTab />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Studio</Text>
        <FieldRow>
          <Field label="Studio name" required error={shown("studioName")} flex>
            <TextField value={values.studioName} onChangeText={set("studioName")} invalid={!!shown("studioName")} maxLength={200} />
          </Field>
          <Field label="Owner name" flex>
            <TextField value={values.ownerName} onChangeText={set("ownerName")} maxLength={200} />
          </Field>
        </FieldRow>
        <Field label="About the studio" hint={`A short line customers see under your name (${values.description.length}/300).`}>
          <TextField value={values.description} onChangeText={set("description")} placeholder="Capturing your beautiful moments." multiline maxLength={300} />
        </Field>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact</Text>
        <FieldRow>
          <Field label="Contact number" error={shown("phoneNumber")} flex>
            <TextField value={values.phoneNumber} onChangeText={set("phoneNumber")} keyboardType="phone-pad" placeholder="+91 98765 43210" invalid={!!shown("phoneNumber")} maxLength={30} />
          </Field>
          <Field label="WhatsApp number" error={shown("whatsAppNumber")} hint="With country code. Customers get a WhatsApp button." flex>
            <TextField value={values.whatsAppNumber} onChangeText={set("whatsAppNumber")} keyboardType="phone-pad" placeholder="+91 98765 43210" invalid={!!shown("whatsAppNumber")} maxLength={30} />
          </Field>
        </FieldRow>
        <Field label="Email" error={shown("email")}>
          <TextField value={values.email} onChangeText={set("email")} keyboardType="email-address" autoCapitalize="none" invalid={!!shown("email")} maxLength={256} />
        </Field>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Online</Text>
        <Field label="Website" error={shown("website")}>
          <TextField value={values.website} onChangeText={set("website")} autoCapitalize="none" placeholder="www.yourstudio.com" invalid={!!shown("website")} maxLength={300} />
        </Field>
        <FieldRow>
          <Field label="Instagram" error={shown("instagramUrl")} flex>
            <TextField value={values.instagramUrl} onChangeText={set("instagramUrl")} autoCapitalize="none" placeholder="instagram.com/yourstudio" invalid={!!shown("instagramUrl")} maxLength={300} />
          </Field>
          <Field label="Facebook" error={shown("facebookUrl")} flex>
            <TextField value={values.facebookUrl} onChangeText={set("facebookUrl")} autoCapitalize="none" placeholder="facebook.com/yourstudio" invalid={!!shown("facebookUrl")} maxLength={300} />
          </Field>
        </FieldRow>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Address & tax</Text>
        <Field label="Address">
          <TextField value={values.address} onChangeText={set("address")} maxLength={500} />
        </Field>
        <FieldRow>
          <Field label="City" flex><TextField value={values.city} onChangeText={set("city")} maxLength={100} /></Field>
          <Field label="State" flex><TextField value={values.state} onChangeText={set("state")} maxLength={100} /></Field>
          <Field label="Pincode" flex><TextField value={values.pincode} onChangeText={set("pincode")} keyboardType="number-pad" maxLength={20} /></Field>
        </FieldRow>
        <Field label="GST number" hint="Shown on quotations, not on customer links.">
          <TextField value={values.gstNumber} onChangeText={set("gstNumber")} autoCapitalize="characters" placeholder="e.g. 33ABCDE1234F1Z5" maxLength={30} />
        </Field>
      </View>

      {message && (
        <View style={[styles.message, message.tone === "ok" ? styles.messageOk : styles.messageError]} accessibilityLiveRegion="polite">
          <Ionicons name={message.tone === "ok" ? "checkmark-circle" : "alert-circle"} size={18} color={message.tone === "ok" ? colors.success : colors.danger} />
          <Text style={styles.messageText}>{message.text}</Text>
        </View>
      )}
      <View style={styles.actions}>
        <Button label="Cancel" onPress={cancel} disabled={!dirty || mutation.isPending} />
        <Button label="Save changes" variant="primary" onPress={save} loading={mutation.isPending} disabled={!dirty} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  previewBox: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.card, backgroundColor: colors.page, padding: space.lg, gap: space.md },
  previewHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  previewLabel: { ...type.caption, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.4 },
  section: { gap: space.md },
  sectionTitle: { ...type.heading, color: colors.text },
  message: { flexDirection: "row", alignItems: "center", gap: space.sm, borderRadius: radius.control, padding: space.md },
  messageOk: { backgroundColor: colors.successSoft },
  messageError: { backgroundColor: colors.dangerSoft },
  messageText: { ...type.small, color: colors.text, flex: 1 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: space.sm },
});
