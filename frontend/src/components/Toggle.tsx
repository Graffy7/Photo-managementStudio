import { Pressable, View, StyleSheet } from "react-native";

// A plain Pressable-based toggle instead of RN's <Switch>, which was found to intermittently
// paint incompletely for rows that scroll into view inside a long ScrollView on web.
// accessibilityLabel: what the switch controls (e.g. a module's name) - without it a screen
// reader only hears "switch".
export function Toggle({ value, onValueChange, accessibilityLabel }: { value: boolean; onValueChange: (value: boolean) => void; accessibilityLabel?: string }) {
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      style={[styles.track, value && styles.trackOn]}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
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
    backgroundColor: "#2E4377",
    padding: 2,
    justifyContent: "center",
  },
  trackOn: {
    backgroundColor: "#5B9BFF",
  },
  thumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#F2F5FF",
    alignSelf: "flex-start",
  },
  thumbOn: {
    alignSelf: "flex-end",
  },
});
