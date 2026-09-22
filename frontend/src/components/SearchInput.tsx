import { View, TextInput, Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface SearchInputProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  // The list screens each style their own search box; that style is applied to the wrapper so the
  // box keeps its usual width, spacing and border.
  style?: StyleProp<ViewStyle>;
}

// A search box with an X that empties it — every list screen uses this one so clearing a search
// works the same way everywhere.
export function SearchInput({ value, onChangeText, placeholder, style }: SearchInputProps) {
  return (
    <View style={[styles.wrapper, style]}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#6f83a0"
      />
      {value.length > 0 && (
        <Pressable
          style={styles.clear}
          onPress={() => onChangeText("")}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={8}
        >
          <Ionicons name="close-circle" size={16} color="#6f83a0" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flexDirection: "row", alignItems: "center" },
  input: { flex: 1, color: "#e8edf3", fontSize: 14, outlineStyle: "none" } as any,
  clear: { paddingLeft: 8 },
});
