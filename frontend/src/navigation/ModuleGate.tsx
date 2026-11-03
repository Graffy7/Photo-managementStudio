import type { ComponentType } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useModules } from "../hooks/useModules";

// Wraps a module's screen so it can't be opened while the platform admin has switched that module
// off for this studio - whether from the menu, a link on another page, or a saved route. The
// server refuses the module's API as well; this is what the owner sees instead of broken pages.
export function withModule<P extends object>(code: string, Screen: ComponentType<P>) {
  function Gated(props: P) {
    const isOn = useModules();
    return isOn(code) ? <Screen {...props} /> : <ModuleOff />;
  }
  Gated.displayName = `WithModule(${code})`;
  return Gated;
}

function ModuleOff() {
  const navigation = useNavigation<any>();
  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Ionicons name="lock-closed-outline" size={26} color="#4F5D75" />
        <Text style={styles.title}>This module isn't available</Text>
        <Text style={styles.text}>It isn't switched on for your studio. Your data is safe — contact the platform administrator if you need it.</Text>
        <Pressable style={styles.button} onPress={() => navigation.navigate("Home")} accessibilityRole="button">
          <Text style={styles.buttonText}>Go to home</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ECEBE6", alignItems: "center", justifyContent: "center", padding: 24 },
  card: {
    maxWidth: 420, alignItems: "center", gap: 10, padding: 28, borderRadius: 14,
    borderWidth: 1, borderColor: "#D2D1CA", backgroundColor: "#ECEBE6",
  },
  title: { color: "#292B31", fontSize: 17, fontWeight: "700", textAlign: "center" },
  text: { color: "#6F7078", fontSize: 13, lineHeight: 19, textAlign: "center" },
  button: { marginTop: 6, backgroundColor: "#56566B", borderRadius: 8, paddingHorizontal: 18, paddingVertical: 10 },
  buttonText: { color: "#ECEBE6", fontWeight: "700", fontSize: 13 },
});
