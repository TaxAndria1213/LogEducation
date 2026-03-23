import { StyleSheet, Text, View } from "react-native";
import { theme } from "@/constants/theme";

export function EmptyState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <View style={styles.box}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    gap: theme.spacing.xs,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.text,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textMuted,
  },
});
