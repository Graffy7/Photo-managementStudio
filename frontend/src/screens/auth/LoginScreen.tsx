import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuthStore } from "../../auth/authStore";
import { BokehBackground } from "../../components/BokehBackground";
import { Checkbox } from "../../components/Checkbox";

export function LoginScreen() {
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const login = useAuthStore((s) => s.login);
  const isSubmitting = useAuthStore((s) => s.isSubmitting);
  const error = useAuthStore((s) => s.error);

  const trimmedEmail = email.trim();
  const emailWarning = !trimmedEmail
    ? "Please enter your email."
    : !/^\S+@\S+\.\S+$/.test(trimmedEmail)
      ? "Please enter a valid email address."
      : null;
  const passwordWarning = !password ? "Please enter your password." : null;

  const handleSubmit = () => {
    setSubmitAttempted(true);
    if (emailWarning || passwordWarning) return;
    login(trimmedEmail, password, rememberMe);
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <BokehBackground />
      <View style={styles.card}>
        <Text style={styles.title}>Studio OS</Text>
        <Text style={styles.subtitle}>Sign in to your studio</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={[styles.input, submitAttempted && emailWarning ? styles.inputInvalid : null]}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@studio.com"
          placeholderTextColor="#8a8ba3"
        />
        {submitAttempted && emailWarning ? <Text style={styles.fieldWarning}>{emailWarning}</Text> : null}

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={[styles.input, submitAttempted && passwordWarning ? styles.inputInvalid : null]}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor="#8a8ba3"
          onSubmitEditing={handleSubmit}
        />
        {submitAttempted && passwordWarning ? <Text style={styles.fieldWarning}>{passwordWarning}</Text> : null}

        <View style={styles.optionsRow}>
          <Checkbox checked={rememberMe} onToggle={() => setRememberMe((v) => !v)} label="Remember me" />
          <Pressable onPress={() => navigation.navigate("ForgotPassword")}>
            <Text style={styles.forgotLink}>Forgot password?</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.button, isSubmitting && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderRadius: 12,
    padding: 28,
    borderWidth: 1,
    borderColor: "rgba(240,236,255,0.8)",
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#17172f",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#5e5f78",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    color: "#5e5f78",
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e7e9f5",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: "#17172f",
    backgroundColor: "#ffffff",
  },
  inputInvalid: {
    borderColor: "#ef4444",
  },
  fieldWarning: {
    color: "#ef4444",
    fontSize: 12,
    marginTop: 6,
  },
  optionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 18,
  },
  forgotLink: {
    color: "#6d4aff",
    fontSize: 13,
    fontWeight: "600",
  },
  error: {
    color: "#ef4444",
    marginTop: 14,
    fontSize: 13,
  },
  button: {
    backgroundColor: "#6d4aff",
    borderRadius: 8,
    paddingVertical: 13,
    marginTop: 22,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
  },
});
