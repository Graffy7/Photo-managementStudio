import { useRef, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View, StyleSheet, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, space, touch, type, shadow, transition, webShadow } from "./theme";

export interface SelectOption<T> {
  value: T;
  label: string;
}

// A dropdown that looks like the form's text boxes: shows the chosen value; pressing it opens the
// list just below (above when there's no room), with a tick on the current choice. Escape or a
// press outside closes it.
export function SelectField<T extends string | number | null>({ options, value, onChange, placeholder = "Select…", accessibilityLabel }: {
  options: SelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
  placeholder?: string;
  accessibilityLabel?: string;
}) {
  const trigger = useRef<View>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; width: number; above: boolean } | null>(null);
  const { height: windowHeight } = useWindowDimensions();
  const selected = options.find((o) => o.value === value);
  const MENU_MAX = 300;

  const open = () => {
    trigger.current?.measureInWindow((x, y, width, height) => {
      const above = y + height + MENU_MAX > windowHeight && y > MENU_MAX;
      setMenu({ x, y: above ? y - 6 : y + height + 6, width, above });
    });
  };
  const choose = (v: T) => { onChange(v); setMenu(null); };

  return (
    <>
      <Pressable
        ref={trigger}
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? (selected ? selected.label : placeholder)}
        accessibilityState={{ expanded: !!menu }}
        style={(state) => [styles.trigger, ((state as { hovered?: boolean }).hovered || !!menu) && styles.triggerActive]}
      >
        <Text style={[styles.value, !selected && styles.placeholder]} numberOfLines={1}>{selected ? selected.label : placeholder}</Text>
        <Ionicons name={menu ? "chevron-up" : "chevron-down"} size={18} color={colors.textMuted} />
      </Pressable>

      <Modal visible={!!menu} transparent animationType="none" onRequestClose={() => setMenu(null)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenu(null)} accessibilityLabel="Close list" />
        {menu && (
          <View
            style={[
              styles.menu,
              { left: menu.x, width: menu.width, maxHeight: MENU_MAX },
              menu.above ? { bottom: windowHeight - menu.y } : { top: menu.y },
            ]}
          >
            <ScrollView>
              {options.map((o) => {
                const on = o.value === value;
                return (
                  <Pressable
                    key={String(o.value)}
                    onPress={() => choose(o.value)}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected: on }}
                    style={(state) => [styles.option, (state as { hovered?: boolean }).hovered && styles.optionHover, on && styles.optionOn]}
                  >
                    <Text style={[styles.optionText, on && styles.optionTextOn]} numberOfLines={1}>{o.label}</Text>
                    {on && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minHeight: touch, flexDirection: "row", alignItems: "center", gap: space.sm, borderWidth: 1, borderColor: colors.borderStrong,
    borderRadius: radius.control, paddingHorizontal: space.md, backgroundColor: colors.page, ...transition,
  },
  triggerActive: { borderColor: colors.primary },
  value: { flex: 1, fontSize: 15, color: colors.text },
  placeholder: { color: colors.textFaint },
  menu: {
    position: "absolute", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.card,
    paddingVertical: space.xs, ...webShadow(shadow.menu),
  },
  option: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 40, paddingHorizontal: space.md },
  optionHover: { backgroundColor: colors.hover },
  optionOn: { backgroundColor: colors.primarySoft },
  optionText: { ...type.body, color: colors.text, flex: 1 },
  optionTextOn: { color: colors.primary, fontWeight: "700" },
});
