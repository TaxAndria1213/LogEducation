import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { theme } from "@/constants/theme";
import { useOperationsBundle } from "@/hooks/useRoleFeeds";

export function OperationsScreen() {
  const { data, isLoading, refetch, isRefetching } = useOperationsBundle();

  return (
    <AppScreen
      title={data?.title || "Operations"}
      subtitle={data?.subtitle || "Repertoires et vues metier utiles"}
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
          title="Aucune operation disponible"
          message="Ce role n'a pas encore de flux operationnel mobile a afficher."
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
