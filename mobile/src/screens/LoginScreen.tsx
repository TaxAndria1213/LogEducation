import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "@/components/Card";
import { theme } from "@/constants/theme";
import { useAuth } from "@/providers/AuthProvider";

export function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de se connecter pour le moment.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.select({ ios: "padding", default: undefined })}
      >
        <View style={styles.hero}>
          <Text style={styles.kicker}>LogEducation Mobile</Text>
          <Text style={styles.title}>Pilotage mobile par role</Text>
          <Text style={styles.subtitle}>
            Connecte-toi avec ton compte existant pour retrouver les modules utiles
            a ton role.
          </Text>
        </View>

        <Card>
          <Text style={styles.sectionTitle}>Connexion</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="email@etablissement.com"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.input}
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Mot de passe</Text>
            <TextInput
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.input}
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && { opacity: 0.9 },
            ]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonLabel}>Se connecter</Text>
            )}
          </Pressable>
        </Card>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboard: {
    flex: 1,
    padding: theme.spacing.lg,
    justifyContent: "center",
    gap: theme.spacing.xl,
  },
  hero: {
    gap: theme.spacing.sm,
  },
  kicker: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.primary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.textMuted,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: 8,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: theme.colors.text,
    backgroundColor: theme.colors.surfaceMuted,
  },
  button: {
    marginTop: 8,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonLabel: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  error: {
    color: theme.colors.danger,
    fontSize: 13,
  },
});
