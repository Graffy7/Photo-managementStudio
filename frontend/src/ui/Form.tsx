import type { ReactNode } from "react";
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, type TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "./Button";
import { useBreakpoint } from "./useBreakpoint";
import { colors, radius, space, touch, type } from "./theme";

// A form page: title, the sections, and a Save / Cancel bar that stays at the bottom of the screen
// so the main action is always in reach (one thumb on a phone), however long the form is.
export function FormScreen({ title, subtitle, children, onCancel, onSave, saveLabel, saving, error, above }: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onCancel: () => void;
  onSave: () => void;
  saveLabel: string;
  saving?: boolean;
  // A problem that isn't about one field (e.g. "Couldn't save. Check your connection.").
  error?: string | null;
  // Anything shown between the title and the sections (e.g. the customer's booked events).
  above?: ReactNode;
}) {
  const { isPhone } = useBreakpoint();
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { padding: isPhone ? space.lg : space.xl }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {above}
        <View style={{ gap: space.lg, marginTop: space.lg }}>{children}</View>
      </ScrollView>
      <View style={styles.bar}>
        {/* On phones the message gets its own line above the buttons, so it's never cut short. */}
        {error && isPhone && (
          <View style={[styles.barError, styles.barErrorPhone]}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={styles.barErrorText}>{error}</Text>
          </View>
        )}
        <View style={styles.barInner}>
          {error && !isPhone ? (
            <View style={styles.barError}>
              <Ionicons name="alert-circle" size={18} color={colors.danger} />
              <Text style={styles.barErrorText} numberOfLines={3}>{error}</Text>
            </View>
          ) : <View style={{ flex: 1 }} />}
          <Button label="Cancel" onPress={onCancel} disabled={saving} />
          <Button label={saveLabel} variant="primary" onPress={onSave} loading={saving} />
        </View>
      </View>
    </View>
  );
}

export function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {description ? <Text style={styles.sectionText}>{description}</Text> : null}
      <View style={{ gap: space.lg, marginTop: space.md }}>{children}</View>
    </View>
  );
}

// Two fields side by side on tablets and desktops; stacked on phones.
export function FieldRow({ children }: { children: ReactNode }) {
  const { isPhone } = useBreakpoint();
  return <View style={isPhone ? { gap: space.lg } : styles.row}>{children}</View>;
}

// Label (with * when required), the control, then either the problem in red or a hint.
export function Field({ label, required, hint, error, children, flex }: {
  label: string;
  required?: boolean;
  hint?: string | null;
  error?: string | null;
  children: ReactNode;
  flex?: boolean;
}) {
  return (
    <View style={flex ? { flex: 1, minWidth: 0 } : undefined}>
      <Text style={styles.label}>
        {label}{required ? <Text style={styles.required}> *</Text> : <Text style={styles.optional}>  optional</Text>}
      </Text>
      {children}
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function TextField({ invalid, multiline, style, ...props }: TextInputProps & { invalid?: boolean }) {
  return (
    <TextInput
      placeholderTextColor={colors.textFaint}
      multiline={multiline}
      style={[styles.input, multiline && styles.textArea, invalid && styles.inputInvalid, style]}
      {...props}
    />
  );
}

// Pick one of a few options (status, payment method...). Large, easy-to-tap chips.
export function ChoiceChips<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.choices} accessibilityRole="radiogroup">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.choice, on && styles.choiceOn]}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// A calm box for a rule the form is enforcing (overpayment, future date...).
export function FormNote({ tone = "warning", children }: { tone?: "warning" | "danger" | "info"; children: ReactNode }) {
  const color = tone === "danger" ? colors.danger : tone === "info" ? colors.info : colors.warning;
  const bg = tone === "danger" ? colors.dangerSoft : tone === "info" ? colors.infoSoft : colors.warningSoft;
  return (
    <View style={[styles.note, { backgroundColor: bg }]}>
      <Ionicons name={tone === "info" ? "information-circle-outline" : "alert-circle-outline"} size={18} color={color} />
      <Text style={styles.noteText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", paddingBottom: space.xxl },
  title: { ...type.title, color: colors.text },
  subtitle: { ...type.small, color: colors.textMuted, marginTop: 2 },
  section: { backgroundColor: colors.card, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: space.lg },
  sectionTitle: { ...type.heading, color: colors.text },
  sectionText: { ...type.small, color: colors.textMuted, marginTop: 2 },
  row: { flexDirection: "row", gap: space.lg },
  label: { ...type.small, fontWeight: "600", color: colors.text, marginBottom: 6 },
  required: { color: colors.primary },
  optional: { fontWeight: "400", color: colors.textFaint, fontSize: 12 },
  input: {
    minHeight: touch, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.control,
    paddingHorizontal: space.md, paddingVertical: 10, fontSize: 15, color: colors.text, backgroundColor: colors.page,
  },
  textArea: { minHeight: 96, textAlignVertical: "top" },
  inputInvalid: { borderColor: colors.danger },
  error: { ...type.small, color: colors.danger, marginTop: 6 },
  hint: { ...type.caption, color: colors.textFaint, marginTop: 6 },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  choice: {
    minHeight: 40, justifyContent: "center", borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.pill,
    paddingHorizontal: space.lg, backgroundColor: colors.page,
  },
  choiceOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  choiceText: { ...type.small, fontWeight: "600", color: colors.textMuted },
  choiceTextOn: { color: colors.primary },
  note: { flexDirection: "row", gap: space.sm, alignItems: "flex-start", borderRadius: radius.control, padding: space.md },
  noteText: { ...type.small, color: colors.text, flex: 1 },
  bar: { backgroundColor: colors.bar, borderTopWidth: 1, borderTopColor: colors.border },
  barInner: {
    width: "100%", maxWidth: 760, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: space.sm,
    paddingHorizontal: space.lg, paddingVertical: space.md,
  },
  barError: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0 },
  barErrorText: { ...type.small, color: colors.danger, flex: 1 },
  barErrorPhone: { paddingHorizontal: space.lg, paddingTop: space.md },
});
