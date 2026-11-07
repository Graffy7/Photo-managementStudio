import { Modal, Pressable, View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "./Button";
import { colors, radius, space, type, shadow, webShadow } from "./theme";

// The one "are you sure?" dialog for the whole app: a centred card over the dimmed page with an
// icon, a short title, what will happen, and Cancel beside the action. Clicking outside or Escape
// cancels (not while the action is running).
export function ConfirmDialog({
  visible, title, message, confirmLabel, cancelLabel = "Cancel", tone = "danger", icon, busy, error, onConfirm, onCancel,
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  icon?: keyof typeof Ionicons.glyphMap;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const danger = tone === "danger";
  const cancel = () => { if (!busy) onCancel(); };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={cancel}>
      <Pressable style={styles.backdrop} onPress={cancel} accessibilityLabel="Cancel">
        {/* Swallows presses so clicking inside the card doesn't cancel. */}
        <Pressable style={styles.card} onPress={() => undefined} accessibilityRole="alert">
          <View style={[styles.icon, { backgroundColor: danger ? colors.dangerSoft : colors.primarySoft }]}>
            <Ionicons name={icon ?? (danger ? "trash-outline" : "help-circle-outline")} size={22} color={danger ? colors.danger : colors.primary} />
          </View>
          <Text style={styles.title}>{title}</Text>
          {!!message && <Text style={styles.message}>{message}</Text>}
          {!!error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.buttons}>
            <Button label={cancelLabel} variant="secondary" onPress={cancel} disabled={busy} style={styles.button} />
            <Button label={confirmLabel} variant={danger ? "destructive" : "primary"} loading={busy} onPress={onConfirm} style={styles.button} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(2,6,20,0.65)", alignItems: "center", justifyContent: "center", padding: space.lg },
  card: {
    width: "100%", maxWidth: 400, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.borderStrong,
    padding: space.xl, alignItems: "center", gap: space.sm, ...webShadow(shadow.menu),
  },
  icon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: space.xs },
  title: { ...type.heading, fontSize: 18, fontWeight: "700", color: colors.text, textAlign: "center" },
  message: { ...type.small, color: colors.textMuted, textAlign: "center" },
  error: { ...type.small, color: colors.danger, textAlign: "center" },
  buttons: { flexDirection: "row", gap: space.md, marginTop: space.md, alignSelf: "stretch" },
  button: { flex: 1 },
});
