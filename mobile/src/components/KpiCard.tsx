import { StyleSheet, Text, View } from "react-native";
import { theme } from "@/constants/theme";
import type { FeedMetric } from "@/types/models";

const toneMap = {
  primary: theme.colors.primarySoft,
  success: "#dcfce7",
  warning: "#fef3c7",
  danger: "#fee2e2",
  info: "#dbeafe",
};

export function KpiCard({ item }: { item: FeedMetric }) {
  return (
    <View style={[styles.card, { backgroundColor: toneMap[item.tone ?? "primary"] }]}>
      <Text style={styles.value}>{item.value}</Text>
      <Text style={styles.label}>{item.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 6,
  },
  value: {
    fontSize: 24,
    fontWeight: "800",
    color: theme.colors.text,
  },
  label: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
});
