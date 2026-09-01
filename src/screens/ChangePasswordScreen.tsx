import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuthStore } from "../auth/authStore";

export function ChangePasswordScreen() {
  const navigation = useNavigation<any>();
  const changePassword = useAuthStore((s) => s.changePassword);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setIsSubmitting(true);
    setError(null);
    const result = await changePassword(currentPassword, newPassword, confirmPassword);
    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error ?? "Something went wrong.");
    }
    // On success, changePassword() clears the session — RootNavigator swaps to Login on its own.
  };

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>

        <Text style={styles.title}>Change password</Text>
        <Text style={styles.subtitle}>You'll be signed out everywhere after this — sign back in with your new password.</Text>

        <Text style={styles.label}>Current password</Text>
        <TextInput
          style={styles.input}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor="#6f83a0"
        />

        <Text style={styles.label}>New password</Text>
        <TextInput
          style={styles.input}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          placeholder="At least 8 characters"
          placeholderTextColor="#6f83a0"
        />

        <Text style={styles.label}>Confirm new password</Text>
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          placeholder="Repeat your new password"
          placeholderTextColor="#6f83a0"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={[styles.button, isSubmitting && styles.buttonDisabled]} onPress={submit} disabled={isSubmitting}>
          {isSubmitting ? <ActivityIndicator color="#0d1826" /> : <Text style={styles.buttonText}>Change password</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d1826", alignItems: "center", justifyContent: "center", padding: 24 },
  card: {
    width: "100%", maxWidth: 400, backgroundColor: "#132540", borderRadius: 12,
    padding: 28, borderWidth: 1, borderColor: "#23405c",
  },
  backButton: { marginBottom: 14 },
  backText: { color: "#7fc0e6", fontSize: 13, fontWeight: "600" },
  title: { fontSize: 22, fontWeight: "700", color: "#e8edf3" },
  subtitle: { fontSize: 13, color: "#a7b7cb", marginTop: 6, marginBottom: 10, lineHeight: 18 },
  label: { fontSize: 13, color: "#a7b7cb", marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: "#e8edf3", backgroundColor: "#0d1826",
  },
  error: { color: "#ff7a72", marginTop: 14, fontSize: 13 },
  button: { backgroundColor: "#ff9a4d", borderRadius: 8, paddingVertical: 13, marginTop: 22, alignItems: "center" },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#0d1826", fontWeight: "700", fontSize: 15 },
});
