import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { authApi } from "../../api/authApi";
import { extractErrorMessage } from "../../api/errorMessage";
import { BokehBackground } from "../../components/BokehBackground";

export function ForgotPasswordScreen() {
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await authApi.forgotPassword({ email });
      setSent(true);
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
        <Text style={styles.title}>Reset your password</Text>
        <Text style={styles.subtitle}>Enter the email on your account and we'll send you a reset code.</Text>

        {sent ? (
          <>
            <Text style={styles.confirmation}>
              If an account exists for that email, we've sent password reset instructions.
            </Text>
            <Pressable style={styles.button} onPress={() => navigation.navigate("ResetPassword")}>
              <Text style={styles.buttonText}>I have my reset code</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@studio.com"
              placeholderTextColor="#7c8ba0"
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable style={[styles.button, isSubmitting && styles.buttonDisabled]} onPress={submit} disabled={isSubmitting}>
              {isSubmitting ? <ActivityIndicator color="#0d1826" /> : <Text style={styles.buttonText}>Send reset code</Text>}
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
  label: { fontSize: 13, color: "#a7b7cb", marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: "#e8edf3", backgroundColor: "#0d1826",
  },
  confirmation: { color: "#4cc493", fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 8 },
  error: { color: "#ff7a72", marginTop: 12, fontSize: 13 },
  button: { backgroundColor: "#ff9a4d", borderRadius: 8, paddingVertical: 13, marginTop: 18, alignItems: "center" },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#0d1826", fontWeight: "700", fontSize: 15 },
  backLink: { marginTop: 18, alignItems: "center" },
  backLinkText: { color: "#7fc0e6", fontSize: 13, fontWeight: "600" },
});
