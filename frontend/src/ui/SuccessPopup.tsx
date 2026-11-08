import { useEffect, useRef } from "react";
import { Animated, Easing, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { create } from "zustand";
import { colors, space, type, webShadow } from "./theme";

// "Created!" feedback for the whole app. Any screen calls showSuccess("Enquiry created", "…")
// after saving something new; <SuccessPopup /> (mounted once, in App) shows it.
interface SuccessState {
  item: { id: number; title: string; message?: string } | null;
  show: (title: string, message?: string) => void;
  hide: () => void;
}

const useSuccess = create<SuccessState>((set) => ({
  item: null,
  show: (title, message) => set({ item: { id: Date.now(), title, message } }),
  hide: () => set({ item: null }),
}));

export const showSuccess = (title: string, message?: string) => useSuccess.getState().show(title, message);

// Development builds only: lets the pop-up be tried from the browser console without saving data.
if (__DEV__ && typeof window !== "undefined") {
  (window as unknown as { __showSuccess?: typeof showSuccess }).__showSuccess = showSuccess;
}

const SHOW_MS = 2200;

// The card fades and scales in, the green tick pops in with a small bounce and a ring pulses out
// from it; it closes by itself after a couple of seconds, or when clicked.
export function SuccessPopup() {
  const item = useSuccess((s) => s.item);
  const hide = useSuccess((s) => s.hide);
  const card = useRef(new Animated.Value(0)).current;
  const tick = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!item) return;
    const useNativeDriver = Platform.OS !== "web";
    card.setValue(0);
    tick.setValue(0);
    ring.setValue(0);
    Animated.parallel([
      Animated.timing(card, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver }),
      Animated.sequence([
        Animated.delay(120),
        Animated.spring(tick, { toValue: 1, friction: 4, tension: 140, useNativeDriver }),
      ]),
      Animated.sequence([
        Animated.delay(180),
        Animated.timing(ring, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver }),
      ]),
    ]).start();
    const timer = setTimeout(hide, SHOW_MS);
    return () => clearTimeout(timer);
  }, [item, card, tick, ring, hide]);

  if (!item) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={hide}>
      <Pressable style={styles.backdrop} onPress={hide} accessibilityLabel="Close">
        <Animated.View
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={[
            styles.card,
            { opacity: card, transform: [{ scale: card.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }] },
          ]}
        >
          <View style={styles.badgeArea}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.ring,
                {
                  opacity: ring.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.6, 0] }),
                  transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.9] }) }],
                },
              ]}
            />
            <Animated.View style={[styles.badge, { transform: [{ scale: tick }] }]}>
              <Ionicons name="checkmark" size={34} color="#FFFFFF" />
            </Animated.View>
          </View>
          <Text style={styles.title}>{item.title}</Text>
          {!!item.message && <Text style={styles.message}>{item.message}</Text>}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(2,6,20,0.45)", alignItems: "center", justifyContent: "center", padding: space.lg },
  card: {
    width: "100%", maxWidth: 340, alignItems: "center", gap: space.sm, backgroundColor: colors.card, borderRadius: 18,
    borderWidth: 1, borderColor: "rgba(34,197,139,0.45)", paddingVertical: space.xl, paddingHorizontal: space.xl,
    ...webShadow("0 18px 48px rgba(2,6,20,0.55), 0 0 0 1px rgba(34,197,139,0.08)"),
  },
  badgeArea: { width: 76, height: 76, alignItems: "center", justifyContent: "center", marginBottom: space.xs },
  ring: { position: "absolute", width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: colors.success },
  badge: {
    width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: colors.success,
    ...webShadow("0 8px 24px rgba(34,197,139,0.45)"),
  },
  title: { ...type.heading, fontSize: 18, fontWeight: "800", color: colors.text, textAlign: "center" },
  message: { ...type.small, color: colors.textMuted, textAlign: "center" },
});
