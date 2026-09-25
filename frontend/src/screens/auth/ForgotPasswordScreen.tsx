import { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import axios from "axios";
import { Ionicons } from "@expo/vector-icons";
import { authApi } from "../../api/authApi";
import { extractErrorMessage } from "../../api/errorMessage";
import { BokehBackground } from "../../components/BokehBackground";
import type { ResetChannel } from "../../types/auth";

type Step = "identify" | "code" | "password" | "done";

const errorText = (err: unknown, fallback?: string) =>
  axios.isAxiosError(err) && err.response?.status === 429
    ? "Too many tries. Please wait a minute and try again."
    : extractErrorMessage(err, fallback);

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// Counts down from `seconds` whenever `key` changes.
function useCountdown(seconds: number, key: unknown) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    setLeft(seconds);
    if (seconds <= 0) return;
    const until = Date.now() + seconds * 1000;
    const id = setInterval(() => {
      const s = Math.max(0, Math.round((until - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) clearInterval(id);
    }, 500);
    return () => clearInterval(id);
  }, [seconds, key]);
  return left;
}

// Forgot password: email or phone → 6-digit code → new password → sign in.
export function ForgotPasswordScreen() {
  const navigation = useNavigation<any>();
  const [step, setStep] = useState<Step>("identify");
  const [phoneAvailable, setPhoneAvailable] = useState(false);
  const [channel, setChannel] = useState<ResetChannel>("Email");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  // Bumped on every send so both countdowns restart.
  const [sendCount, setSendCount] = useState(0);
  const [timing, setTiming] = useState({ expires: 300, resend: 60 });
  const expiresIn = useCountdown(step === "code" ? timing.expires : 0, sendCount);
  const resendIn = useCountdown(step === "code" ? timing.resend : 0, sendCount);
  const codeInput = useRef<TextInput>(null);

  useEffect(() => {
    authApi.forgotPasswordOptions()
      .then((o) => { setPhoneAvailable(o.phoneAvailable); setTiming({ expires: o.codeExpirySeconds, resend: o.resendCooldownSeconds }); })
      .catch(() => undefined);
  }, []);

  const where = identifier.trim();

  const sendCode = async (isResend = false) => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const r = await authApi.sendResetCode(channel, identifier.trim());
      setTiming({ expires: r.expiresInSeconds, resend: r.resendAfterSeconds });
      setSendCount((n) => n + 1);
      setCode("");
      setStep("code");
      if (isResend) setInfo("A new code is on its way. Earlier codes no longer work.");
      setTimeout(() => codeInput.current?.focus(), 50);
    } catch (err) {
      setError(errorText(err, "Couldn't send the code. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value = code) => {
    if (value.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const r = await authApi.verifyResetCode(channel, identifier.trim(), value);
      setResetToken(r.resetToken);
      setStep("password");
    } catch (err) {
      const data = axios.isAxiosError(err) ? (err.response?.data as { code?: string; attemptsLeft?: number | null }) : undefined;
      if (data?.code === "TOO_MANY_ATTEMPTS") {
        setError("Too many wrong codes. This code no longer works. Request a new one.");
      } else if (data?.code === "INVALID_CODE") {
        const left = data.attemptsLeft;
        setError(`That code is wrong or has expired.${left != null ? ` ${left} ${left === 1 ? "try" : "tries"} left.` : ""}`);
      } else {
        setError(errorText(err, "Couldn't check the code. Please try again."));
      }
      setCode("");
      codeInput.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    setBusy(true);
    setError(null);
    try {
      await authApi.resetPassword({ token: resetToken, newPassword, confirmPassword });
      setStep("done");
    } catch (err) {
      setError(errorText(err, "Couldn't reset the password. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const onCodeChange = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    if (digits.length === 6) verify(digits);
  };

  const validIdentifier = channel === "Email"
    ? /^\S+@\S+\.\S+$/.test(identifier.trim())
    : identifier.replace(/\D/g, "").length >= 10;
  const passwordOk = newPassword.length >= 8 && newPassword === confirmPassword;

  const titles: Record<Step, [string, string]> = {
    identify: ["Reset your password", "We'll send a 6-digit code to the email or phone on your account."],
    code: ["Enter the code", `If an account uses ${where}, a 6-digit code was sent to it.`],
    password: ["Choose a new password", "Use at least 8 characters. You'll be signed out on all other devices."],
    done: ["Password changed", "Your password has been reset. Sign in with your new password."],
  };

  return (
    <View style={styles.screen}>
      <BokehBackground />
      <View style={styles.card}>
        {step !== "done" && (
          <View style={styles.steps} accessibilityLabel={`Step ${["identify", "code", "password"].indexOf(step) + 1} of 3`}>
            {(["identify", "code", "password"] as Step[]).map((s, i) => (
              <View key={s} style={[styles.stepDot, ["identify", "code", "password"].indexOf(step) >= i && styles.stepDotOn]} />
            ))}
          </View>
        )}
        {step === "done" && (
          <View style={styles.doneIcon}><Ionicons name="checkmark" size={30} color="#0d1826" /></View>
        )}
        <Text style={styles.title}>{titles[step][0]}</Text>
        <Text style={styles.subtitle}>{titles[step][1]}</Text>

        {step === "identify" && (
          <>
            {phoneAvailable && (
              <View style={styles.segment} accessibilityRole="radiogroup">
                {(["Email", "Phone"] as ResetChannel[]).map((c) => (
                  <Pressable key={c} style={[styles.segmentItem, channel === c && styles.segmentOn]}
                    onPress={() => { setChannel(c); setIdentifier(""); setError(null); }}
                    accessibilityRole="radio" accessibilityState={{ checked: channel === c }}>
                    <Ionicons name={c === "Email" ? "mail-outline" : "call-outline"} size={15} color={channel === c ? "#0d1826" : "#a7b7cb"} />
                    <Text style={[styles.segmentText, channel === c && styles.segmentTextOn]}>{c === "Email" ? "Email" : "Phone"}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <Text style={styles.label}>{channel === "Email" ? "Email" : "Phone number"}</Text>
            <TextInput
              style={styles.input}
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              autoFocus
              keyboardType={channel === "Email" ? "email-address" : "phone-pad"}
              placeholder={channel === "Email" ? "you@studio.com" : "Studio phone number, e.g. 98765 43210"}
              placeholderTextColor="#7c8ba0"
              onSubmitEditing={() => validIdentifier && !busy && sendCode()}
            />
            {channel === "Phone" && <Text style={styles.hint}>Studio owners: the phone number saved in your studio profile.</Text>}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable style={({ hovered }: any) => [styles.button, hovered && styles.buttonHover, (!validIdentifier || busy) && styles.buttonDisabled]}
              onPress={() => sendCode()} disabled={!validIdentifier || busy}>
              {busy ? <ActivityIndicator color="#0d1826" /> : <Text style={styles.buttonText}>Send code</Text>}
            </Pressable>
          </>
        )}

        {step === "code" && (
          <>
            <Pressable onPress={() => codeInput.current?.focus()} style={styles.codeBoxes} accessibilityLabel="6-digit code">
              {Array.from({ length: 6 }, (_, i) => (
                <View key={i} style={[styles.codeBox, i === code.length && !busy && styles.codeBoxActive, !!code[i] && styles.codeBoxFilled]}>
                  <Text style={styles.codeDigit}>{code[i] ?? ""}</Text>
                </View>
              ))}
              <TextInput
                ref={codeInput}
                style={styles.hiddenInput}
                value={code}
                onChangeText={onCodeChange}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={6}
                autoFocus
                editable={!busy}
                caretHidden
              />
            </Pressable>
            <Text style={[styles.meta, expiresIn === 0 && { color: "#ff7a72" }]}>
              {expiresIn > 0 ? `Code expires in ${clock(expiresIn)}` : "This code has expired. Request a new one."}
            </Text>
            {info ? <Text style={styles.info}>{info}</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable style={({ hovered }: any) => [styles.button, hovered && styles.buttonHover, (code.length !== 6 || busy) && styles.buttonDisabled]}
              onPress={() => verify()} disabled={code.length !== 6 || busy}>
              {busy ? <ActivityIndicator color="#0d1826" /> : <Text style={styles.buttonText}>Verify code</Text>}
            </Pressable>
            <View style={styles.row}>
              <Pressable onPress={() => { setStep("identify"); setError(null); setInfo(null); }}>
                <Text style={styles.link}>Change {channel === "Email" ? "email" : "number"}</Text>
              </Pressable>
              <Pressable onPress={() => sendCode(true)} disabled={resendIn > 0 || busy}>
                <Text style={[styles.link, (resendIn > 0 || busy) && styles.linkOff]}>
                  {resendIn > 0 ? `Resend code in ${clock(resendIn)}` : "Resend code"}
                </Text>
              </Pressable>
            </View>
            {channel === "Email" && <Text style={styles.hint}>Can't find it? Check your spam or promotions folder.</Text>}
          </>
        )}

        {step === "password" && (
          <>
            <Text style={styles.label}>New password</Text>
            <View>
              <TextInput style={[styles.input, { paddingRight: 44 }]} value={newPassword} onChangeText={setNewPassword}
                secureTextEntry={!showPassword} autoFocus placeholder="At least 8 characters" placeholderTextColor="#7c8ba0" />
              <Pressable style={styles.eye} onPress={() => setShowPassword((v) => !v)}
                accessibilityRole="button" accessibilityLabel={showPassword ? "Hide password" : "Show password"}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color="#a7b7cb" />
              </Pressable>
            </View>
            <Text style={styles.label}>Confirm new password</Text>
            <TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword} placeholder="Repeat your new password" placeholderTextColor="#7c8ba0"
              onSubmitEditing={() => passwordOk && !busy && resetPassword()} />
            {newPassword.length > 0 && newPassword.length < 8 && <Text style={styles.hint}>At least 8 characters.</Text>}
            {confirmPassword.length > 0 && newPassword !== confirmPassword && <Text style={styles.hint}>Passwords don't match yet.</Text>}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable style={({ hovered }: any) => [styles.button, hovered && styles.buttonHover, (!passwordOk || busy) && styles.buttonDisabled]}
              onPress={resetPassword} disabled={!passwordOk || busy}>
              {busy ? <ActivityIndicator color="#0d1826" /> : <Text style={styles.buttonText}>Reset password</Text>}
            </Pressable>
          </>
        )}

        {step === "done" && (
          <Pressable style={({ hovered }: any) => [styles.button, hovered && styles.buttonHover]} onPress={() => navigation.navigate("Login")}>
            <Text style={styles.buttonText}>Sign in</Text>
          </Pressable>
        )}

        {step !== "done" && (
          <Pressable style={styles.backLink} onPress={() => navigation.navigate("Login")}>
            <Text style={styles.backLinkText}>‹ Back to sign in</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d1826", alignItems: "center", justifyContent: "center", padding: 24 },
  card: {
    width: "100%", maxWidth: 400, backgroundColor: "rgba(19, 37, 64, 0.72)", borderRadius: 12,
    padding: 28, borderWidth: 1, borderColor: "rgba(35, 64, 92, 0.8)",
  },
  steps: { flexDirection: "row", gap: 6, justifyContent: "center", marginBottom: 16 },
  stepDot: { width: 28, height: 4, borderRadius: 2, backgroundColor: "#23405c" },
  stepDotOn: { backgroundColor: "#ff9a4d" },
  doneIcon: { alignSelf: "center", width: 52, height: 52, borderRadius: 26, backgroundColor: "#4cc493", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  title: { fontSize: 22, fontWeight: "700", color: "#e8edf3", textAlign: "center" },
  subtitle: { fontSize: 13, color: "#a7b7cb", textAlign: "center", marginTop: 8, marginBottom: 20, lineHeight: 19 },
  segment: { flexDirection: "row", backgroundColor: "#0d1826", borderRadius: 8, borderWidth: 1, borderColor: "#23405c", padding: 3, marginBottom: 16 },
  segmentItem: { flex: 1, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", paddingVertical: 8, borderRadius: 6 },
  segmentOn: { backgroundColor: "#ff9a4d" },
  segmentText: { color: "#a7b7cb", fontWeight: "600", fontSize: 13.5 },
  segmentTextOn: { color: "#0d1826" },
  label: { fontSize: 13, color: "#a7b7cb", marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: "#e8edf3", backgroundColor: "#0d1826",
  },
  eye: { position: "absolute", right: 6, top: 0, bottom: 0, width: 36, alignItems: "center", justifyContent: "center" },
  codeBoxes: { flexDirection: "row", gap: 8, justifyContent: "center", position: "relative" },
  codeBox: {
    width: 44, height: 54, borderRadius: 8, borderWidth: 1, borderColor: "#23405c", backgroundColor: "#0d1826",
    alignItems: "center", justifyContent: "center",
  },
  codeBoxActive: { borderColor: "#ff9a4d" },
  codeBoxFilled: { borderColor: "#7fc0e6" },
  codeDigit: { color: "#e8edf3", fontSize: 24, fontWeight: "700", fontVariant: ["tabular-nums"] },
  hiddenInput: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0, color: "transparent" },
  meta: { color: "#a7b7cb", fontSize: 12.5, textAlign: "center", marginTop: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
  link: { color: "#7fc0e6", fontSize: 13, fontWeight: "600" },
  linkOff: { color: "#6f83a0" },
  hint: { color: "#6f83a0", fontSize: 12, marginTop: 8 },
  info: { color: "#4cc493", fontSize: 13, marginTop: 12, textAlign: "center" },
  error: { color: "#ff7a72", marginTop: 12, fontSize: 13, textAlign: "center" },
  button: { backgroundColor: "#ff9a4d", borderRadius: 8, paddingVertical: 13, marginTop: 18, alignItems: "center" },
  buttonHover: { backgroundColor: "#ffb071" },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#0d1826", fontWeight: "700", fontSize: 15 },
  backLink: { marginTop: 18, alignItems: "center" },
  backLinkText: { color: "#7fc0e6", fontSize: 13, fontWeight: "600" },
});
