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
  const login = useAuthStore((s) => s.login);
  const isSubmitting = useAuthStore((s) => s.isSubmitting);
  const error = useAuthStore((s) => s.error);

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
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@studio.com"
          placeholderTextColor="#7c8ba0"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor="#7c8ba0"
        />

        <View style={styles.optionsRow}>
          <Checkbox checked={rememberMe} onToggle={() => setRememberMe((v) => !v)} label="Remember me" />
          <Pressable onPress={() => navigation.navigate("ForgotPassword")}>
            <Text style={styles.forgotLink}>Forgot password?</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.button, isSubmitting && styles.buttonDisabled]}
          onPress={() => login(email, password, rememberMe)}
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
    backgroundColor: "#0d1826",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "rgba(19, 37, 64, 0.72)",
    borderRadius: 12,
    padding: 28,
    borderWidth: 1,
    borderColor: "rgba(35, 64, 92, 0.8)",
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#e8edf3",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#a7b7cb",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    color: "#a7b7cb",
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: "#23405c",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: "#e8edf3",
    backgroundColor: "#0d1826",
  },
  optionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 18,
  },
  forgotLink: {
    color: "#7fc0e6",
    fontSize: 13,
    fontWeight: "600",
  },
  error: {
    color: "#ff7a72",
    marginTop: 14,
    fontSize: 13,
  },
  button: {
    backgroundColor: "#ff9a4d",
    borderRadius: 8,
    paddingVertical: 13,
    marginTop: 22,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#0d1826",
    fontWeight: "700",
    fontSize: 15,
  },
});
