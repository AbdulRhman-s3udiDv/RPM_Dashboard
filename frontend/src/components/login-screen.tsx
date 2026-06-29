import { Eye, EyeOff, HeartPulse } from "lucide-react-native";
import { useState } from "react";
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/hooks/use-theme";
import { CardShadow } from "@/constants/theme";

export function LoginScreen() {
  const colors = useTheme();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<"email" | "password" | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (submitting) return;
    setError("");
    setSubmitting(true);
    const result = await login(email, password);
    setSubmitting(false);
    if (!result.ok) setError(result.error);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Brand */}
        <View style={styles.brand}>
          <View style={[styles.brandMark, { backgroundColor: colors.primary }]}>
            <HeartPulse size={28} color="#fff" strokeWidth={2.2} />
          </View>
          <Text style={[styles.brandName, { color: colors.text }]}>RPMCares</Text>
          <Text style={[styles.brandTag, { color: colors.textSecondary }]}>Command Center</Text>
        </View>

        {/* Card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, ...CardShadow }]}>
          <Text style={[styles.heading, { color: colors.text }]}>Welcome back</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            Sign in to your RPMCares account.
          </Text>

          {/* Email */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>Email address</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@clinic.com"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              onFocus={() => setFocused("email")}
              onBlur={() => setFocused(null)}
              style={[
                styles.input,
                {
                  borderColor: focused === "email" ? colors.primary : colors.border,
                  color: colors.text,
                  backgroundColor: focused === "email" ? colors.card : colors.surface,
                },
              ]}
            />
          </View>

          {/* Password */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>Password</Text>
            <View style={{ justifyContent: "center" }}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.textSecondary}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => setFocused("password")}
                onBlur={() => setFocused(null)}
                style={[
                  styles.input,
                  {
                    borderColor: focused === "password" ? colors.primary : colors.border,
                    color: colors.text,
                    backgroundColor: focused === "password" ? colors.card : colors.surface,
                    paddingRight: 46,
                  },
                ]}
              />
              <Pressable
                onPress={() => setShowPassword((s) => !s)}
                hitSlop={10}
                style={styles.eyeBtn}>
                {showPassword
                  ? <EyeOff size={18} color={colors.textSecondary} />
                  : <Eye size={18} color={colors.textSecondary} />}
              </Pressable>
            </View>
          </View>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: colors.destructive + "10", borderColor: colors.destructive + "30" }]}>
              <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            style={({ pressed }) => [
              styles.submit,
              { backgroundColor: colors.primary, opacity: submitting ? 0.65 : pressed ? 0.88 : 1 },
            ]}>
            <Text style={styles.submitLabel}>
              {submitting ? "Signing in…" : "Sign in"}
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          Protected by RPMCares · HIPAA compliant
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 0 },
  brand: { alignItems: "center", marginBottom: 32 },
  brandMark: {
    width: 60, height: 60, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
    marginBottom: 14,
  },
  brandName: { fontSize: 22, fontWeight: "800", letterSpacing: -0.3 },
  brandTag: { fontSize: 12, marginTop: 3, letterSpacing: 0.3 },
  card: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 28,
  },
  heading: { fontSize: 19, fontWeight: "800", letterSpacing: -0.2 },
  sub: { fontSize: 13, marginTop: 5, marginBottom: 6, lineHeight: 19 },
  field: { marginTop: 20 },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 7 },
  input: {
    height: 46,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  eyeBtn: { position: "absolute", right: 13, height: 46, justifyContent: "center" },
  errorBox: {
    marginTop: 16, borderRadius: 8, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  errorText: { fontSize: 13, fontWeight: "600" },
  submit: {
    height: 48, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    marginTop: 24,
  },
  submitLabel: { color: "#fff", fontSize: 15, fontWeight: "700", letterSpacing: 0.1 },
  hint: { fontSize: 11.5, marginTop: 24 },
});
