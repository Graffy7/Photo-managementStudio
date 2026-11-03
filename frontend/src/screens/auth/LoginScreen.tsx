import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, useWindowDimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../auth/authStore";
import { LoginScenery } from "../../components/LoginScenery";
import { transition } from "../../ui/theme";

// Sign-in over a full-screen scenic backdrop: a welcome message on the left, the form on the right
// (stacked on phones). Same fields and checks as before: email, password, remember me, forgot password.
const INK = "#F6F2EC"; // warm off-white text on the photo
const INK_SOFT = "rgba(246,242,236,0.82)";
const ACCENT = "#B5672F"; // warm copper, like the light in the sky
const ACCENT_HOVER = "#9E5726";

export function LoginScreen() {
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
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
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <LoginScenery />
      <ScrollView contentContainerStyle={[styles.content, wide && styles.contentWide]} keyboardShouldPersistTaps="handled">
        <View style={[styles.welcome, wide && styles.welcomeWide]}>
          <Text style={[styles.welcomeTitle, !wide && styles.welcomeTitleSmall]}>Welcome{"\n"}Back</Text>
          <Text style={styles.welcomeText}>
            Sign in to Studio OS to manage your enquiries, shoots, photo deliveries and payments - all in one place.
          </Text>
          <View style={styles.features}>
            {(["camera-outline", "images-outline", "calendar-outline", "wallet-outline"] as const).map((icon) => (
              <Ionicons key={icon} name={icon} size={20} color={INK_SOFT} />
            ))}
          </View>
        </View>

        <View style={[styles.form, wide && styles.formWide]}>
          <Text style={styles.formTitle}>Sign in</Text>

          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={[styles.input, submitAttempted && emailWarning ? styles.inputInvalid : null]}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholder="you@studio.com"
            placeholderTextColor="#8A8B92"
            accessibilityLabel="Email address"
          />
          {submitAttempted && emailWarning ? <Text style={styles.fieldWarning}>{emailWarning}</Text> : null}

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={[styles.input, submitAttempted && passwordWarning ? styles.inputInvalid : null]}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            placeholder="••••••••"
            placeholderTextColor="#8A8B92"
            onSubmitEditing={handleSubmit}
            accessibilityLabel="Password"
          />
          {submitAttempted && passwordWarning ? <Text style={styles.fieldWarning}>{passwordWarning}</Text> : null}

          <Pressable
            style={styles.remember}
            onPress={() => setRememberMe((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: rememberMe }}
          >
            <View style={[styles.box, rememberMe && styles.boxOn]}>
              {rememberMe && <Ionicons name="checkmark" size={12} color={INK} />}
            </View>
            <Text style={styles.rememberText}>Remember Me</Text>
          </Pressable>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={(state) => [
              styles.button,
              (state as { hovered?: boolean }).hovered && !isSubmitting && styles.buttonHover,
              isSubmitting && styles.buttonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            accessibilityRole="button"
          >
            {isSubmitting ? <ActivityIndicator color={INK} /> : <Text style={styles.buttonText}>Sign in now</Text>}
          </Pressable>

          <Pressable onPress={() => navigation.navigate("ForgotPassword")} accessibilityRole="link" style={styles.forgot}>
            <Text style={styles.forgotText}>Lost your password?</Text>
          </Pressable>

          <Text style={styles.footer}>Studio OS · your studio's data stays private to your studio</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const shadowText = Platform.OS === "web" ? ({ textShadow: "0 2px 12px rgba(20,18,22,0.45)" } as object) : {};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#2B2F3D" },
  content: { flexGrow: 1, justifyContent: "center", padding: 28, gap: 36 },
  contentWide: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 64, gap: 96 },

  welcome: { maxWidth: 440 },
  welcomeWide: { flex: 1, maxWidth: 460 },
  welcomeTitle: { color: INK, fontSize: 64, lineHeight: 68, fontWeight: "800", letterSpacing: -1, ...shadowText },
  welcomeTitleSmall: { fontSize: 42, lineHeight: 46 },
  welcomeText: { color: INK_SOFT, fontSize: 15, lineHeight: 23, marginTop: 18, maxWidth: 400, ...shadowText },
  features: { flexDirection: "row", gap: 18, marginTop: 22 },

  form: { width: "100%", maxWidth: 380, alignSelf: "center" },
  formWide: { flex: 1, maxWidth: 380 },
  formTitle: { color: INK, fontSize: 36, fontWeight: "800", textAlign: "center", marginBottom: 14, ...shadowText },
  label: { color: INK, fontSize: 13, fontWeight: "500", marginTop: 14, marginBottom: 6, ...shadowText },
  input: {
    backgroundColor: "rgba(246,242,236,0.94)", borderRadius: 4, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, color: "#292B31", borderWidth: 1, borderColor: "transparent",
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : {}),
  },
  inputInvalid: { borderColor: "#E8A08F" },
  fieldWarning: { color: "#FFD3C7", fontSize: 12, marginTop: 6, ...shadowText },
  remember: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14, alignSelf: "flex-start" },
  box: { width: 16, height: 16, borderRadius: 3, borderWidth: 1.5, borderColor: INK, alignItems: "center", justifyContent: "center" },
  boxOn: { backgroundColor: ACCENT, borderColor: ACCENT },
  rememberText: { color: INK, fontSize: 13, ...shadowText },
  error: { color: "#FFD3C7", marginTop: 12, fontSize: 13, ...shadowText },
  button: {
    backgroundColor: ACCENT, borderRadius: 4, paddingVertical: 11, paddingHorizontal: 22, marginTop: 18,
    alignSelf: "flex-start", minWidth: 140, alignItems: "center", ...transition,
  },
  buttonHover: { backgroundColor: ACCENT_HOVER, transform: [{ translateY: -1 }] },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: INK, fontWeight: "600", fontSize: 15 },
  forgot: { marginTop: 16, alignSelf: "flex-start" },
  forgotText: { color: INK, fontSize: 13, ...shadowText },
  footer: { color: INK_SOFT, fontSize: 12, textAlign: "center", marginTop: 28, ...shadowText },
});
