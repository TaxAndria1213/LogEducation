import { Pressable, StyleSheet, Text, View } from "react-native";
import { Card } from "@/components/Card";
import { theme } from "@/constants/theme";
import type { QuickAction } from "@/types/models";

export function QuickActionGrid({
  actions,
  onPress,
}: {
  actions: QuickAction[];
  onPress: (action: QuickAction) => void;
}) {
  return (
    <View style={styles.grid}>
      {actions.map((action) => (
        <Pressable
          key={action.id}
          style={styles.item}
          onPress={() => onPress(action)}
        >
          <Card>
            <Text style={styles.label}>{action.label}</Text>
            <Text style={styles.description}>{action.description}</Text>
          </Card>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: theme.spacing.sm,
  },
  item: {
    width: "100%",
  },
  label: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.text,
  },
  description: {
    fontSize: 13,
    color: theme.colors.textMuted,
    lineHeight: 18,
  },
});
