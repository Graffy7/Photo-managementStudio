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
          placeholderTextColor="#A4AFCF"
        />

        <Text style={styles.label}>New password</Text>
        <TextInput
          style={styles.input}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          placeholder="At least 8 characters"
          placeholderTextColor="#A4AFCF"
        />

        <Text style={styles.label}>Confirm new password</Text>
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          placeholder="Repeat your new password"
          placeholderTextColor="#A4AFCF"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={[styles.button, isSubmitting && styles.buttonDisabled]} onPress={submit} disabled={isSubmitting}>
          {isSubmitting ? <ActivityIndicator color="#070F24" /> : <Text style={styles.buttonText}>Change password</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#070F24", alignItems: "center", justifyContent: "center", padding: 24 },
  card: {
    width: "100%", maxWidth: 400, backgroundColor: "#111E3F", borderRadius: 12,
    padding: 28, borderWidth: 1, borderColor: "#2E4377",
  },
  backButton: { marginBottom: 14 },
  backText: { color: "#5B9BFF", fontSize: 13, fontWeight: "600" },
  title: { fontSize: 22, fontWeight: "700", color: "#F2F5FF" },
  subtitle: { fontSize: 13, color: "#A4AFCF", marginTop: 6, marginBottom: 10, lineHeight: 18 },
  label: { fontSize: 13, color: "#A4AFCF", marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1, borderColor: "#2E4377", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: "#F2F5FF", backgroundColor: "#070F24",
  },
  error: { color: "#FF5C75", marginTop: 14, fontSize: 13 },
  button: { backgroundColor: "#5B9BFF", borderRadius: 8, paddingVertical: 13, marginTop: 22, alignItems: "center" },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#070F24", fontWeight: "700", fontSize: 15 },
});
