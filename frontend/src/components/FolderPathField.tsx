import { useState } from "react";
import { View, TextInput, Pressable, Text, StyleSheet } from "react-native";
import { FolderBrowserModal } from "./FolderBrowserModal";

// A path TextInput plus a "Browse" button that opens FolderBrowserModal — typing the path by
// hand still works, Browse is just a faster way to fill it in from the studio machine's own disk.
export function FolderPathField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [browsing, setBrowsing] = useState(false);

  return (
    <View style={styles.row}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#6f83a0"
      />
      <Pressable style={styles.browseButton} onPress={() => setBrowsing(true)}>
        <Text style={styles.browseButtonText}>Browse</Text>
      </Pressable>

      <FolderBrowserModal
        visible={browsing}
        onClose={() => setBrowsing(false)}
        onSelect={(path) => {
          onChange(path);
          setBrowsing(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, alignItems: "stretch" },
  input: {
    flex: 1,
    borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9,
    fontSize: 13, color: "#e8edf3", backgroundColor: "#0d1826",
  },
  browseButton: { backgroundColor: "#132540", borderRadius: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: "#23405c", alignItems: "center", justifyContent: "center" },
  browseButtonText: { color: "#7fc0e6", fontSize: 12, fontWeight: "700" },
});
