import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { theme } from "@/constants/theme";
import { useAcademicBundle } from "@/hooks/useRoleFeeds";

export function AcademicsScreen() {
  const { data, isLoading, refetch, isRefetching } = useAcademicBundle();

  return (
    <AppScreen
      title={data?.title || "Etudes"}
      subtitle={data?.subtitle || "Notes, evaluations et bulletins"}
      refreshing={isRefetching}
      onRefresh={refetch}
    >
      {isLoading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} />
      ) : data?.items.length ? (
        <View style={styles.list}>
          {data.items.map((item) => (
            <Card key={item.id}>
              <Text style={styles.title}>{item.title}</Text>
              {item.subtitle ? <Text style={styles.subtitle}>{item.subtitle}</Text> : null}
              {item.meta ? <Text style={styles.meta}>{item.meta}</Text> : null}
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState
          title="Aucune donnee pedagogique"
          message="Le role actif n'a pas encore de feed pedagogique a afficher."
        />
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: theme.spacing.sm,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  meta: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
});
