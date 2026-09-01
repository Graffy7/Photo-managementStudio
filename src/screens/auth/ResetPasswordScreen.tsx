import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { authApi } from "../../api/authApi";
import { extractErrorMessage } from "../../api/errorMessage";
import { BokehBackground } from "../../components/BokehBackground";

export function ResetPasswordScreen() {
  const navigation = useNavigation<any>();
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await authApi.resetPassword({ token, newPassword, confirmPassword });
      setDone(true);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <BokehBackground />
      <View style={styles.card}>
        <Text style={styles.title}>Enter your reset code</Text>
        <Text style={styles.subtitle}>Paste the code we emailed you, then choose a new password.</Text>

        {done ? (
          <>
            <Text style={styles.confirmation}>Your password has been reset. Please sign in with your new password.</Text>
            <Pressable style={styles.button} onPress={() => navigation.navigate("Login")}>
              <Text style={styles.buttonText}>Back to sign in</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.label}>Reset code</Text>
            <TextInput
              style={styles.input}
              value={token}
              onChangeText={setToken}
              autoCapitalize="none"
              placeholder="Paste the code from your email"
              placeholderTextColor="#7c8ba0"
            />

            <Text style={styles.label}>New password</Text>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              placeholder="At least 8 characters"
              placeholderTextColor="#7c8ba0"
            />

            <Text style={styles.label}>Confirm new password</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              placeholder="Repeat your new password"
              placeholderTextColor="#7c8ba0"
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable style={[styles.button, isSubmitting && styles.buttonDisabled]} onPress={submit} disabled={isSubmitting}>
              {isSubmitting ? <ActivityIndicator color="#0d1826" /> : <Text style={styles.buttonText}>Reset password</Text>}
            </Pressable>
          </>
        )}

        <Pressable style={styles.backLink} onPress={() => navigation.navigate("Login")}>
          <Text style={styles.backLinkText}>‹ Back to sign in</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d1826", alignItems: "center", justifyContent: "center", padding: 24 },
  card: {
    width: "100%", maxWidth: 380, backgroundColor: "rgba(19, 37, 64, 0.72)", borderRadius: 12,
    padding: 28, borderWidth: 1, borderColor: "rgba(35, 64, 92, 0.8)",
  },
  title: { fontSize: 22, fontWeight: "700", color: "#e8edf3", textAlign: "center" },
  subtitle: { fontSize: 13, color: "#a7b7cb", textAlign: "center", marginTop: 8, marginBottom: 20 },
  label: { fontSize: 13, color: "#a7b7cb", marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: "#e8edf3", backgroundColor: "#0d1826",
  },
  confirmation: { color: "#4cc493", fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 8 },
  error: { color: "#ff7a72", marginTop: 14, fontSize: 13 },
  button: { backgroundColor: "#ff9a4d", borderRadius: 8, paddingVertical: 13, marginTop: 22, alignItems: "center" },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#0d1826", fontWeight: "700", fontSize: 15 },
  backLink: { marginTop: 18, alignItems: "center" },
  backLinkText: { color: "#7fc0e6", fontSize: 13, fontWeight: "600" },
});
