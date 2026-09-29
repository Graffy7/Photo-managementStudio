import { View, TextInput, Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, space, touch } from "../ui/theme";

interface SearchInputProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  // Applied to the wrapper, for width and spacing on the screen that uses it.
  style?: StyleProp<ViewStyle>;
}

// A search box with an X that empties it — every list screen uses this one so clearing a search
// works the same way everywhere.
export function SearchInput({ value, onChangeText, placeholder, style }: SearchInputProps) {
  return (
    <View style={[styles.wrapper, style]}>
      <Ionicons name="search" size={18} color={colors.textFaint} style={styles.icon} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        accessibilityLabel={placeholder}
      />
      {value.length > 0 && (
        <Pressable
          style={styles.clear}
          onPress={() => onChangeText("")}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={8}
        >
          <Ionicons name="close-circle" size={18} color={colors.textFaint} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "row", alignItems: "center", minHeight: touch, borderWidth: 1, borderColor: colors.borderStrong,
    borderRadius: radius.control, backgroundColor: colors.card,
  },
  icon: { marginLeft: space.md },
  input: { flex: 1, minWidth: 0, color: colors.text, fontSize: 15, paddingHorizontal: space.sm, paddingVertical: 10 },
  clear: { paddingHorizontal: space.md, height: touch, justifyContent: "center" },
});
