import { Pressable, View, StyleSheet } from "react-native";

// A plain Pressable-based toggle instead of RN's <Switch>, which was found to intermittently
// paint incompletely for rows that scroll into view inside a long ScrollView on web.
export function Toggle({ value, onValueChange }: { value: boolean; onValueChange: (value: boolean) => void }) {
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      style={[styles.track, value && styles.trackOn]}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <View style={[styles.thumb, value && styles.thumbOn]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 40,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#23405c",
    padding: 2,
    justifyContent: "center",
  },
  trackOn: {
    backgroundColor: "#ff9a4d",
  },
  thumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#e8edf3",
    alignSelf: "flex-start",
  },
  thumbOn: {
    alignSelf: "flex-end",
  },
});
