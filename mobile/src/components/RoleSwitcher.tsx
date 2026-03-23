import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { ROLE_LABELS } from "@/constants/roles";
import { theme } from "@/constants/theme";
import type { RoleName } from "@/types/models";

type RoleSwitcherProps = {
  roles: RoleName[];
  activeRole: RoleName | null;
  onChange: (role: RoleName) => void;
};

export function RoleSwitcher({
  roles,
  activeRole,
  onChange,
}: RoleSwitcherProps) {
  if (!roles.length) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {roles.map((role) => {
        const active = role === activeRole;
        return (
          <Pressable
            key={role}
            onPress={() => onChange(role)}
            style={[
              styles.chip,
              active && {
                backgroundColor: theme.colors.chipActive,
                borderColor: theme.colors.chipActive,
              },
            ]}
          >
            <Text
              style={[
                styles.label,
                active && { color: theme.colors.chipActiveText },
              ]}
            >
              {ROLE_LABELS[role]}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.xs,
    paddingVertical: 4,
  },
  chip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.chip,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.text,
  },
});
